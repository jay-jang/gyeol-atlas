"""Two source-resolution transverse comparisons of the offline candidate."""
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from lib.mesh_plane_sections import sections


source = json.loads(Path('docs/anatomy-alignment/neural-component-source.json').read_text())
fit = json.loads(Path('docs/anatomy-alignment/cord-section-grid-shift.json').read_text())
baseline = {p['id']: p for p in json.loads(gzip.decompress(Path(source['geometryFile']).read_bytes()))}
candidate = {p['id']: p for p in json.loads(gzip.decompress(Path(fit['geometryFile']).read_bytes()))}
rows = next(m for m in source['modes'] if m['mode'] == 'source')['rows']
output = Path('docs/anatomy-alignment/cord-section-grid-source.png')
pairs = [('HRAF0371', 'HRAF0840'), ('HRAF0372', 'HRAF0841')]
font = ImageFont.load_default()
image = Image.new('RGB', (1400, 790), 'white')
draw = ImageDraw.Draw(image)
draw.text((20, 12), 'Original HRA source vs OFFLINE shifted-cord candidate; no public model change', fill='#142034', font=font)
draw.text((20, 32), 'Bone blue; cord magenta. Matched scale and plane per row. These are surface-plane lines, not filled tissue or CT.', fill='#142034', font=font)
for row_index, (cord_id, bone_id) in enumerate(pairs):
    witness = next(r['deepest'] for r in rows if r['cordId']==cord_id and r['boneId']==bone_id)
    y = witness['point'][1] + .000137
    records = []
    for partset in [baseline, candidate]:
        curves = []
        for identifier in [bone_id, cord_id]:
            part = partset[identifier]['source']
            shape = sections(np.asarray(part['positions']).reshape(-1, 3), np.asarray(part['indices']), 1, y, epsilon=1e-10)
            curves.append(shape['segments'][:, :, [0, 2]])
        records.append(curves)
    pts = np.concatenate([curve.reshape(-1, 2) for entry in records for curve in entry])
    lo, hi = pts.min(axis=0), pts.max(axis=0)
    center, span = (lo+hi)/2, max(hi-lo)*1.12
    draw.text((20, 72+350*row_index), f'{cord_id} / {bone_id}, y={y*1000:.3f} mm; source witness distance={witness["distanceMm"]:.3f} mm', fill='#142034', font=font)
    for column, curves in enumerate(records):
        left, top = 20+700*column, 98+350*row_index
        draw.rectangle((left, top, left+675, top+310), fill='#f6f8fb', outline='#adbac9')
        draw.text((left+12, top+10), ['Original source', 'OFFLINE candidate'][column], fill='#142034', font=font)
        scale = 282/span
        def pixel(p):
            return (left+337+(p[0]-center[0])*scale, top+160-(p[1]-center[1])*scale)
        for segments, color in zip(curves, ['#086da6', '#b21c6b']):
            for a, b in segments:
                draw.line((*pixel(a), *pixel(b)), fill=color, width=2)
        wx,wz = pixel(np.array(witness['point'])[[0,2]])
        draw.ellipse((wx-3,wz-3,wx+3,wz+3),fill='#101820')
        draw.line((left+30, top+280, left+30+10*scale/1000, top+280),fill='#101820',width=3)
        draw.text((left+30, top+285), '10 mm',fill='#101820',font=font)
draw.text((20, 770), 'HRA female brain/spinal source v1.1 and united v1.10; Kristen Browne, Heidi Schlehlein; CC BY 4.0. Geometry diagnostic only.', fill='#142034',font=font)
image.save(output)
sha = hashlib.sha256(output.read_bytes()).hexdigest()
print(json.dumps({'output':str(output),'sha256':sha,'pairs':pairs}))
