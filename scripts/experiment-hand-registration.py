"""Fit hand skin independently about measured wrist-section centroids.

This does NOT solve the forearm/wrist connection and is never deployed.
The fit uses skin only; bone containment is a separate rejection screen.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('arm_sections', ROOT / 'scripts/experiment-arm-landmarks.py')
geom = importlib.util.module_from_spec(spec)
spec.loader.exec_module(geom)
landmarks = json.loads((ROOT / '.cache/arm-registration/landmarks.json').read_text())
baseline = json.loads((ROOT / 'docs/anatomy-alignment/arm-registration-candidate.json').read_text())
for item in landmarks['files'] + baseline['files']:
    assert hashlib.sha256((ROOT / item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
male = geom.read_atlas('.cache/male-details/atlas.json')
female = geom.read_atlas('public/models/female/atlas-female.json')
skins = {}
for label, atlas, folder in [('source', male, '.cache/arm-registration'), ('target', female, 'public/models/female')]:
    skins[label] = geom.mesh(atlas, next(p for p in atlas['parts'] if p['name'] == 'Skin'), folder)


def hand_cloud(body, side):
    profile = next(p for p in landmarks['profiles'] if p['body'] == body and p['side'] == side)
    assert len(profile['localMinima']) == 1, 'Ambiguous skin constriction; do not silently pick one'
    wrist = np.array(profile['localMinima'][0]['centroid'])
    axis = np.array(profile['axis'])
    points, triangles = skins[body]
    _, arm = geom.distal_arm(points, triangles, 1 if side == 'left' else -1, profile['cutY'])
    hand = arm[(arm - wrist) @ axis >= 0]
    _, indices = np.unique(np.floor(hand / .002).astype(int), axis=0, return_index=True)
    hand = hand[indices]
    assert len(hand) > 200
    return hand, wrist


def distances(a, b):
    d = cKDTree(b).query(a)[0] * 1000
    return {'medianMm': float(np.median(d)), 'p95Mm': float(np.quantile(d, .95)), 'maxMm': float(d.max())}


result = {'status': 'EXPERIMENT ONLY: isolated hand candidate; forearm/wrist continuity UNSOLVED', 'arms': []}
for side in ['left', 'right']:
    source, source_wrist = hand_cloud('source', side)
    target, target_wrist = hand_cloud('target', side)
    a = source.mean(axis=0) - source_wrist
    b = target.mean(axis=0) - target_wrist
    rotation, _ = Rotation.align_vectors([b / np.linalg.norm(b)], [a / np.linalg.norm(a)])
    tree = cKDTree(target)

    def moved(params):
        return (source - source_wrist) @ Rotation.from_rotvec(params[:3]).as_matrix().T * np.exp(params[3]) + target_wrist

    solutions = []
    for twist in [-60, -30, 0, 30, 60]:
        initial = Rotation.from_rotvec(b / np.linalg.norm(b) * np.deg2rad(twist)) * rotation
        params = np.r_[initial.as_rotvec(), 0.0]
        for iteration in range(80):
            current = moved(params)
            _, forward = tree.query(current)
            _, reverse = cKDTree(current).query(target)
            balance = np.sqrt(len(source) / len(target))

            def residual(x):
                cloud = moved(x)
                return np.r_[(cloud - target[forward]).ravel(), ((cloud[reverse] - target) * balance).ravel()]

            fit = least_squares(residual, params, loss='soft_l1', f_scale=.004,
                                bounds=([-np.pi] * 3 + [np.log(.85)], [np.pi] * 3 + [np.log(1.15)]), max_nfev=30)
            delta = np.linalg.norm(fit.x - params)
            params = fit.x
            if delta < 1e-7:
                break
        current = moved(params)
        score = float(np.mean(tree.query(current)[0] ** 2) + np.mean(cKDTree(current).query(target)[0] ** 2))
        solutions.append((score, params, twist, iteration + 1))
    score, params, twist, iterations = min(solutions, key=lambda s: s[0])
    scale = float(np.exp(params[3]))
    linear = Rotation.from_rotvec(params[:3]).as_matrix().T * scale
    translation = target_wrist - source_wrist @ linear
    arm = next(p for p in baseline['arms'] if p['side'] == side)
    # Convert the raw donor transform to each currently deployed part's frame.
    # This avoids making a common-frame assumption when the source changes.
    parts = []
    for item in arm['parts']:
        hand = item['transformed'] and not any(name in item['name'].lower() for name in ['humerus', 'radius', 'ulna'])
        row = {**item, 'transformed': hand}
        if hand:
            donor = next(p for p in male['parts'] if p['id'] == item['sourceId'])
            host = next(p for p in female['parts'] if p['id'] == item['id'])
            original, original_tri = geom.mesh(male, donor, '.cache/arm-registration')
            current, current_tri = geom.mesh(female, host, 'public/models/female')
            assert np.array_equal(original_tri, current_tri)
            existing = np.linalg.lstsq(np.c_[original, np.ones(len(original))], current, rcond=None)[0]
            assert np.max(np.linalg.norm(np.c_[original, np.ones(len(original))] @ existing - current, axis=1)) < 1e-6
            corrected = np.linalg.solve(existing[:3], linear)
            offset = translation - existing[3] @ corrected
            row.update(linear=corrected.tolist(), translation=offset.tolist())
        parts.append(row)
    assert sum(p['transformed'] for p in parts) == 27
    transformed = moved(params)
    row = {'side': side, 'parts': parts, 'sourceWrist': source_wrist.tolist(), 'targetWrist': target_wrist.tolist(),
           'scaleFromDonor': scale, 'linearFromDonor': linear.tolist(), 'translationFromDonor': translation.tolist(),
           'initialTwistDegrees': twist, 'iterations': iterations, 'after': distances(transformed, target),
           'reverseAfter': distances(target, transformed)}
    result['arms'].append(row)
    print(json.dumps({k: v for k, v in row.items() if k not in ['parts', 'linearFromDonor', 'translationFromDonor']}))
all_files = {p['path']: p['sha256'] for p in landmarks['files'] + baseline['files']}
all_files.update(geom.files)
for path in ['scripts/experiment-hand-registration.py', '.cache/arm-registration/landmarks.json', 'docs/anatomy-alignment/arm-registration-candidate.json']:
    all_files[path] = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
result['files'] = [{'path': p, 'sha256': h} for p, h in all_files.items()]
(ROOT / '.cache/arm-registration/hand-candidates.json').write_text(json.dumps(result, indent=2) + '\n')
