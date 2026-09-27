"""Cache-only stored-intensity envelope sensitivity test in native LPS mm.

Not a skin segmentation. Threshold components are selected by source bone-mask
seeds; seed inclusion is by construction, not an independent validation.
Cell-face construction adapts build-sci-shared-surfaces.py, without smoothing.
"""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy import ndimage

ROOT = Path('.cache/bonehub/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1')
OUT = Path('.cache/bonehub-ct-inspection')


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(2**20), b''):
            h.update(b)
    return h.hexdigest()


def cell_surface(mask, spacing):
    """Closed XYZ LPS cell faces, with separately marked Z crop closures."""
    padded = np.pad(mask, 1)
    lengths = np.array(mask.shape) + 1
    blocks = []
    for axis in range(3):
        section = padded[tuple(slice(None) if a == axis else slice(1, -1) for a in range(3))]
        before = section[tuple(slice(0, -1) if a == axis else slice(None) for a in range(3))]
        after = section[tuple(slice(1, None) if a == axis else slice(None) for a in range(3))]
        grid = np.argwhere(before != after)
        u, v = np.eye(3, dtype=np.int64)[(axis+1) % 3], np.eye(3, dtype=np.int64)[(axis+2) % 3]
        corners = grid[:, None, :] + np.array([np.zeros(3, dtype=np.int64), u, u+v, v])[None, :, :]
        keys = corners[:, :, 0] + lengths[0]*(corners[:, :, 1]+lengths[1]*corners[:, :, 2])
        reverse = ~before[tuple(grid.T)]
        keys[reverse] = keys[reverse][:, [0, 3, 2, 1]]
        blocks.append(keys)
    keys, inverse = np.unique(np.concatenate(blocks), return_inverse=True)
    indices = np.stack([keys % lengths[0], keys // lengths[0] % lengths[1], keys // (lengths[0]*lengths[1])], axis=1)-.5
    positions = (indices[:, ::-1]*spacing).astype('<f4')
    # ZYX -> XYZ reverses handedness, so reverse winding.
    triangles = inverse.reshape(-1, 4)[:, [0, 2, 1, 0, 3, 2]].reshape(-1, 3).astype('<u4')
    z = positions[triangles, 2]
    caps = np.all(z == -.5*spacing[2], axis=1) | np.all(z == (mask.shape[0]-.5)*spacing[2], axis=1)
    return positions, triangles, caps


def main():
    tracked = {}
    def read(path):
        tracked[str(path)] = sha(path)
        return json.loads(path.read_text())
    inspection = read(OUT/'report.json')
    receipt, inventory, labels = [read(ROOT/name) for name in ['ct-receipt.json', 'inventory.json', 'foot-labels.json']]
    crop = Path(inspection['footCrop']['file'])
    assert sha(crop) == inspection['footCrop']['sha256']
    tracked[str(crop)] = sha(crop)
    image = np.load(crop, mmap_mode='r')
    spacing = np.array(receipt['nifti']['pixdim'][1:4])
    assert image.shape == (200, 670, 673) and image.dtype == np.dtype('<u2')
    seeds = np.zeros(image.shape, dtype=np.uint8)
    for side, report in enumerate(labels['reports']):
        mask = next(m for m in inventory['masks'] if m['group'] == report['group'])
        path = ROOT/mask['file']
        assert sha(path) == mask['sha256']
        tracked[str(path)] = mask['sha256']
        with path.open('rb') as f:
            header = b''
            while not header.endswith(b'\n\n'):
                b = f.read(1)
                assert b and len(header) < 1000000
                header += b
            with gzip.GzipFile(fileobj=f) as stream:
                payload = stream.read(image.size*mask['sizes'][0])
        voxels = np.frombuffer(payload, dtype=np.uint8).reshape(*image.shape, mask['sizes'][0])
        for label in report['labels']:
            lo, hi = label['min'], label['max']
            assert 0 <= lo[2] <= hi[2] < image.shape[0]
            roi = tuple(slice(lo[a], hi[a]+1) for a in [2, 1, 0])
            selected = voxels[roi+(label['layer'],)] == label['labelValue']
            assert int(selected.sum()) == label['voxels']
            seeds[roi][selected] |= 1 << side
        del voxels, payload
    seed_voxels = seeds > 0
    source_parts, arrays, packed = [], [], bytearray()
    def pack(name, positions, triangles, kind, **extra):
        p, t = len(packed), len(packed)+positions.nbytes
        packed.extend(positions.astype('<f4').tobytes())
        packed.extend(triangles.astype('<u4').tobytes())
        return dict(name=name, kind=kind, positions=p, indices=t, vertices=len(positions), triangles=len(triangles), **extra)
    dtype = np.dtype([('normal', '<f4', 3), ('points', '<f4', (3, 3)), ('attribute', '<u2')])
    for part in inventory['parts']:
        if part['group'] not in ['FOOT_LEFT', 'FOOT_RIGHT']:
            continue
        path = ROOT/part['file']
        assert sha(path) == part['sha256']
        tracked[str(path)] = part['sha256']
        with path.open('rb') as f:
            f.seek(80)
            n = int.from_bytes(f.read(4), 'little')
            faces = np.frombuffer(f.read(), dtype=dtype)['points']
        assert len(faces) == n == part['triangles']
        vertices, inverse = np.unique(faces.reshape(-1, 3), axis=0, return_inverse=True)
        source_parts.append(pack(part['name'], vertices, inverse.reshape(-1, 3).astype('<u4'), 'bone'))
        arrays.append((part['name'], vertices))
    outcomes = []
    for threshold in [500, 650, 800]:
        foreground = image >= threshold
        assert foreground[seed_voxels].all()
        components, component_count = ndimage.label(foreground)  # 6-neighbour
        selected = np.unique(components[seed_voxels])
        assert 0 not in selected
        sizes = np.bincount(components.ravel())
        boxes = ndimage.find_objects(components)
        component_records = []
        for label in selected:
            slices = boxes[label-1]
            component_records.append(dict(label=int(label), voxels=int(sizes[label]),
                boundsIndexZyx=[[s.start for s in slices], [s.stop-1 for s in slices]],
                seededLeft=bool(np.any(components[seeds & 1 != 0] == label)),
                seededRight=bool(np.any(components[seeds & 2 != 0] == label))))
        keep = np.zeros(component_count+1, dtype=bool)
        keep[selected] = True
        mask = keep[components]
        del components, foreground, sizes, boxes
        filled = ndimage.binary_fill_holes(mask)
        membership = []
        for name, vertices in arrays:
            # Nearest cell centre; these are smoothed source STL vertices, not
            # the mask seed voxels. This is still not independent anatomy truth.
            xyz = np.floor(vertices.astype(np.float64)/spacing + .5).astype(np.int64)
            zyx = xyz[:, ::-1]
            assert np.all(zyx >= 0) and np.all(zyx < np.array(image.shape))
            index = tuple(zyx.T)
            membership.append(dict(name=name, vertices=len(vertices), outsideUnfilled=int((~mask[index]).sum()), outsideFilled=int((~filled[index]).sum())))
        path = OUT/f'envelope-{threshold}.npy'
        np.save(path, filled)
        positions, triangles, caps = cell_surface(filled, spacing)
        geometry = pack(f'envelope-{threshold}', positions, triangles[~caps], 'envelope')
        cap_geometry = pack(f'crop-closures-{threshold}', positions, triangles[caps], 'artificial-caps')
        outcome = dict(thresholdStored=threshold, foregroundComponentCount=component_count,
            selectedComponents=component_records, selectedVoxels=int(mask.sum()), filledVoxelsAdded=int((filled & ~mask).sum()),
            envelopeVoxels=int(filled.sum()), stlMembership=membership,
            surface=geometry, artificialClosures=cap_geometry,
            voxelVolumeMm3=float(filled.sum()*np.prod(spacing)),
            mask=dict(file=str(path), sha256=sha(path)),
            cropFacesTouched=[int(filled[0].sum()), int(filled[-1].sum())])
        outcomes.append(outcome)
        print(json.dumps({k: outcome[k] for k in ['thresholdStored', 'selectedComponents', 'filledVoxelsAdded', 'cropFacesTouched']}), flush=True)
    binary = OUT/'envelope-parts.bin.gz'
    binary.write_bytes(gzip.compress(bytes(packed), mtime=0))
    tracked[__file__] = sha(__file__)
    result = dict(status='CACHE-ONLY INTENSITY ENVELOPE CANDIDATES; not skin, HRA registration or clinical validation',
        spacingXyzMm=spacing.tolist(), coordinateSystem='Source LPS mm; no registration or deformation',
        connectivity=6, thresholdsStored=[500, 650, 800], seedUniqueVoxels=int(seed_voxels.sum()),
        seedVoxelOccurrences=inspection['labelVoxels'], sourceParts=source_parts, candidates=outcomes,
        binary=dict(file=str(binary), sha256=sha(binary), uncompressedBytes=len(packed)),
        limitations=['Empirical stored intensities, not calibrated HU or tissue labels.',
            'Bone-mask seeds select connected components; inclusion of all seed voxels is by construction.',
            '3D hole filling adds enclosed background cells; no dilation, closing, smoothing or anatomical completion.',
            'Two feet may touch and remain connected; scan support or wrapping may also connect. Not a verified isolated skin surface.',
            'Z crop planes have artificial cell-face closures stored separately, not anatomical skin. Open non-cap surfaces must not be used alone for parity containment.',
            'Only first 200 image slices used. Exact voxel cells produce stair steps. No whole-body or organ completeness claim.'],
        files=[dict(file=f, sha256=h) for f, h in tracked.items()])
    (OUT/'envelope.json').write_text(json.dumps(result, indent=2, allow_nan=False)+'\n')


if __name__ == '__main__':
    main()
