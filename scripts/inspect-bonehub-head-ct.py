"""Same-source skull mask/CT versus fixed HRA brain in an offline candidate frame.

No new tissue labels, deformation, HU calibration or runtime model changes.
"""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from lib.mesh_plane_sections import sections

out = Path('.cache/bonehub-head-ct')
out.mkdir(parents=True, exist_ok=True)
tracked = {}


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for b in iter(lambda: f.read(2**20), b''):
            h.update(b)
    return h.hexdigest()


def read(path):
    tracked[str(path)] = sha(path)
    return json.loads(Path(path).read_text())


ct = read('docs/anatomy-alignment/bonehub-female-ct-receipt.json')
inventory = read('docs/anatomy-alignment/bonehub-female-inventory.json')
receipt = read('docs/anatomy-alignment/bonehub-female-receipt.json')
frame = read('.cache/bonehub-head/frame.json')
for f in frame['files']:
    assert sha(f['file']) == f['sha256'], f['file']
parts = json.loads(gzip.decompress(Path(frame['parts']).read_bytes()))
tracked[frame['parts']] = sha(frame['parts'])
brain_ids = set(next(p for p in read('data/female-organ-groups.json') if p['id'] == 'brain')['ids'])
brain = [p for p in parts if p['kind'] == 'neural' and p['id'] in brain_ids]
assert len(brain) == 283 and {p['id'] for p in brain} == brain_ids
nx, ny, nz = ct['nifti']['dims'][1:4]
spacing = np.array(ct['nifti']['pixdim'][1:4])
assert ct['nifti']['sclSlope'] == 1 and ct['nifti']['sclInter'] == 0
assert ct['nifti']['datatype'] == 512 and ct['nifti']['voxOffset'] == 352
np.testing.assert_array_equal(np.array(ct['nifti']['sformRas']), np.diag([-spacing[0], -spacing[1], spacing[2], 1])[:3])
transformed = {}
for candidate in frame['candidates']:
    inverse = np.linalg.inv(np.array(candidate['matrixColumnMajor']).reshape(4, 4, order='F'))
    transformed[candidate['mode']] = {}
    for p in brain:
        atlas = np.array(p['positions']).reshape(-1, 3)
        # Common inverse of the diagnostic skull transform; atlas remains fixed.
        native = (atlas @ inverse[:3, :3].T + inverse[:3, 3]) * 1000
        transformed[candidate['mode']][p['id']] = native

# One common crop includes all source skull vertices and all three brain maps.
points = [np.array(p['positions']).reshape(-1, 3)*1000 for p in parts if p['kind'] == 'source' and p['id'].startswith('SKULL_')]
points += [p for candidate in transformed.values() for p in candidate.values()]
lo = np.maximum(np.floor(np.min([p.min(axis=0) for p in points], axis=0)/spacing - 15).astype(int), 0)
hi = np.minimum(np.ceil(np.max([p.max(axis=0) for p in points], axis=0)/spacing + 16).astype(int), [nx, ny, nz])
assert (hi > lo).all()
shape = tuple((hi-lo)[::-1])
image = np.empty(shape, dtype='<u2')
mask = np.empty(shape, dtype=np.uint8)
image_file = Path(ct['sourceFile']['file'])
assert sha(image_file) == ct['sourceFile']['sha256']
tracked[str(image_file)] = ct['sourceFile']['sha256']
source_mask = next(p for p in inventory['masks'] if p['group'] == 'SKULL')
mask_file = Path(next(f for f in receipt['files'] if f['path'] == source_mask['file'])['local'])
assert sha(mask_file) == source_mask['sha256']
tracked[str(mask_file)] = source_mask['sha256']
mask_hist = np.zeros(256, dtype=np.int64)
label_bounds = {i: [np.array([nx, ny, nz]), np.array([-1, -1, -1])] for i in [1, 2]}
label_intensities = {i: np.zeros(65536, dtype=np.int64) for i in [1, 2]}
with gzip.open(image_file, 'rb') as ct_stream, mask_file.open('rb') as raw_mask:
    assert len(ct_stream.read(352)) == 352
    header = b''
    while not header.endswith(b'\n\n'):
        b = raw_mask.read(1)
        assert b and len(header) < 1000000
        header += b
    fields = {}
    for line in header.decode('ascii').splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            fields[k] = v.lstrip('= ').strip()
    assert fields['type'] == 'unsigned char' and fields['encoding'] == 'gzip'
    assert fields['sizes'] == f'{nx} {ny} {nz}' and fields['space'] == 'left-posterior-superior'
    assert fields['space directions'] == source_mask['directions'] and fields['space origin'] == '(0,0,0)'
    for i, name in enumerate(['SKULL_CRANIAL_MAXILLA', 'SKULL_MANDIBLE']):
        assert fields[f'Segment{i}_Name'] == name and int(fields[f'Segment{i}_LabelValue']) == i+1
        assert int(fields[f'Segment{i}_Layer']) == 0
    with gzip.GzipFile(fileobj=raw_mask) as mask_stream:
        for z in range(nz):
            raw = ct_stream.read(nx*ny*2)
            labels = mask_stream.read(nx*ny)
            assert len(raw) == nx*ny*2 and len(labels) == nx*ny
            plane = np.frombuffer(raw, dtype='<u2').reshape(ny, nx)
            label_plane = np.frombuffer(labels, dtype=np.uint8).reshape(ny, nx)
            mask_hist += np.bincount(label_plane.ravel(), minlength=256)
            for value in [1, 2]:
                yy, xx = np.where(label_plane == value)
                if len(xx):
                    label_bounds[value][0] = np.minimum(label_bounds[value][0], [xx.min(), yy.min(), z])
                    label_bounds[value][1] = np.maximum(label_bounds[value][1], [xx.max(), yy.max(), z])
                    label_intensities[value] += np.bincount(plane[yy, xx], minlength=65536)
            if lo[2] <= z < hi[2]:
                image[z-lo[2]] = plane[lo[1]:hi[1], lo[0]:hi[0]]
                mask[z-lo[2]] = label_plane[lo[1]:hi[1], lo[0]:hi[0]]
        assert ct_stream.read(1) == b'' and mask_stream.read(1) == b''
