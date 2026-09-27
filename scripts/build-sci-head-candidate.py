"""Cache-only SCI surfaces, preserving the segmentation's source grid.

Tissue names are explicitly editorial hypotheses, not a supplied numeric legend.
Uses the pinned female-CT Python environment (numpy/nibabel/scikit-image).
"""
import gzip
import hashlib
import io
import json
from pathlib import Path
import zipfile
import numpy as np
import nibabel as nib
from scipy import ndimage
from skimage.measure import marching_cubes

ROOT = Path('.cache/sci-head')
PINS = {
    'Segmentation.zip': '31b7f32628a887bb8e5e089bc98e355cbb30f94b8d4cf52685a58449068ec021',
    'T1.zip': '54b6e3f3ade3f5a9d321cf93fe69be796f09513e3c24a079731fbe93594f75fd',
    'Pseudo-CT.zip': 'b694998eaf9d568bf05ce9e7f75c4f8012c279a1befb2f6a56f8f73ce6801f4f',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def nrrd(raw):
    header, payload = raw.split(b'\n\n', 1)
    fields = dict(line.split(': ', 1) for line in header.decode().splitlines()[1:]
                  if line and not line.startswith('#'))
    assert fields['dimension'] == '3' and fields['sizes'] == '208 256 256'
    assert fields['encoding'] == 'gzip'
    assert fields['space directions'] == '(1,0,0) (0,1,0) (0,0,1)'
    dtype = {'unsigned char': 'u1', 'float': '<f4'}[fields['type']]
    if dtype == '<f4':
        assert fields['endian'] == 'little'
    data = np.frombuffer(gzip.decompress(payload), dtype=dtype).reshape((208, 256, 256), order='F')
    origin = np.array([float(v) for v in fields['space origin'].strip('()').split(',')])
    return fields, data, origin


def main():
    files = []
    inputs = {}
    for name, member in [('Segmentation.zip', 'Segmentation/HeadSegmentation.nrrd'),
                         ('T1.zip', 'T1/T1_Corrected.nrrd'),
                         ('Pseudo-CT.zip', 'Pseudo-CT/Pseudo-CT.nii')]:
        raw = (ROOT / name).read_bytes()
        assert sha(raw) == PINS[name]
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            assert archive.testzip() is None
            content = archive.read(member)
        inputs[name] = content
        files.append(dict(url='https://sci.utah.edu/~datasets/SCI_headmodel/' + name,
                          bytes=len(raw), sha256=sha(raw), member=member, memberSha256=sha(content)))
    header, labels, origin = nrrd(inputs['Segmentation.zip'])
    t1_header, t1, t1_origin = nrrd(inputs['T1.zip'])
    assert header['space'] == '3D-right-handed'
    assert t1_header['space'] == 'left-posterior-superior'
    assert np.array_equal(origin, t1_origin) and labels.shape == t1.shape
    assert np.isfinite(t1).all() and set(np.unique(labels)) == set(range(1, 9))
    ct = nib.Nifti1Image.from_bytes(inputs['Pseudo-CT.zip'])
    assert ct.shape == labels.shape and ct.header.get_xyzt_units()[0] == 'mm'
    # The NIfTI affine maps its indices to RAS mm; the matched NRRD grid is LPS.
    lps_to_ras = np.diag([-1., -1., 1., 1.])
    segmentation_affine = np.eye(4)
    segmentation_affine[:3, 3] = origin
    index_map = np.linalg.inv(ct.affine) @ lps_to_ras @ segmentation_affine
    expected = np.diag([-1., -1., 1., 1.])
    expected[:3, 3] = [207, 255, 0]
    assert np.max(np.abs(index_map - expected)) < 1e-4
    ct_on_segmentation = np.asarray(ct.dataobj)[::-1, ::-1, :]
    assert np.isfinite(ct_on_segmentation).all()

    hypotheses = {1: 'Eyes', 2: 'Gray matter', 3: 'White matter', 4: 'CSF',
                  5: 'Internal air / sinus', 6: 'Skull / modeled oral bone',
                  7: 'Scalp / external soft tissue', 8: 'Background air'}
    statistics = []
    for label in range(1, 9):
        mask = labels == label
        _, count = ndimage.label(mask)  # Face-connected voxels, not mesh topology.
        statistics.append(dict(value=label, editorialHypothesis=hypotheses[label],
                               authoritativeNumericName=False, voxels=int(mask.sum()),
                               faceConnectedVoxelComponents=count,
                               t1Percentiles10_50_90=np.percentile(t1[mask], [10, 50, 90]).tolist(),
                               pseudoCtPercentiles10_50_90=np.percentile(ct_on_segmentation[mask], [10, 50, 90]).tolist()))

    definitions = [(f'label-{i}', [i]) for i in range(1, 8)] + [('non-background-envelope', list(range(1, 8)))]
    parts, binary = [], bytearray()
    for name, values in definitions:
        mask = np.isin(labels, values)
        boundary = [bool(np.take(mask, i, axis=a).any()) for a in range(3) for i in (0, -1)]
        vertices, faces, _, _ = marching_cubes(np.pad(mask, 1), .5, allow_degenerate=False)
        source_indices = vertices - 1
        lps = source_indices + origin
        # LPS millimeters -> atlas left/superior/anterior meters; proper rotation.
        positions = (lps[:, [0, 2, 1]] * [1, 1, -1] / 1000).astype('<f4')
        triangles = positions[faces].astype(np.float64)
        signed_volume = np.sum(triangles[:, 0] * np.cross(triangles[:, 1], triangles[:, 2])) / 6
        if signed_volume < 0:
            faces = faces[:, [0, 2, 1]]
        faces = faces.astype('<u4')
        offset = len(binary)
        binary.extend(positions.tobytes())
        indices_offset = len(binary)
        binary.extend(faces.tobytes())
        restored_lps = positions[:, [0, 2, 1]].astype(np.float64) * [1, -1, 1] * 1000
        error = float(np.max(np.abs(restored_lps - lps)))
        parts.append(dict(id=name, sourceLabels=values, vertexCount=len(positions), indexCount=faces.size,
                          positions=offset, indices=indices_offset, scanBoundaryXYZ=boundary,
                          maximumCoordinateRoundtripMm=error,
                          bounds=[positions.min(axis=0).tolist(), positions.max(axis=0).tolist()]))
        print(json.dumps(parts[-1]), flush=True)
    packed = gzip.compress(bytes(binary), mtime=0)
    (ROOT / 'candidate.bin.gz').write_bytes(packed)
    report = dict(status='CACHE-ONLY SURFACE CANDIDATE; names inferred, not approved for runtime',
                  files=files, segmentationHeader=header, t1Header=t1_header,
                  orientationEvidence='Segmentation and official T1 share exact shape/origin/directions; T1 declares LPS. No independent DICOM orientation audit.',
                  pseudoCtIndexMap=index_map.tolist(), maximumPseudoCtIndexRoundingError=float(np.max(np.abs(index_map - expected))),
                  niftiSpatialUnits=ct.header.get_xyzt_units()[0], statistics=statistics, parts=parts,
                  scanBoundaryAxisOrder=['source grid X min', 'source grid X max', 'source grid Y min', 'source grid Y max', 'source grid Z min', 'source grid Z max'],
                  binary=dict(path=str(ROOT / 'candidate.bin.gz'), bytes=len(binary), gzipBytes=len(packed), sha256=sha(packed)),
                  coordinatePolicy='Common LPS-mm to left/superior/anterior-m rotation and unit conversion only. No centering, HRA registration, local fitting or runtime export.',
                  limitations=['Tissue names are editorial hypotheses based on source class list, location and image contrast; source numeric legend is not supplied.',
                               'Each binary label is independently meshed. Shared voxel boundaries do not prove nonintersecting triangular tissue interfaces.',
                               'Padding closes scan boundaries artificially; boundary flags must be preserved. No crop is presented as a natural anatomical ending.',
                               'The non-background envelope is a diagnostic union, not a newly segmented anatomical skin tissue.',
                               'The high synthetic-CT values within label 4 do not establish their cause or confirm a homogeneous CSF segmentation.',
                               'No brain regional subdivisions, cortical-bone layers, cranial nerves or normal dental anatomy are synthesized.',
                               'No HRA placement, whole-body completeness, clinical accuracy or redistribution approval is claimed.'],
                  codeSha256=sha(Path(__file__).read_bytes()))
    (ROOT / 'candidate.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(json.dumps(dict(statistics=statistics, binary=report['binary'])))


if __name__ == '__main__':
    main()
