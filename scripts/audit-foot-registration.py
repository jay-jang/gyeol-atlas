"""Recover the existing borrowed-foot placement and measure paired skin slices.

Offline evidence only: no model, runtime transform, or clinical label is edited.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def module(name, relative):
    spec = importlib.util.spec_from_file_location(name, ROOT / relative)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


geom = module('geom', 'scripts/experiment-arm-landmarks.py')
sections = module('sections', 'scripts/lib/skin-sections.py')
female = geom.read_atlas('public/models/female/atlas-female.json')
donor = geom.read_atlas('.cache/male-details/atlas.json')
assert geom.files['.cache/male-details/atlas.json'] == 'd6979fc62cf18fa4f08a9e6efae8fdac9ec383c5a1f3c757920125ac758429fe'
by_source = {p['id']: p for p in donor['parts']}
fp, ft = geom.mesh(female, next(p for p in female['parts'] if p['name'] == 'Skin'), 'public/models/female')
dp, dt = geom.mesh(donor, next(p for p in donor['parts'] if p['name'] == 'Skin'), '.cache/arm-registration')
report = {'status': 'DIAGNOSTIC ONLY; not a corrected or clinically validated foot',
          'method': 'Recover source-to-existing affine map using talus vertex correspondence; validate all 28 foot parts per side; horizontal separate closed skin contours (nesting not classified).',
          'limitations': ['Donor skin transformed with the foot bone map is a comparison proxy, not female tissue.',
                         'Slice contours are unlabeled, can split/merge, and do not identify articular centres.',
                         'Affine singular values describe the existing upstream placement, not an endorsed anatomy transformation.'],
          'feet': []}
for side, sign, start, end in [('left', 1, 124, 152), ('right', -1, 152, 180)]:
    parts = [next(p for p in female['parts'] if p['id'] == f'BM{i:04d}') for i in range(start, end)]
    talus = next(p for p in parts if p['name'].lower() == f'{side} talus')
    source = by_source[talus['conceptId'].removeprefix('BORROWED:')]
    original, oi = geom.mesh(donor, source, '.cache/arm-registration')
    placed, pi = geom.mesh(female, talus, 'public/models/female')
    assert np.array_equal(oi, pi) and original.shape == placed.shape
    affine, _, rank, _ = np.linalg.lstsq(np.c_[original, np.ones(len(original))], placed, rcond=None)
    assert rank == 4
    determinant = float(np.linalg.det(affine[:3]))
    assert determinant > 0, 'Unexpected reflection'
    rows = []
    for part in parts:
        src = by_source[part['conceptId'].removeprefix('BORROWED:')]
        a, ai = geom.mesh(donor, src, '.cache/arm-registration')
        b, bi = geom.mesh(female, part, 'public/models/female')
        assert a.shape == b.shape and np.array_equal(ai, bi), part['id']
        error = np.linalg.norm(np.c_[a, np.ones(len(a))] @ affine - b, axis=1)
        assert error.max() < 1e-6, (part['id'], error.max())
        rows.append({'id': part['id'], 'sourceId': src['id'], 'name': part['name'],
                     'vertices': len(a), 'referencedVertices': len(np.unique(ai)),
                     'maxRecoveredErrorMm': float(error.max()*1000),
                     'currentBounds': [b.min(axis=0).tolist(), b.max(axis=0).tolist()]})
    moved_skin = np.c_[dp, np.ones(len(dp))] @ affine
    # Cut the left/right halves in their own SOURCE coordinates. The selected
    # horizontal planes are far below that cut; any open contour is rejected.
    source_faces = dt[(dp[dt, 0]*sign > 0).all(axis=1)]
    target_faces = ft[(fp[ft, 0]*sign > 0).all(axis=1)]
    profiles = []
    for y in np.arange(.002031, .120032, .002):
        row = {'heightMm': float(y*1000)}
        for label, points, triangles in [('target', fp, target_faces), ('placedDonor', moved_skin, source_faces)]:
            try:
                row[label] = sections.closed_sections(points, triangles, [0, y, 0], [0, 1, 0], [[1, 0, 0], [0, 0, 1]])
            except ValueError as error:
                row[label+'Error'] = str(error)
        profiles.append(row)
    item = {'side': side, 'sourceToExistingLinear': affine[:3].tolist(), 'sourceToExistingTranslation': affine[3].tolist(),
            'singularValues': np.linalg.svd(affine[:3], compute_uv=False).tolist(), 'determinant': determinant,
            'parts': rows, 'sections': profiles}
    report['feet'].append(item)
    print(json.dumps({'side': side, 'parts': len(rows), 'singularValues': item['singularValues'],
                      'maximumRecoveryErrorMm': max(r['maxRecoveredErrorMm'] for r in rows),
                      'sectionErrors': sum(any(k.endswith('Error') for k in row) for row in profiles),
                      'slices': [{'heightMm': r['heightMm'], **{k: [{'areaMm2': c['areaMm2'], 'centroid': c['centroid']} for c in r.get(k, [])] for k in ['target', 'placedDonor']},
                                  **{k: v for k, v in r.items() if k.endswith('Error')}} for r in profiles[::10]]}))
paths = ['scripts/audit-foot-registration.py', 'scripts/lib/skin-sections.py', 'scripts/experiment-arm-landmarks.py']
report['files'] = [{'path': p, 'sha256': h} for p, h in {**geom.files, **{p: hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in paths}}.items()]
output = ROOT/'.cache/foot-registration'
output.mkdir(parents=True, exist_ok=True)
(output/'baseline.json').write_text(json.dumps(report, indent=2)+'\n')
