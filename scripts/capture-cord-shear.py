"""Geometric source/failed-candidate sections, not application or clinical images."""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
from lib.mesh_plane_sections import sections

out = Path('.cache/cord-shear')
reference = json.loads(Path('docs/anatomy-alignment/neural-component-source.json').read_text())
audit = json.loads(Path('docs/anatomy-alignment/cord-shear-audit.json').read_text())
inputs = [Path(reference['geometryFile'])]
for tag in ['cord-shear', 'cord-shear-seeded']:
    fit = json.loads(Path(f'docs/anatomy-alignment/{tag}-fit.json').read_text())
    inputs.append(Path(fit['geometryFile']))
states = [{p['id']: p['source'] for p in json.loads(gzip.decompress(file.read_bytes()))} for file in inputs]
baseline_rows = next(m for m in reference['modes'] if m['mode'] == 'source')['rows']
old = next(r for r in baseline_rows if r['cordId']=='HRAF0372' and r['boneId']=='HRAF0841')['deepest']['point']
new = next(r for r in audit['modes'][0]['runs'][1]['rows'] if r['cordId']=='HRAF0376' and r['boneId']=='HRAF0842')['witness']['point']
records = []
for cord, bone, point in [('HRAF0372', 'HRAF0841', old), ('HRAF0376', 'HRAF0842', new)]:
    pair = f'{cord}-{bone}'
    curves = []
    for state in states:
        curves.append([sections(np.array(state[id]['positions']).reshape(-1,3), np.array(state[id]['indices']), 1, point[1], epsilon=1e-10)['segments'].tolist() for id in [bone, cord]])
    all_points = np.array([p for state in curves for lines in state for line in lines for p in line])
    lo, hi = all_points.min(axis=0), all_points.max(axis=0)
    center = (lo+hi)/2
    span = max(hi[0]-lo[0], hi[2]-lo[2])*1.2
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="740">', '<rect width="1260" height="740" fill="white"/>',
           '<style>text{font:15px Arial,sans-serif;fill:#162333}</style>',
           f'<text x="15" y="24">{pair}; y={point[1]*1000:.6f} mm. Both candidates FAILED; no deployed model changes.</text>',
           '<text x="15" y="49">Blue: fixed bone; magenta: cord. Same plane/scale in each row. +Z anterior up; +X left right.</text>']
    for column, label in enumerate(['Original source', 'Rejected nearest-exit', 'Rejected section-seeded']):
        for zoom in [False, True]:
            left, top = 10+420*column, 95+(320 if zoom else 0)
            c = point if zoom else center
            scale = 260/(.018 if zoom else span)
            project = lambda p: (left+200+(p[0]-c[0])*scale, top+140-(p[2]-c[2])*scale)
            clip = f'{column}-{zoom}'
            svg += [f'<text x="{left}" y="{top-12}">{label} / {"local" if zoom else "whole section"}</text>',
                    f'<clipPath id="{clip}"><rect x="{left}" y="{top}" width="400" height="280"/></clipPath>',
                    f'<rect x="{left}" y="{top}" width="400" height="280" fill="#f7f9fc" stroke="#b7c2ce"/>', f'<g clip-path="url(#{clip})">']
            for lines, color in zip(curves[column], ['#126ca1','#ad226d']):
                commands = []
                for a,b in lines:
                    x1,y1 = project(a)
                    x2,y2 = project(b)
                    commands.append(f'M{x1},{y1}L{x2},{y2}')
                svg.append(f'<path d="{" ".join(commands)}" fill="none" stroke="{color}" stroke-width="1.3"/>')
            svg.append('</g>')
            bar = 2 if zoom else 10
            svg += [f'<path d="M{left+12},{top+260}h{bar*.001*scale}" stroke="#111" stroke-width="2"/>', f'<text x="{left+12}" y="{top+248}">{bar} mm</text>']
    svg += ['<text x="15" y="725">Surface-plane intersection lines only; no filled tissue or clinical interpretation. Original neural/bone source: HRA, CC BY 4.0.</text>', '</svg>']
    file = out/f'candidate-{pair}.svg'
    file.write_text('\n'.join(svg))
    records.append({'pair':pair,'planeYmeters':point[1],'svg':str(file),'svgSha256':hashlib.sha256(file.read_bytes()).hexdigest(),
                    'segments':sum(len(lines) for state in curves for lines in state)})
report = {'scope':'Two exact selected-plane geometric diagnostics of three source-resolution states; not application screenshots.', 'records':records,
          'files':[{'file':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in inputs+[Path('scripts/capture-cord-shear.py'),Path('scripts/lib/mesh_plane_sections.py')]]}
(out/'visual-input.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(records))