assert np.flatnonzero(mask_hist).tolist() == [0, 1, 2]
assert int(mask_hist.sum()) == nx*ny*nz
for path, array in [(out/'image.npy', image), (out/'mask.npy', mask)]:
    np.save(path, array)
    tracked[str(path)] = sha(path)


def label_values(points):
    voxel = np.floor(points/spacing + .5).astype(np.int64)
    in_grid = ((voxel >= lo) & (voxel < hi)).all(axis=1)
    local = voxel[in_grid]-lo
    values = mask[local[:, 2], local[:, 1], local[:, 0]]
    return {'points': len(points), 'outsideCrop': int((~in_grid).sum()),
            'nearestLabelCounts': np.bincount(values, minlength=3).tolist()}


membership = []
for mode, mapped in transformed.items():
    records = []
    for p in brain:
        used = np.unique(p['indices'])
        records.append({'id': p['id'], 'name': p['name'], **label_values(mapped[p['id']][used])})
    membership.append({'mode': mode, 'rows': records, 'summary': {
        'referencedVertexOccurrences': sum(p['points'] for p in records),
        'outsideCrop': sum(p['outsideCrop'] for p in records),
        'nearestLabelCounts': np.sum([p['nearestLabelCounts'] for p in records], axis=0).tolist(),
        'meshesWithNearestSkullLabel': sum(p['nearestLabelCounts'][1] > 0 for p in records)}})
native_controls = [dict(id=p['id'], **label_values(np.array(p['positions']).reshape(-1, 3)*1000)) for p in parts if p['kind'] == 'source' and p['id'].startswith('SKULL_')]

