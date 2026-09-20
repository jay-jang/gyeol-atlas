"""Measured female skin contours beside currently registered donor hand bones.

No anatomy labels are inferred from contour order, and no model is modified.
Separate contours are diagnostic evidence for subsequent joint-aware fitting.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


geom = module('geom', 'scripts/experiment-arm-landmarks.py')
section = module('section', 'scripts/lib/skin-sections.py')
atlas = geom.read_atlas('public/models/female/atlas-female.json')
registration = json.loads((ROOT / 'docs/anatomy-alignment/female-arm-registration-v1.json').read_text())
donor = geom.read_atlas('.cache/male-details/atlas.json')
hand_fit = json.loads((ROOT / 'docs/anatomy-alignment/hand-candidates.json').read_text())
final_fit = json.loads((ROOT / 'docs/anatomy-alignment/arm-partial-candidate.json').read_text())
landmarks = json.loads((ROOT / '.cache/arm-registration/landmarks.json').read_text())
for f in landmarks['files']:
    assert hashlib.sha256((ROOT / f['path']).read_bytes()).hexdigest() == f['sha256'], f['path']
skin, triangles = geom.mesh(atlas, next(p for p in atlas['parts'] if p['name'] == 'Skin'), 'public/models/female')
donor_skin, donor_triangles = geom.mesh(donor, next(p for p in donor['parts'] if p['name'] == 'Skin'), '.cache/arm-registration')
report = {'status': 'SKIN CONTOUR DIAGNOSTIC; not anatomical joint or finger correspondence validation',
          'registrationVersion': registration['version'],
          'method': 'Disjoint triangle-plane closed contours, no convex-hull bridge; area centroids; 2 mm slices along the existing measured distal arm axis.',
          'limitations': ['Contours are unlabeled and can split/merge along the hand; centroid tracks are not joint centres.',
                          'Reported bone axes and projection ranges are diagnostics, not clinical landmarks.'], 'hands': []}
for side, sign in [('left', 1), ('right', -1)]:
    profile = next(p for p in landmarks['profiles'] if p['body'] == 'target' and p['side'] == side)
    wrist = np.array(profile['localMinima'][0]['centroid'])
    axis = np.array(profile['axis'])
    radial = np.array([sign, 0., 0.]); radial -= radial @ axis * axis; radial /= np.linalg.norm(radial)
    basis = np.array([radial, np.cross(axis, radial)])
    faces, _ = geom.distal_arm(skin, triangles, sign, profile['cutY'])
    donor_profile = next(p for p in landmarks['profiles'] if p['body'] == 'source' and p['side'] == side)
    donor_faces, _ = geom.distal_arm(donor_skin, donor_triangles, sign, donor_profile['cutY'])
    fit = next(a for a in hand_fit['arms'] if a['side'] == side)
    shift = np.array(next(a for a in final_fit['arms'] if a['side'] == side)['handClearance']['translationMm']) / 1000
    moved_skin = donor_skin @ np.array(fit['linearFromDonor']) + fit['translationFromDonor'] + shift
    rows = []
    for depth in np.arange(20.031, 220.032, 2.):
        origin = wrist + axis * depth / 1000
        try:
            contours = section.closed_sections(skin, faces, origin, axis, basis)
            rows.append({'depthMm': float(depth), 'contours': contours})
        except ValueError as error:
            rows.append({'depthMm': float(depth), 'error': str(error)})
        try:
            rows[-1]['donorContours'] = section.closed_sections(moved_skin, donor_faces, origin, axis, basis)
        except ValueError as error:
            rows[-1]['donorError'] = str(error)
    bones = []
    for r in registration['records']:
        if side not in r['name'].lower() or any(k in r['name'].lower() for k in ['humerus', 'radius', 'ulna']):
            continue
        p = next(p for p in atlas['parts'] if p['id'] == r['id'])
        points, _ = geom.mesh(atlas, p, 'public/models/female')
        points = points @ np.array(r['linear']) + r['translation']
        centre = points.mean(axis=0)
        _, _, axes = np.linalg.svd(points - centre, full_matrices=False)
        direction = axes[0]
        if direction @ axis < 0:
            direction = -direction
        projection = (points - wrist) @ axis * 1000
        bones.append({'id': r['id'], 'name': r['name'], 'centroid': centre.tolist(),
                      'axis': direction.tolist(), 'distalProjectionMm': [float(projection.min()), float(projection.max())]})
    report['hands'].append({'side': side, 'wrist': wrist.tolist(), 'axis': axis.tolist(), 'basis': basis.tolist(), 'sections': rows, 'bones': bones})
    print(side, 'errors', [r for r in rows if 'error' in r])
    print('contour counts', [(round(r['depthMm'], 1), len(r.get('contours', []))) for r in rows[::5]])
    print('thumb bones', [r for r in bones if 'thumb' in r['name'] or 'first metacarpal' in r['name']])
paths = ['scripts/audit-finger-sections.py', 'scripts/lib/skin-sections.py', 'scripts/experiment-arm-landmarks.py',
         'docs/anatomy-alignment/female-arm-registration-v1.json', '.cache/arm-registration/landmarks.json',
         'docs/anatomy-alignment/hand-candidates.json', 'docs/anatomy-alignment/arm-partial-candidate.json']
files = {**geom.files, **{p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in paths}}
report['files'] = [{'path': p, 'sha256': h} for p, h in files.items()]
(ROOT / '.cache/arm-registration/finger-sections.json').write_text(json.dumps(report, indent=2) + '\n')
