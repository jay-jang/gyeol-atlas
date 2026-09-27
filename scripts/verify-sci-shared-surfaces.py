"""Reconstruct voxel sides and shared triangles from saved Float32 geometry."""
import gzip
import hashlib
import json
from pathlib import Path
import zipfile
import numpy as np

ROOT = Path('.cache/sci-head')


def main():
    raw = (ROOT / 'shared-candidate.json').read_bytes()
    report = json.loads(raw)
    source = (ROOT / 'Segmentation.zip').read_bytes()
    assert hashlib.sha256(source).hexdigest() == report['files'][0]['sha256']
    with zipfile.ZipFile(ROOT / 'Segmentation.zip') as z:
        nrrd = z.read('Segmentation/HeadSegmentation.nrrd')
    header, payload = nrrd.split(b'\n\n', 1)
    line = next(s for s in header.decode().splitlines() if s.startswith('space origin:'))
    origin = np.array(list(map(float, line.split('(', 1)[1].rstrip(')').split(','))))
    labels = np.frombuffer(gzip.decompress(payload), dtype='u1').reshape((208, 256, 256), order='F')
    packed = Path(report['binary']['path']).read_bytes()
    assert hashlib.sha256(packed).hexdigest() == report['binary']['sha256']
    binary = gzip.decompress(packed)
    assert len(binary) == report['binary']['bytes']
    canonical, signs, rows = [], [], []

    def at(points):
        indices = np.floor(points + .5).astype(np.int64)
        valid = ((indices >= 0) & (indices < np.array(labels.shape))).all(axis=1)
        result = np.full(len(points), 8, dtype='u1')
        result[valid] = labels[tuple(indices[valid].T)]
        return result

    for part in report['parts']:
        points = np.frombuffer(binary, dtype='<f4', count=part['vertexCount'] * 3, offset=part['positions']).reshape(-1, 3).astype(np.float64)
        faces = np.frombuffer(binary, dtype='<u4', count=part['indexCount'], offset=part['indices']).reshape(-1, 3)
        assert np.isfinite(points).all() and faces.max() < len(points)
        lps = points[:, [0, 2, 1]] * [1, -1, 1] * 1000
        indices = lps - origin
        corners = np.rint(indices + .5).astype(np.int64)
        error = float(np.abs(corners - .5 - indices).max())
        assert error < .00002
        assert ((corners >= 0) & (corners <= np.array(labels.shape))).all()
        exact = corners.astype(np.float64) - .5
        tri = exact[faces]
        normal = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        # Each triangle is exactly half a unit-grid square, with one axis normal.
        assert (np.count_nonzero(normal, axis=1) == 1).all()
        assert (np.abs(normal).sum(axis=1) == 1).all()
        center = tri.mean(axis=1)
        inside, outside = at(center - normal * .25), at(center + normal * .25)
        assert np.isin(inside, part['sourceLabels']).all()
        assert (~np.isin(outside, part['sourceLabels'])).all()
        volume = float(np.sum(tri[:, 0] * normal) / 6)
        voxel_count = int(np.isin(labels, part['sourceLabels']).sum())
        assert abs(volume - voxel_count) < 1e-6
        # Global integer corner IDs independently reconstructed from serialized positions.
        ids = corners[:, 0] + 209 * (corners[:, 1] + 257 * corners[:, 2])
        triples = np.sort(ids[faces], axis=1)
        unique = np.unique(triples, axis=0)
        assert len(unique) == len(faces), 'Duplicate triangle within a material'
        if part['id'] != 'non-background-envelope':
            canonical.append(triples)
            signs.append(normal.sum(axis=1).astype(np.int8))
        rows.append(dict(id=part['id'], vertices=len(points), triangles=len(faces),
                         maximumGridRoundtripMm=error, exactGridVolumeMm3=volume, sourceVoxels=voxel_count,
                         trianglesWithBackgroundNeighbor=int((outside == 8).sum())))
        print(json.dumps(rows[-1]), flush=True)
    all_triangles, all_signs = np.concatenate(canonical), np.concatenate(signs)
    _, inverse, counts = np.unique(all_triangles, axis=0, return_inverse=True, return_counts=True)
    assert np.isin(counts, [1, 2]).all()
    orientation_sum = np.bincount(inverse, weights=all_signs)
    assert (orientation_sum[counts == 2] == 0).all()
    background_count = sum(r['trianglesWithBackgroundNeighbor'] for r in rows[:-1])
    assert int((counts == 1).sum()) == background_count
    proof = dict(reportSha256=hashlib.sha256(raw).hexdigest(), rows=rows,
                 totalVertices=sum(r['vertices'] for r in rows), sharedTriangles=int((counts == 2).sum()),
                 singleSidedBackgroundTriangles=background_count, oppositeSharedWinding=True,
                 limitations=['Cell-grid representation and triangle pairing, not a smooth anatomical segmentation or clinical review.',
                              'Volumes include artificial scan closures. Exact grid volume is not a patient organ-volume measurement.',
                              'No manifold-junction, HRA alignment, clinical tissue-name or complete neural-pathway approval.'],
                 codeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (ROOT / 'shared-readback.json').write_text(json.dumps(proof, indent=2, allow_nan=False) + '\n')


if __name__ == '__main__':
    main()