# Axial positions sample the source cranial range, not an inferred tissue label.
# Coronal/sagittal indices are fixed native-grid planes. All are recorded below.
planes = [('axial', 2, z) for z in [1580, 1610, 1640, 1670]] + [('coronal', 1, y) for y in [260, 340]] + [('sagittal', 0, x) for x in [300, 350]]
mode = 'rigid'
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
captures, section_records = [], []
for name, axis, index in planes:
    assert lo[axis] <= index < hi[axis]
    coordinate = float(index*spacing[axis])
    if axis == 2:
        values, labels = image[index-lo[2]], mask[index-lo[2]]
        horizontal, vertical, flipped = 0, 1, False
        orientation = 'R at left, L at right; A at top'
    elif axis == 1:
        values, labels = image[:, index-lo[1], :][::-1], mask[:, index-lo[1], :][::-1]
        horizontal, vertical, flipped = 0, 2, True
        orientation = 'R at left, L at right; S at top'
    else:
        values, labels = image[:, :, index-lo[0]][::-1], mask[:, :, index-lo[0]][::-1]
        horizontal, vertical, flipped = 1, 2, True
        orientation = 'A at left, P at right; S at top'
    rgb = np.repeat(np.rint(np.clip(values.astype(np.float64)/2000, 0, 1)*255).astype(np.uint8)[..., None], 3, axis=2)
    colored = rgb.copy()
    for label, color in [(1, (255, 172, 45)), (2, (40, 224, 246))]:
        selected = labels == label
        colored[selected] = np.rint(.45*colored[selected] + .55*np.array(color)).astype(np.uint8)
    # PIL resize maps cell centres using (sourceIndex+.5)*scale-.5.
    # Use that same map for the overlay, not an endpoint-aligned affine.
    width = round(values.shape[1]*spacing[horizontal]/.4)
    height = round(values.shape[0]*spacing[vertical]/.4)
    base = Image.fromarray(rgb).resize((width, height), Image.Resampling.NEAREST)
    overlay = Image.fromarray(colored).resize((width, height), Image.Resampling.NEAREST)
    brain_overlay = overlay.copy()
    draw = ImageDraw.Draw(brain_overlay)
    records = []
    for p in brain:
        section = sections(transformed[mode][p['id']], p['indices'], axis, coordinate)
        for segment in section['segments']:
            pixels = segment[:, [horizontal, vertical]]/spacing[[horizontal, vertical]] - lo[[horizontal, vertical]]
            if flipped:
                pixels[:, 1] = values.shape[0]-1-pixels[:, 1]
            pixels = (pixels+.5)*np.array([width/values.shape[1], height/values.shape[0]])-.5
            draw.line([tuple(p) for p in pixels], fill=(224, 88, 250), width=1)
        records.append({'id': p['id'], 'sourceGeometryId': p['sourceGeometryId'], 'segments': section['segments'].tolist(), 'triangleIds': section['triangleIds'].tolist(),
                        'coplanarTriangles': section['coplanarTriangles'], 'pointContacts': section['pointContacts']})
    panel_width = max(width, 360)
    canvas = Image.new('RGB', (3*panel_width, height+112), '#081d27')
    for i, panel in enumerate([base, overlay, brain_overlay]):
        canvas.paste(panel, (i*panel_width+(panel_width-width)//2, 112))
    title = ImageDraw.Draw(canvas)
    title.text((12, 8), f'{name} axis={axis}, index={index}, LPS={coordinate:.3f}mm | {orientation}', fill='white', font=font)
    title.text((12, 32), 'Stored values 0..2000, NOT HU. Orange/cyan: original skull/mandible voxel labels.', fill='white', font=font)
    title.text((12, 56), 'Purple: fixed HRA brain surface sections, inverse rigid candidate only. OFFLINE / NOT APPLIED.', fill='white', font=font)
    for i, label in enumerate(['CT only', 'CT + source labels', 'CT + source labels + HRA brain']):
        title.text((i*panel_width+12, 84), label, fill='white', font=font)
    file = out/f'{name}-{index}.png'
    canvas.save(file)
    captures.append({'file': str(file), 'sha256': sha(file), 'axis': axis, 'sliceIndex': index, 'coordinateLpsMm': coordinate,
                     'sourcePanelShape': list(values.shape), 'displayPanelShape': [height, width], 'horizontalAxis': horizontal, 'verticalAxis': vertical, 'verticalFlipped': flipped,
                     'segments': sum(len(p['segments']) for p in records), 'coplanarTriangles': sum(p['coplanarTriangles'] for p in records), 'pointContacts': sum(p['pointContacts'] for p in records)})
    section_records.append({'axis': axis, 'index': index, 'coordinateLpsMm': coordinate, 'rows': records})
    print(json.dumps({'capture': str(file), 'segments': captures[-1]['segments']}), flush=True)
section_file = out/'sections.json.gz'
section_file.write_bytes(gzip.compress(json.dumps({'mode': mode, 'planes': section_records}).encode(), mtime=0))
tracked[str(section_file)] = sha(section_file)
for file in [Path(__file__), Path('scripts/lib/mesh_plane_sections.py')]:
    tracked[str(file)] = sha(file)
report = {'status': 'Offline same-source CT/skull-mask versus fixed reference brain diagnostic; not anatomical approval',
          'crop': {'minXYZ': lo.tolist(), 'maxExclusiveXYZ': hi.tolist(), 'shapeZYX': [int(n) for n in shape], 'spacingXYZmm': spacing.tolist(), 'image': str(out/'image.npy'), 'mask': str(out/'mask.npy')},
          'fullSkullMask': {'voxels': int(mask_hist.sum()), 'histogram': mask_hist[:3].tolist(), 'labels': [
              {'value': i, 'boundsXYZ': [b.tolist() for b in label_bounds[i]], 'storedIntensityHistogram': [{'value': int(v), 'count': int(n)} for v, n in enumerate(label_intensities[i]) if n]} for i in [1, 2]], 'fullGzipStreamsRead': True},
          'brainMeshes': len(brain), 'membership': membership, 'nativeSkullControls': native_controls, 'sectionFile': str(section_file), 'captures': captures,
          'limitations': ['283 HRA brain-group meshes include spaces/supporting tissue; 282 Allen reference parts plus one Visible Human optic chiasm, not a CT-derived brain segmentation.',
                         'Nearest voxel uses floor(grid+0.5), no interpolation; surface smoothing and finite voxel boundaries affect counts. Repeated vertices in separate meshes are counted separately.',
                         'Skull mask membership is not brain-tissue classification, penetration volume, clinical injury or a validated registration objective.',
                         'Purple segments are actual triangle-plane sections; coplanar triangles are counted but not drawn, point contacts counted separately. No contour interior is filled.',
                         'Eight selected planes and three candidate inverse transforms do not verify all anatomy or connection/foramen routes. No fitting is performed by this script.',
                         'Intensity window and nearest display resampling are visualization only; stored values are not asserted HU and no new brain/cavity labels are created.'],
          'files': [{'file': f, 'sha256': h} for f, h in tracked.items()]}
(out/'report.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'fullSkullHistogram': mask_hist[:3].tolist(), 'membership': [dict(mode=m['mode'], **m['summary']) for m in membership], 'captures': len(captures)}))
