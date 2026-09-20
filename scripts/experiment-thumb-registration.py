"""Bounded rigid three-bone thumb fit about a fixed proximal adjacency proxy.

Skin contour tracks supply the objective. No bone shrink, bend, joint-axis
validation, runtime write, or automatic clinical suitability claim is made.
"""
import hashlib
import json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[1]
paths = ['.cache/arm-registration/finger-sections.json', '.cache/arm-registration/thumb-pivots.json', 'docs/anatomy-alignment/female-arm-registration-v1.json']
sections, pivots, registration = [json.loads((ROOT / p).read_text()) for p in paths]
for report in [sections, pivots]:
    for f in report['files']:
        assert hashlib.sha256((ROOT / f['path']).read_bytes()).hexdigest() == f['sha256'], f['path']


def track(hand, key):
    radial = np.array(hand['basis'][0])
    rows = hand['sections']
    seeds = [i for i, r in enumerate(rows) if abs(r['depthMm'] - 70.031) < 1e-6]
    if len(seeds) != 1:
        raise ValueError('This pinned experiment requires its unique 70.031 mm seed plane; re-identify the branch explicitly if slicing changes')
    start = seeds[0]
    assert len(rows[start][key]) == 2, 'Seed plane must isolate two contours'
    seed = max(rows[start][key], key=lambda c: np.array(c['centroid']) @ radial)
    selected = [(rows[start]['depthMm'], seed)]
    for direction in [-1, 1]:
        previous = np.array(seed['centroid'])
        for i in range(start + direction, -1 if direction < 0 else len(rows), direction):
            choices = [c for c in rows[i].get(key, []) if c['areaMm2'] < 900]
            if not choices:
                break
            nearest = min(choices, key=lambda c: np.linalg.norm(np.array(c['centroid']) - previous))
            current = np.array(nearest['centroid'])
            if np.linalg.norm(current - previous) > .008:
                break
            selected.append((rows[i]['depthMm'], nearest)); previous = current
    selected.sort(key=lambda r: r[0])
    assert len(selected) >= 10
    return np.array([r[1]['centroid'] for r in selected]), [r[0] for r in selected]


result = {'status': 'EXPERIMENT ONLY; fixed CMC proxy rotation is not full thumb kinematics', 'hands': [],
          'limits': {'rotationVectorComponentDegrees': 20, 'maximumRotationNormDegrees': float(np.sqrt(3)*20)},
          'limitations': ['Same rigid rotation applied to first metacarpal and both thumb phalanges; no scale or local deformation.',
                         'Radial short skin branch identified from isolated seed plane and continuity; not an expert-validated anatomical segmentation.',
                         'Pivot is vertex-density-dependent adjacency proxy. Actual CMC translation and nonintersecting axes are not modeled.',
                         'Containment, all-body bone intersections and articular separation require independent rejection screens.']}
for hand in sections['hands']:
    side = hand['side']; source, source_depths = track(hand, 'donorContours'); target, target_depths = track(hand, 'contours')
    pivot = np.array(next(h for h in pivots['hands'] if h['side'] == side)['pivot'])
    tree = cKDTree(target)
    limit = np.deg2rad(20)
    solutions = []
    for initial in [np.zeros(3)] + [np.eye(3)[i] * sign * np.deg2rad(10) for i in range(3) for sign in [-1, 1]]:
        params = initial
        for iteration in range(50):
            moved = (source - pivot) @ Rotation.from_rotvec(params).as_matrix().T + pivot
            forward = tree.query(moved)[1]; reverse = cKDTree(moved).query(target)[1]
            def residual(x):
                current = (source - pivot) @ Rotation.from_rotvec(x).as_matrix().T + pivot
                return np.r_[(current - target[forward]).ravel(), ((current[reverse] - target) * np.sqrt(len(source)/len(target))).ravel()]
            fit = least_squares(residual, params, bounds=(-limit, limit), loss='soft_l1', f_scale=.002, max_nfev=100)
            delta = np.linalg.norm(fit.x - params); params = fit.x
            if delta < 1e-9:
                break
        moved = (source - pivot) @ Rotation.from_rotvec(params).as_matrix().T + pivot
        score = np.mean(tree.query(moved)[0]**2) + np.mean(cKDTree(moved).query(target)[0]**2)
        solutions.append((score, params.copy(), iteration + 1))
    score, params, iterations = min(solutions, key=lambda row: row[0])
    linear = Rotation.from_rotvec(params).as_matrix().T
    translation = pivot - pivot @ linear
    records = []
    for r in registration['records']:
        if side in r['name'].lower() and ('thumb' in r['name'].lower() or 'first metacarpal' in r['name'].lower()):
            records.append({**r, 'linear': (np.array(r['linear']) @ linear).tolist(),
                            'translation': (np.array(r['translation']) @ linear + translation).tolist()})
    assert len(records) == 3
    moved = source @ linear + translation
    row = {'side': side, 'pivot': pivot.tolist(), 'sourceDepthsMm': source_depths, 'targetDepthsMm': target_depths,
           'sourceTrack': source.tolist(), 'targetTrack': target.tolist(), 'transformedTrack': moved.tolist(),
           'rotationVectorDegrees': np.rad2deg(params).tolist(), 'rotationNormDegrees': float(np.linalg.norm(np.rad2deg(params))),
           'linearFromRegistered': linear.tolist(), 'translationFromRegistered': translation.tolist(), 'iterations': iterations,
           'beforeMedianMm': float(np.median(tree.query(source)[0])*1000), 'afterMedianMm': float(np.median(tree.query(moved)[0])*1000),
           'afterMaxMm': float(tree.query(moved)[0].max()*1000), 'records': records}
    result['hands'].append(row)
    print(json.dumps({k:v for k,v in row.items() if k not in ['records','sourceTrack','targetTrack','transformedTrack','sourceDepthsMm','targetDepthsMm','linearFromRegistered','translationFromRegistered']}))
paths.append('scripts/experiment-thumb-registration.py')
result['files'] = [{'path': p, 'sha256': hashlib.sha256((ROOT / p).read_bytes()).hexdigest()} for p in paths]
(ROOT / '.cache/arm-registration/thumb-candidate.json').write_text(json.dumps(result, indent=2) + '\n')
