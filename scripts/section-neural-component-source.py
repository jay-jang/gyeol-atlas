"""Source/runtime triangle sections at source inside witnesses; not tissue images."""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
from lib.mesh_plane_sections import sections

out = Path('.cache/neural-component-source')
report = json.loads(Path('docs/anatomy-alignment/neural-component-source.json').read_text())
parts = {p['id']: p for p in json.loads(gzip.decompress(Path(report['geometryFile']).read_bytes()))}
source = next(m for m in report['modes'] if m['mode'] == 'source')
records = []
for row in source['rows']:
    if not row['deepest']:
        continue
    point = np.array(row['deepest']['point'])
    plane = float(point[1])
    pair = f"{row['cordId']}-{row['boneId']}"
    results = {}
    for mode in ['source', 'runtime']:
        results[mode] = {}
        for kind, identifier in [('cord', row['cordId']), ('bone', row['boneId'])]:
            part = parts[identifier][mode]
            s = sections(np.array(part['positions']).reshape(-1, 3), np.array(part['indices']), 1, plane, epsilon=1e-10)
            results[mode][kind] = {k: v.tolist() if hasattr(v, 'tolist') else v for k, v in s.items()}
    all_points = np.array([p for mode in results.values() for s in mode.values() for line in s['segments'] for p in line])
    lo, hi = all_points.min(axis=0), all_points.max(axis=0)
    center = (lo+hi)/2
    span = max(hi[0]-lo[0], hi[2]-lo[2])*1.15
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="800" viewBox="0 0 1100 800">',
           '<rect width="1100" height="800" fill="white"/>',
           '<style>text{font-family:Arial,sans-serif;fill:#162333;font-size:15px}</style>',
           f'<text x="20" y="26">{pair}: {row["cordName"]} / {row["boneName"]}</text>',
           f'<text x="20" y="50">Atlas transverse plane y={plane*1000:.6f} mm; source witness-to-bone distance {row["deepest"]["distanceMm"]:.6f} mm</text>',
           '<text x="20" y="75">Blue: bone section; magenta: cord section; black: source query. Lines are surfaces, not filled tissues.</text>']
    for column, mode in enumerate(['source', 'runtime']):
        for zoom in [False, True]:
            left, top = 25+550*column, 120+(335 if zoom else 0)
            c = point if zoom else center
            width = 0.012 if zoom else span
            scale = 270/width
            def screen(p):
                return (left+260+(p[0]-c[0])*scale, top+145-(p[2]-c[2])*scale)
            clip = f'{mode}-{zoom}'
            svg += [f'<text x="{left}" y="{top-15}">{mode} / {"local zoom (2 mm scale)" if zoom else "whole section"}</text>',
                    f'<clipPath id="{clip}"><rect x="{left}" y="{top}" width="520" height="290"/></clipPath>',
                    f'<rect x="{left}" y="{top}" width="520" height="290" fill="#f7f9fc" stroke="#b7c2ce"/>',
                    f'<g clip-path="url(#{clip})">']
            for kind, color in [('bone', '#126ca1'), ('cord', '#ad226d')]:
                commands = []
                for a, b in results[mode][kind]['segments']:
                    x1, y1 = screen(a)
                    x2, y2 = screen(b)
                    commands.append(f'M{x1:.6f},{y1:.6f}L{x2:.6f},{y2:.6f}')
                svg.append(f'<path d="{" ".join(commands)}" fill="none" stroke="{color}" stroke-width="1.4"/>')
            x, y = screen(point)
            svg += [f'<circle cx="{x}" cy="{y}" r="3" fill="#111"/>', '</g>',
                    f'<text x="{left+8}" y="{top+22}">+Z anterior ↑ / +X left →</text>']
            bar_mm = 2 if zoom else 10
            svg += [f'<path d="M{left+20},{top+265}h{bar_mm*.001*scale}" stroke="#111" stroke-width="2"/>',
                    f'<text x="{left+20}" y="{top+252}">{bar_mm} mm</text>']
    svg += ['<text x="20" y="785">Same coordinates and plane in both columns; source query is not necessarily a runtime vertex. No anatomy was changed.</text>', '</svg>']
    file = out/f'{pair}.svg'
    file.write_text('\n'.join(svg))
    records.append({'pair': pair, 'sourceWitness': row['deepest'], 'planeYmeters': plane, 'sections': results,
                    'svg': str(file), 'svgSha256': hashlib.sha256(file.read_bytes()).hexdigest()})
result = {'scope': 'Seven source-witness planes, two geometry resolutions; not CT or clinical tissue segmentation.', 'records': records}
(out/'sections.json').write_text(json.dumps(result, indent=2)+'\n')
Path('docs/anatomy-alignment/neural-component-sections.json').write_text(json.dumps(result, separators=(',', ':'))+'\n')
print(json.dumps({'pairs': len(records), 'segments': sum(len(s['segments']) for r in records for m in r['sections'].values() for s in m.values())}))
