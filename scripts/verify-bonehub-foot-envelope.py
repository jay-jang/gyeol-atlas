"""Independent serialized cell-face checks; no anatomical validation claim."""
import gzip
import hashlib
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path('.cache/bonehub-ct-inspection')


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(2**20), b''):
            h.update(b)
    return h.hexdigest()


def main():
    report = json.loads((ROOT/'envelope.json').read_text())
    for entry in report['files']:
        assert sha(entry['file']) == entry['sha256'], entry['file']
    assert sha(report['binary']['file']) == report['binary']['sha256']
    binary = gzip.decompress(Path(report['binary']['file']).read_bytes())
    assert len(binary) == report['binary']['uncompressedBytes']
    spacing = np.array(report['spacingXyzMm'])
    bone_rows = []
    for part in report['sourceParts']:
        path = next(e['file'] for e in report['files'] if e['file'].endswith('/'+part['name']+'.stl'))
        raw = Path(path).read_bytes()
        count = struct.unpack_from('<I', raw, 80)[0]
        assert len(raw) == 84+50*count
        source = np.array([values[3:12] for values in struct.iter_unpack('<12fH', raw[84:])], dtype=np.float64).reshape(-1, 3, 3)
        positions = np.frombuffer(binary, dtype='<f4', count=part['vertices']*3, offset=part['positions']).reshape(-1, 3)
        faces = np.frombuffer(binary, dtype='<u4', count=part['triangles']*3, offset=part['indices']).reshape(-1, 3)
        assert len(faces) == count and faces.max() < len(positions)
        assert np.array_equal(positions[faces], source)
        bone_rows.append(dict(name=part['name'], vertices=len(positions), triangles=count, maximumCoordinateResidualMm=0))
    rows = []
    for candidate in report['candidates']:
        assert sha(candidate['mask']['file']) == candidate['mask']['sha256']
        mask = np.load(candidate['mask']['file'])
        shape_xyz = np.array(mask.shape[::-1])
        total_triangles, all_ids, volume, cap_count, max_error = 0, [], 0., 0, 0.
        def at(points):
            indices = np.floor(points+.5).astype(np.int64)
            valid = ((indices >= 0) & (indices < shape_xyz)).all(axis=1)
            values = np.zeros(len(points), dtype=bool)
            values[valid] = mask[tuple(indices[valid, ::-1].T)]
            return values
        for key in ['surface', 'artificialClosures']:
            part = candidate[key]
            xyz = np.frombuffer(binary, dtype='<f4', count=part['vertices']*3, offset=part['positions']).reshape(-1, 3).astype(np.float64)
            faces = np.frombuffer(binary, dtype='<u4', count=part['triangles']*3, offset=part['indices']).reshape(-1, 3)
            assert np.isfinite(xyz).all() and faces.max() < len(xyz)
            corner = np.rint(xyz/spacing+.5).astype(np.int64)
            error = float(np.abs(xyz-(corner-.5)*spacing).max())
            max_error = max(max_error, error)
            assert error < .00005
            assert ((corner >= 0) & (corner <= shape_xyz)).all()
            tri = (corner.astype(np.float64)-.5)[faces]
            normal = np.cross(tri[:, 1]-tri[:, 0], tri[:, 2]-tri[:, 0])
            assert (np.count_nonzero(normal, axis=1) == 1).all()
            assert (np.abs(normal).sum(axis=1) == 1).all()
            extent = np.ptp(tri, axis=1)
            assert ((extent == 0) | (extent == 1)).all() and (extent.sum(axis=1) == 2).all()
            axes = np.argmax(np.abs(normal), axis=1)
            local = tri-tri.min(axis=1)[:, None, :]
            row, col = np.arange(len(tri))[:, None], np.arange(3)[None, :]
            bits = local[row, col, ((axes+1) % 3)[:, None]]+2*local[row, col, ((axes+2) % 3)[:, None]]
            bits.sort(axis=1)
            assert ((bits[:, 0] == 0) & (bits[:, 2] == 3) & np.isin(bits[:, 1], [1, 2])).all()
            center = tri.mean(axis=1)
            assert at(center-normal*.25).all() and (~at(center+normal*.25)).all()
            is_cap = np.all(tri[:, :, 2] == -.5, axis=1) | np.all(tri[:, :, 2] == mask.shape[0]-.5, axis=1)
            assert (is_cap == (key == 'artificialClosures')).all()
            cap_count += int(is_cap.sum())
            volume += float(np.sum(tri[:, 0]*normal)/6)
            lengths = shape_xyz+1
            ids = corner[:, 0]+lengths[0]*(corner[:, 1]+lengths[1]*corner[:, 2])
            all_ids.append(np.sort(ids[faces], axis=1))
            total_triangles += len(faces)
        assert len(np.unique(np.concatenate(all_ids), axis=0)) == total_triangles
        padded = np.pad(mask, 1)
        expected = 2*sum(int(np.count_nonzero(np.diff(padded, axis=a))) for a in range(3))
        assert expected == total_triangles
        assert abs(volume-int(mask.sum())) < 1e-6
        assert cap_count == 2*int(mask[0].sum()+mask[-1].sum())
        rows.append(dict(thresholdStored=candidate['thresholdStored'], triangles=total_triangles, artificialCapTriangles=cap_count,
                         expectedBoundaryTriangles=expected, sourceVoxels=int(mask.sum()), gridVolume=volume,
                         maximumFloat32RoundtripMm=max_error, uniqueTriangles=True, allTriangleSidesMatchMask=True))
        print(json.dumps(rows[-1]), flush=True)
    (ROOT/'envelope-readback.json').write_text(json.dumps(dict(status='Serialized envelope geometry matches derived masks, not anatomical accuracy',
        rows=rows, sourceBones=bone_rows, sourceTriangleCornerOccurrences=sum(b['triangles']*3 for b in bone_rows),
        files=[dict(file=str(f), sha256=sha(f)) for f in [ROOT/'envelope.json', Path(__file__)]],
        limitations=['Masks are algorithmic intensity candidates, not independent ground truth.',
                     'Closed volumes include artificial crop caps; not anatomical tissue volumes.',
                     'No HRA fit, manifold topology, tissue identification or clinical approval.']), indent=2)+'\n')


if __name__ == '__main__':
    main()
