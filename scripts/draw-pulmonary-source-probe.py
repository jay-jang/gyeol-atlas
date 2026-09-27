"""Orthographic source-mesh diagnostic, not a screenshot of the released app."""
import json
from pathlib import Path
import zipfile
from PIL import Image, ImageDraw, ImageFont
import numpy as np
from importlib.util import spec_from_file_location, module_from_spec

spec = spec_from_file_location('probe', Path(__file__).with_name('audit-pulmonary-source-probe.py'))
probe = module_from_spec(spec)
spec.loader.exec_module(probe)
root = Path('.cache/bp4-official')
receipt = json.loads((root/'v43-pulmonary-source.json').read_text())
meshes = []
with zipfile.ZipFile(root/'isa_BP3D_4.0_obj_99.zip') as old, zipfile.ZipFile(receipt['archive']) as new:
    for id in ['FJ2041', 'FJ2044']:
        _, vertices, triangles = probe.mesh(old.read(f'isa_BP3D_4.0_obj_99/{id}.obj'))
        meshes.append((id, vertices, triangles, (245, 112, 91)))
    for row in receipt['parts']:
        id = row['metadata']['art_id']
        _, vertices, triangles = probe.mesh(new.read(row['entry']))
        meshes.append((id, vertices, triangles, (55, 214, 203) if id.startswith('FJ29') else (227, 167, 249)))
fontpath = '/System/Library/Fonts/Supplemental/Arial.ttf'
font = ImageFont.truetype(fontpath, 20)
small = ImageFont.truetype(fontpath, 17)
title = ImageFont.truetype(fontpath, 27)
canvas = Image.new('RGB', (1800, 1000), (18, 26, 36))
draw = ImageDraw.Draw(canvas)
draw.text((30, 20), 'Pulmonary source comparison | raw OBJ coordinates, millimetres', font=title, fill='white')
draw.text((30, 62), 'Diagnostic only: no runtime correction; projections do not establish anatomical accuracy or connectivity.', font=font, fill=(214, 219, 226))
for n, (axes, zoom, heading) in enumerate([((0, 2), False, 'Source X / Z - full height'), ((1, 2), False, 'Source Y / Z - full height'), ((0, 2), True, 'Source X / Z - upper group enlarged')]):
    left, top, width, height = 30+n*590, 150, 555, 705
    selected = meshes[2:] if zoom else meshes
    points = np.concatenate([item[1][:, axes] for item in selected])
    low, high = points.min(axis=0), points.max(axis=0)
    scale = min((width-55)/(high[0]-low[0]), (height-95)/(high[1]-low[1]))
    centre = (low+high)/2
    def project(v):
        p = (v[:, axes]-centre)*scale
        return np.column_stack((p[:, 0]+left+width/2, -p[:, 1]+top+height/2))
    draw.rectangle((left, top, left+width, top+height), outline=(79, 96, 112), width=2)
    draw.text((left+10, top-35), heading, font=font, fill='white')
    overlay = Image.new('RGBA', canvas.size)
    od = ImageDraw.Draw(overlay)
    for id, vertices, triangles, color in selected:
        p = project(vertices)
        for triangle in triangles:
            coords = [tuple(x) for x in p[triangle]]
            od.polygon(coords, fill=(*color, 85), outline=(*color, 150))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), overlay).convert('RGB')
    draw = ImageDraw.Draw(canvas)
    draw.text((left+10, top+height-35), f'Z {low[1]:.2f} to {high[1]:.2f} mm', font=small, fill=(220, 227, 233))
    if not zoom:
        for id, vertices, _, color in meshes[:2]:
            pos = project(vertices).mean(axis=0)
            draw.text((left+10, float(pos[1])-10), id, font=small, fill=color)
    bar_mm = 10 if zoom else 50
    x, y = left+width-30-bar_mm*scale, top+height-65
    draw.line((x, y, x+bar_mm*scale, y), fill='white', width=3)
    draw.text((x, y-23), f'{bar_mm} mm', font=small, fill='white')
for y, label, color in [(890, 'Orange: 4.0 FJ2041 / FJ2044 (absent from 4.3 membership)', (245,112,91)),
                         (922, 'Cyan: 4.3 FJ2974-2981 (7 branch meshes; geometry also present in 4.0)', (55,214,203)),
                         (954, 'Purple: 4.3 FJ6044-6051 (7 added meshes, overlapping the branch group)', (227,167,249))]:
    draw.text((30, y), label, font=font, fill=color)
canvas.save('docs/anatomy-alignment/pulmonary-source-probe.png')
