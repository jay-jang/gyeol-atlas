"""Offline comparison of skin-area samples and bone-adjacency wrist pivots.

Keeps each bone rigid up to a segment-wide donor scale. Shoulder and wrist proxy
positions and both segment lengths are constrained. Skin only selects elbow
swivel and forearm twist; joint contacts and containment are separate screens.
"""
import hashlib
import importlib.util
import json
import sys
from pathlib import Path
import numpy as np
from scipy.optimize import least_squares
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation

ROOT = Path(__file__).resolve().parents[1]


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


geom = module('geom', 'scripts/experiment-arm-landmarks.py')
kin = module('kin', 'scripts/lib/arm-kinematics.py')
sampling = module('sampling', 'scripts/lib/surface-sampling.py')
paths = ['docs/anatomy-alignment/hand-candidates.json', '.cache/arm-registration/wrist-joints.json', '.cache/arm-registration/landmarks.json']
hand_report, joints, landmarks = [json.loads((ROOT / p).read_text()) for p in paths]
files = {}
for report in [hand_report, joints, landmarks]:
    for f in report['files']:
        assert hashlib.sha256((ROOT / f['path']).read_bytes()).hexdigest() == f['sha256'], f['path']
        files[f['path']] = f['sha256']
male = geom.read_atlas('.cache/male-details/atlas.json')
female = geom.read_atlas('public/models/female/atlas-female.json')
skins = {label: geom.mesh(atlas, next(p for p in atlas['parts'] if p['name'] == 'Skin'), folder)
         for label, atlas, folder in [('source', male, '.cache/arm-registration'), ('target', female, 'public/models/female')]}


def forearm_cloud(label, side, wrist, length, axis):
    profile = next(p for p in landmarks['profiles'] if p['body'] == label and p['side'] == side)
    points, triangles = skins[label]
    faces, arm = geom.distal_arm(points, triangles, 1 if side == 'left' else -1, profile['cutY'])
    if area_samples:
        arm, _, _ = sampling.sample_surface(points, faces, 8000, 20260920 + (side == 'right'))
    projection = (arm - wrist) @ axis
    cloud = arm[(projection < -.005) & (projection > -length + .005)]
    if area_samples:
        assert len(cloud) > 100
        return cloud
    _, used = np.unique(np.floor(cloud / .004).astype(int), axis=0, return_index=True)
    assert len(used) > 100
    return cloud[used]


def measure(a, b):
    distance = cKDTree(b).query(a)[0] * 1000
    return {'medianMm': float(np.median(distance)), 'p95Mm': float(np.quantile(distance, .95)), 'maxMm': float(distance.max())}


keep_upper = True
coupled_hand = False
area_samples = '--surface-area' in sys.argv
wrist_contact = '--wrist-contact' in sys.argv
assert not (set(sys.argv[1:]) - {'--surface-area', '--wrist-contact'}), 'Unknown experiment mode'
assert area_samples or wrist_contact, 'Choose at least one controlled change'
prefix = 'joint-area-upper' if area_samples and wrist_contact else 'area-upper' if area_samples else 'joint-upper'
report = {'status': 'EXPERIMENT ONLY: two-link endpoint constraints are not anatomical joint validation',
          'mode': prefix, 'areaSamples': area_samples, 'boneAdjacencyWrist': wrist_contact,
          'fitRegion': 'same source/target forearm skin region as previous candidate; hand fit remains unchanged',
          'limitations': ['Proxy closure is not articular contact or collision validation.',
                          'Area mode samples all chosen skin faces, including any inner skin surface; no outer-envelope segmentation is claimed.',
                          'Shoulder target is inherited from the deployed donor girdle, not a newly validated female landmark.',
                          'Upper twist stays closest to its deployed orientation; elbow/wrist contact constraints and finger articulation are not optimized.'],
          'arms': []}
