"""Render unmodified source samples and inspect all audited foot-label voxels.

Display uses stored intensities, not asserted HU. No tissue segmentation or
registration is performed. Image contours are the supplied foot masks.
"""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

root = Path('.cache/bonehub/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1')
out = Path('.cache/bonehub-ct-inspection')
out.mkdir(parents=True, exist_ok=True)
tracked = {}

def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(2**20), b''):
            h.update(chunk)
    return h.hexdigest()

def read(path):
    tracked[str(path)] = sha(path)
    return json.loads(Path(path).read_text())

ct = read(root / 'ct-receipt.json')
source = read(root / 'receipt.json')
inventory = read(root / 'inventory.json')
foot_report = read(root / 'foot-labels.json')
image_file = Path(ct['sourceFile']['file'])
assert sha(image_file) == ct['sourceFile']['sha256']
tracked[str(image_file)] = ct['sourceFile']['sha256']
nx, ny, nz = ct['nifti']['dims'][1:4]
assert ct['nifti']['datatype'] == 512 and ct['nifti']['bitpix'] == 16
assert ct['nifti']['sclSlope'] == 1 and ct['nifti']['sclInter'] == 0
foot_end = 200
assert max(l['max'][2] for f in foot_report['reports'] for l in f['labels']) < foot_end
foot = np.lib.format.open_memmap(out / 'foot-stored-values.npy', mode='w+', dtype='<u2', shape=(foot_end, ny, nx))
axial_z = [20, 60, 100, 140, 900, 1100, 1300, 1600]
axial = {}
# Axis labels refer to the recorded LPS grid. Not clinical plane selection.
coronal_y = [280, 350]
coronal = {y: np.empty((nz, nx), dtype=np.uint16) for y in coronal_y}
with gzip.open(image_file, 'rb') as stream:
    assert len(stream.read(ct['nifti']['voxOffset'])) == ct['nifti']['voxOffset']
    for z in range(nz):
        raw = stream.read(nx*ny*2)
        assert len(raw) == nx*ny*2
        plane = np.frombuffer(raw, dtype='<u2').reshape(ny, nx)
        if z < foot_end:
            foot[z] = plane
        if z in axial_z:
            axial[z] = plane.copy()
        for y in coronal_y:
            coronal[y][z] = plane[y]
    assert stream.read(1) == b''
foot.flush()
boundaries = {z: [] for z in axial_z[:4]}
labels = []
for report in foot_report['reports']:
    mask = next(m for m in inventory['masks'] if m['group'] == report['group'])
    entry = next(f for f in source['files'] if f['path'] == mask['file'])
    mask_file = Path(entry['local'])
    assert sha(mask_file) == mask['sha256']
    tracked[str(mask_file)] = mask['sha256']
    with mask_file.open('rb') as f:
        header = b''
        while not header.endswith(b'\n\n'):
            header += f.read(1)
            assert len(header) < 1000000
        layers = mask['sizes'][0]
        with gzip.GzipFile(fileobj=f) as stream:
            payload = stream.read(foot_end*ny*nx*layers)
    assert len(payload) == foot_end*ny*nx*layers
    voxels = np.frombuffer(payload, dtype=np.uint8).reshape(foot_end, ny, nx, layers)
    for label in report['labels']:
        lo, hi = label['min'], label['max']
        roi = (slice(lo[2], hi[2]+1), slice(lo[1], hi[1]+1), slice(lo[0], hi[0]+1))
        selected = voxels[roi + (label['layer'],)] == label['labelValue']
        values = foot[roi][selected]
        assert int(selected.sum()) == label['voxels']
        histogram = np.bincount(values, minlength=4096)
        labels.append({'name': label['name'], 'voxels': len(values),
                       'minimum': int(values.min()), 'maximum': int(values.max()),
                       'mean': float(values.mean()),
                       'quantiles': {str(q): float(np.quantile(values, q)) for q in [.01, .1, .5, .9, .99]},
                       'storedValuesBelow500': int((values < 500).sum()),
                       'histogram': [{'value': int(i), 'count': int(n)} for i, n in enumerate(histogram) if n]})
        for z in boundaries:
            region = voxels[z, :, :, label['layer']] == label['labelValue']
            edge = region & ~ndimage.binary_erosion(region, structure=np.ones((3, 3)))
            boundaries[z].append((edge, (255, 172, 45) if report['group']=='FOOT_LEFT' else (40, 224, 246)))
    del voxels, payload

