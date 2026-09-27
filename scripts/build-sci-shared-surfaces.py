"""Exact voxel-cell boundaries with identical, opposite-oriented shared faces.

Cache-only alternative to intersecting independently interpolated tissue surfaces.
No smoothing, decimation, relabeling or registration is performed.
"""
import gzip
import hashlib
import json
from pathlib import Path
import zipfile
import numpy as np

ROOT = Path('.cache/sci-head')


def main():
    parent_raw = (ROOT / 'candidate.json').read_bytes()
    parent = json.loads(parent_raw)
    archive = ROOT / 'Segmentation.zip'
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == parent['files'][0]['sha256']
    with zipfile.ZipFile(archive) as z:
        raw = z.read('Segmentation/HeadSegmentation.nrrd')
    assert hashlib.sha256(raw).hexdigest() == parent['files'][0]['memberSha256']
    labels = np.frombuffer(gzip.decompress(raw.split(b'\n\n', 1)[1]), dtype='u1').reshape((208, 256, 256), order='F')
    origin = np.array([float(v) for v in parent['segmentationHeader']['space origin'].strip('()').split(',')])
    padded = np.pad(labels, 1, constant_values=8)
    quads = {i: [] for i in range(1, 8)}
    quads['envelope'] = []
    interfaces = {}
    for axis in range(3):
        section = padded[tuple(slice(None) if a == axis else slice(1, -1) for a in range(3))]
        before = section[tuple(slice(0, -1) if a == axis else slice(None) for a in range(3))]
        after = section[tuple(slice(1, None) if a == axis else slice(None) for a in range(3))]
        grid = np.argwhere(before != after)
        left, right = before[tuple(grid.T)], after[tuple(grid.T)]
        u, v = np.eye(3, dtype=np.int64)[(axis + 1) % 3], np.eye(3, dtype=np.int64)[(axis + 2) % 3]
        corners = grid[:, None, :] + np.array([np.zeros(3, dtype=np.int64), u, u + v, v])[None, :, :]
        keys = corners[:, :, 0] + 209 * (corners[:, :, 1] + 257 * corners[:, :, 2])
        for label in range(1, 8):
            quads[label].extend([keys[left == label], keys[right == label][:, [0, 3, 2, 1]]])
        quads['envelope'].extend([keys[(left != 8) & (right == 8)], keys[(left == 8) & (right != 8)][:, [0, 3, 2, 1]]])
        pairs, counts = np.unique(np.sort(np.stack([left, right], axis=1), axis=1), axis=0, return_counts=True)
        for pair, count in zip(pairs, counts):
            key = '-'.join(map(str, pair))
            interfaces[key] = interfaces.get(key, 0) + int(count)
    parts, binary = [], bytearray()
    for key, blocks in quads.items():
        faces = np.concatenate(blocks)
        keys, inverse = np.unique(faces, return_inverse=True)
        local = inverse.reshape(-1, 4)
        triangles = local[:, [0, 1, 2, 0, 2, 3]].reshape(-1, 3).astype('<u4')
        indices = np.stack([keys % 209, keys // 209 % 257, keys // (209 * 257)], axis=1).astype(np.float64) - .5
        lps = indices + origin
        positions = (lps[:, [0, 2, 1]] * [1, 1, -1] / 1000).astype('<f4')
        position_offset = len(binary)
        binary.extend(positions.tobytes())
        index_offset = len(binary)
        binary.extend(triangles.tobytes())
        name = 'non-background-envelope' if key == 'envelope' else f'label-{key}'
        old = next(p for p in parent['parts'] if p['id'] == name)
        parts.append(dict(id=name, sourceLabels=old['sourceLabels'], vertexCount=len(positions), indexCount=triangles.size,
                          positions=position_offset, indices=index_offset, scanBoundaryXYZ=old['scanBoundaryXYZ'],
                          bounds=[positions.min(axis=0).tolist(), positions.max(axis=0).tolist()]))
        print(json.dumps(dict(id=name, vertices=len(positions), triangles=len(triangles))), flush=True)
    packed = gzip.compress(bytes(binary), mtime=0)
    path = ROOT / 'shared-candidate.bin.gz'
    path.write_bytes(packed)
    result = dict(parent, status='CACHE-ONLY SHARED VOXEL FACES; blocky cell-exact surface, no runtime export',
                  method='Cell faces at index +/- 0.5, one fixed shared diagonal, reversed winding for opposite tissue. Padding label 8 outside volume.',
                  parentReportSha256=hashlib.sha256(parent_raw).hexdigest(), parts=parts,
                  interfacesFaceCounts=interfaces,
                  binary=dict(path=str(path), bytes=len(binary), gzipBytes=len(packed), sha256=hashlib.sha256(packed).hexdigest()),
                  limitations=['Exact cell-boundary representation, not a smooth anatomical surface; 1mm stair steps remain.',
                               'Tissue names remain inferred; source-space preservation does not establish HRA registration or clinical segmentation accuracy.',
                               'Triple/quadruple junctions can be nonmanifold within a single tissue. Shared faces do not certify manifold topology.',
                               'Artificial scan closures remain, including lateral neck cropping. No smoothing or missing anatomy is synthesized.',
                               'Envelope duplicates material outer boundaries for diagnosis; do not add its volume to tissue volumes.'],
                  codeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (ROOT / 'shared-candidate.json').write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')


if __name__ == '__main__':
    main()