for hand in hand_report['arms']:
    side = hand['side']
    joint = next(a for a in joints['arms'] if a['side'] == side)
    S, E, W = np.array(joint['shoulder']['centre']), np.array(joint['elbow']), np.array(hand['sourceWrist'])
    skin_wrist = W.copy()
    target_wrist = np.array(hand['targetWrist'])
    skin_forearm_length = np.linalg.norm(skin_wrist - E)
    if wrist_contact:
        W = np.array(joint['wrist'])
        target_wrist = W @ np.array(hand['linearFromDonor']) + np.array(hand['translationFromDonor'])
    scale = hand['scaleFromDonor']
    placements = {}
    for part in hand['parts']:
        donor = next(p for p in male['parts'] if p['id'] == part['sourceId'])
        host = next(p for p in female['parts'] if p['id'] == part['id'])
        original, tri = geom.mesh(male, donor, '.cache/arm-registration')
        current, host_tri = geom.mesh(female, host, 'public/models/female')
        assert np.array_equal(tri, host_tri)
        existing = np.linalg.lstsq(np.c_[original, np.ones(len(original))], current, rcond=None)[0]
        assert np.max(np.linalg.norm(np.c_[original, np.ones(len(original))] @ existing - current, axis=1)) < 1e-6
        placements[part['id']] = existing
    humerus = next(p for p in hand['parts'] if p['name'].lower() == f'{side} humerus')
    existing = placements[humerus['id']]
    target_shoulder = S @ existing[:3] + existing[3]
    upper_length, forearm_length = np.linalg.norm(E - S), np.linalg.norm(W - E)
    hand_rotation = np.array(hand['linearFromDonor']).T / scale
    old_scale = np.cbrt(np.linalg.det(existing[:3]))
    old_rotation = Rotation.from_matrix(existing[:3].T / old_scale).as_matrix()
    upper_scale = float(old_scale) if keep_upper else scale
    centre, radius, u, v = kin.elbow_circle(target_shoulder, target_wrist, upper_length * upper_scale, forearm_length * scale)
    source = forearm_cloud('source', side, skin_wrist, skin_forearm_length, (skin_wrist - E) / skin_forearm_length)
    target_profile = next(p for p in landmarks['profiles'] if p['body'] == 'target' and p['side'] == side)
    target = forearm_cloud('target', side, np.array(hand['targetWrist']), skin_forearm_length * scale, np.array(target_profile['axis']))
    tree = cKDTree(target)

    def transforms(params):
        elbow = centre + radius * (u * np.cos(params[0]) + v * np.sin(params[0]))
        forearm = kin.endpoint_transform(E, W, elbow, target_wrist, hand_rotation, params[1])
        upper = kin.endpoint_transform(S, E, target_shoulder, elbow, old_rotation)
        return elbow, forearm, upper

    def moved(params):
        _, (linear, translation), _ = transforms(params)
        return source @ linear + translation

    def score(params):
        cloud = moved(params)
        return float(np.mean(tree.query(cloud)[0]**2) + np.mean(cKDTree(cloud).query(target)[0]**2))

    starts = [np.array([swivel, twist]) for swivel in np.arange(-np.pi, np.pi, np.pi / 4) for twist in [-np.pi / 4, 0, np.pi / 4]]
    starts = sorted(starts, key=score)[:6]
    solutions = []
    for initial in starts:
        params = initial.copy()
        for iteration in range(50):
            current = moved(params)
            forward = tree.query(current)[1]
            reverse = cKDTree(current).query(target)[1]
            balance = np.sqrt(len(source) / len(target))

            def residual(x):
                cloud = moved(x)
                return np.r_[(cloud - target[forward]).ravel(), ((cloud[reverse] - target) * balance).ravel()]

            fit = least_squares(residual, params, loss='soft_l1', f_scale=.004, max_nfev=25,
                                bounds=([-2 * np.pi, -np.pi], [2 * np.pi, np.pi]))
            delta = np.linalg.norm(fit.x - params)
            params = fit.x
            if delta < 1e-7:
                break
        solutions.append((score(params), params, iteration + 1))
    _, params, iterations = min(solutions, key=lambda r: r[0])
    elbow, forearm, upper = transforms(params)
    # The same source proxy must map identically on the two sides of each link.
    closures = [np.linalg.norm(S @ upper[0] + upper[1] - target_shoulder),
                np.linalg.norm(E @ upper[0] + upper[1] - (E @ forearm[0] + forearm[1])),
                np.linalg.norm(W @ forearm[0] + forearm[1] - target_wrist)]
    assert max(closures) < 1e-12
    parts = []
    for part in hand['parts']:
        name = part['name'].lower()
        row = {**part}
        group = 'upper' if name == f'{side} humerus' else 'forearm' if name in [f'{side} radius', f'{side} ulna'] else 'hand' if part['transformed'] else 'fixed'
        if coupled_hand and group == 'hand':
            group = 'forearm'
        row['group'] = group
        if group in ['upper', 'forearm']:
            linear, translation = upper if group == 'upper' else forearm
            placement = placements[part['id']]
            corrected = np.linalg.solve(placement[:3], linear)
            offset = translation - placement[3] @ corrected
            row.update(transformed=True, linear=corrected.tolist(), translation=offset.tolist())
        parts.append(row)
    assert sum(p['transformed'] for p in parts) == 30
    row = {'side': side, 'parts': parts, 'scaleFromDonor': scale, 'upperScaleFromDonor': upper_scale, 'sourceShoulder': S.tolist(), 'sourceElbow': E.tolist(),
           'sourceWrist': W.tolist(), 'sourceSkinWrist': skin_wrist.tolist(), 'sourceWristOffsetFromSkinMm': float(np.linalg.norm(W - skin_wrist) * 1000), 'targetShoulder': target_shoulder.tolist(), 'targetElbow': elbow.tolist(),
           'targetWrist': target_wrist.tolist(), 'circleRadiusMm': float(radius * 1000), 'closureErrorsMm': [float(c * 1000) for c in closures],
           'swivelDegrees': float(np.rad2deg(params[0])), 'twistDegrees': float(np.rad2deg(params[1])), 'iterations': iterations,
           'sourcePoints': len(source), 'targetPoints': len(target), 'after': measure(moved(params), target),
           'reverseAfter': measure(target, moved(params))}
    report['arms'].append(row)
    print(json.dumps({k: v for k, v in row.items() if k != 'parts'}))
files.update(geom.files)
for path in paths + ['scripts/experiment-joint-anchored-arm.py', 'scripts/lib/arm-kinematics.py', 'scripts/lib/surface-sampling.py']:
    files[path] = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
report['files'] = [{'path': p, 'sha256': h} for p, h in files.items()]
(ROOT / f'.cache/arm-registration/{prefix}-candidates.json').write_text(json.dumps(report, indent=2) + '\n')