# Numeric display window only. This is not a HU window, tissue classifier or
# a modification of the CT data. Every axial source voxel maps to one pixel.
display_range = [0, 2000]
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)
def gray(values):
    return np.rint(np.clip((values.astype(np.float64)-display_range[0])/(display_range[1]-display_range[0]), 0, 1)*255).astype(np.uint8)

captures = []
for group, positions in [('feet', axial_z[:4]), ('body', axial_z[4:])]:
    canvas = Image.new('RGB', (2*nx, 2*(ny+62)), '#081d27')
    for j, z in enumerate(positions):
        rgb = np.repeat(gray(axial[z])[..., None], 3, axis=2)
        for edge, color in boundaries.get(z, []):
            rgb[edge] = color
        x, y = (j%2)*nx, (j//2)*(ny+62)
        canvas.paste(Image.fromarray(rgb), (x, y+62))
        draw = ImageDraw.Draw(canvas)
        draw.text((x+12, y+8), f'CT z={z} mm / R at left, L at right / A at top', font=font, fill='white')
        draw.text((x+12, y+33), 'Stored 0..2000, NOT HU; source foot-mask contours' if group=='feet' else 'Stored 0..2000, NOT HU; no inferred organ labels', font=font, fill='white')
    file = out / f'{group}-axial.png'
    canvas.save(file)
    captures.append({'file': str(file), 'sha256': sha(file), 'type': 'axial', 'sliceIndices': positions, 'sourcePixelsResampled': False})

canvas = Image.new('RGB', (2*nx, nz+62), '#081d27')
for j, y in enumerate(coronal_y):
    # Scale X to physical millimetres relative to the 1mm superior-axis rows.
    panel = Image.fromarray(gray(coronal[y][::-1])).resize((round(nx*ct['nifti']['pixdim'][1]), nz), Image.Resampling.NEAREST)
    canvas.paste(panel, (j*nx+round((nx-panel.width)/2), 62))
    draw = ImageDraw.Draw(canvas)
    draw.text((j*nx+12, 8), f'CT coronal y={y} voxels / superior at top', font=font, fill='white')
    draw.text((j*nx+12, 33), 'Stored 0..2000, NOT HU; display-only nearest scaling', font=font, fill='white')
file = out / 'body-coronal.png'
canvas.save(file)
captures.append({'file': str(file), 'sha256': sha(file), 'type': 'coronal', 'sliceIndices': coronal_y, 'sourcePixelsResampled': 'nearest-neighbour display scaling in horizontal axis only'})
tracked[__file__] = sha(__file__)
result = {'status': 'Source image/mask inspection only; no tissue surface, HRA placement or clinical approval',
          'displayStoredRange': display_range, 'footCrop': {'zStart': 0, 'zStopExclusive': foot_end, 'file': str(out/'foot-stored-values.npy'),
                                                         'sha256': sha(out/'foot-stored-values.npy'), 'axisOrder': 'ZYX', 'dtype': '<u2'},
          'labels': labels, 'labelVoxels': sum(l['voxels'] for l in labels), 'captures': captures,
          'limitations': ['Foot label intensities use all foreground voxels within their previously audited bounds, not independent anatomical validation.',
                         'The preview masks are read only through z=199; full-mask payload validation belongs to the earlier foot-label report.',
                         'Stored intensity statistics are not HU calibration or diagnostic tissue definitions.',
                         'Only selected slices are pictured; full body coverage and all anatomical connections remain unverified.'],
          'files': [{'file': f, 'sha256': h} for f, h in tracked.items()]}
(out/'report.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'labels': len(labels), 'labelVoxels': result['labelVoxels'], 'minimum': min(l['minimum'] for l in labels),
                  'maximum': max(l['maximum'] for l in labels), 'storedValuesBelow500': sum(l['storedValuesBelow500'] for l in labels), 'captures': len(captures)}))
