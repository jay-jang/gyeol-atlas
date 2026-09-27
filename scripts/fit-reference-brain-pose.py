"""Offline common rigid brain pose: skull-label avoidance, fixed interface limits.

Label membership is not pure bone tissue or a validated anatomical objective.
Both interface-constrained and unconstrained trials are retained, never deployed.
"""
import gzip
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from scipy import ndimage
from scipy.spatial.transform import Rotation
from scipy.optimize import minimize

assert sys.argv[1:] in ([], ['--all-vertices'])
full = bool(sys.argv[1:])
out = Path('.cache/brain-pose-full' if full else '.cache/brain-pose')
out.mkdir(parents=True, exist_ok=True)
tracked = {}


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def read(path):
    tracked[str(path)] = sha(path)
    return json.loads(Path(path).read_text())


anchors = read('.cache/brain-pose/anchors.json')
ct = read('.cache/bonehub-head-ct/report.json')
head = read('.cache/bonehub-head/frame.json')
for r in [anchors, ct, head]:
    for f in r['files']:
        assert sha(f['file']) == f['sha256'], f['file']
parts = json.loads(gzip.decompress(Path(anchors['parts']).read_bytes()))
tracked[anchors['parts']] = sha(anchors['parts'])
moving = [p for p in parts if p['id'] in anchors['movingIds']]
assert len(moving) == 282
mask = np.load(ct['crop']['mask'])
inside = mask == 1
spacing = np.array(ct['crop']['spacingXYZmm'])
distance = np.where(inside, ndimage.distance_transform_edt(inside, sampling=spacing[::-1]),
                    -ndimage.distance_transform_edt(~inside, sampling=spacing[::-1])).astype(np.float32)
field_file = out/'skull-label-signed-distance.npy'
np.save(field_file, distance)
tracked[str(field_file)] = sha(field_file)
lo = np.array(ct['crop']['minXYZ'])
inverse = np.linalg.inv(np.array(next(c for c in head['candidates'] if c['mode'] == 'rigid')['matrixColumnMajor']).reshape(4, 4, order='F'))
pivot = np.array(anchors['pivot'])*1000
ap = np.array([a['point'] for pair in anchors['interfaces'] for a in pair['anchors']])*1000
at = np.array([a['targetPoint'] for pair in anchors['interfaces'] for a in pair['anchors']])*1000
baseline_distances = np.linalg.norm(ap-at, axis=1)
samples, sample_counts = [], []
for p in moving:
    used = np.unique(p['indices'])
    indices = used if full else used[np.linspace(0, len(used)-1, min(64, len(used))).astype(int)]
    samples.append(np.array(p['positions']).reshape(-1, 3)[indices]*1000)
    sample_counts.append({'id': p['id'], 'sampleVertices': len(indices), 'referencedVertices': len(used)})
samples = np.concatenate(samples)


def transform(parameters):
    r = Rotation.from_euler('xyz', parameters[3:], degrees=True).as_matrix()
    t = pivot+parameters[:3]-r@pivot
    return r, t


def apply(points, parameters):
    r, t = transform(np.array(parameters))
    return points@r.T+t


def metrics(parameters, points=samples):
    moved = apply(points, parameters)
    native = (moved/1000@inverse[:3, :3].T+inverse[:3, 3])*1000
    local = native/spacing-lo
    outside = ((local < 0) | (local > np.array(mask.shape[::-1])-1)).any(axis=1)
    values = ndimage.map_coordinates(distance, local[:, ::-1].T, order=1, mode='nearest', output=np.float64)
    adjusted = apply(ap, parameters)
    displacement = np.linalg.norm(adjusted-ap, axis=1)
    distance_increase = np.linalg.norm(adjusted-at, axis=1)-baseline_distances
    return {'samplePositiveFieldVertices': int((values > 0).sum()), 'outsideCrop': int(outside.sum()),
            'meanSquaredPositiveFieldMm': float(np.mean(np.maximum(values, 0)**2)),
            'maxAnchorDisplacementMm': float(displacement.max()), 'maxPairedDistanceIncreaseMm': float(distance_increase.max())}


zero = [0.]*6
results = []
for constrained in [False, True]:
    trials, cache = [], {}

    def evaluate(parameters):
        parameters = [float(v) for v in parameters]
        key = tuple(parameters)
        if key in cache:
            return cache[key]
        if np.linalg.norm(parameters[:3]) > 8+1e-10 or max(abs(v) for v in parameters[3:]) > 10:
            return None
        a = apply(ap, parameters)
        displacement = np.max(np.linalg.norm(a-ap, axis=1))
        increase = np.max(np.linalg.norm(a-at, axis=1)-baseline_distances)
        if constrained and (displacement > 2+1e-8 or increase > 1+1e-8):
            return None
        m = metrics(parameters)
        regularizer = .001*sum(v*v for v in parameters[:3])+.0001*sum(v*v for v in parameters[3:])
        row = {'parameters': parameters, **m, 'regularizer': regularizer, 'score': m['meanSquaredPositiveFieldMm']+regularizer}
        trials.append(row)
        cache[key] = row if m['outsideCrop'] == 0 else None
        return cache[key]

    def better(a, b):
        return a is not None and (b is None or a['score'] < b['score']-1e-10)

    best = evaluate(zero)
    assert best is not None
    # Identical deterministic seed family for both constraints.
    for x in [-4, 0, 4]:
        for y in [-4, 0, 4]:
            for z in [-4, 0, 4]:
                candidate = evaluate([0, 0, 0, x, y, z])
                if better(candidate, best):
                    best = candidate
    stages = []
    for step in [2, 1, .5, .25, .125, .0625]:
        iterations = 0
        while iterations < 40:
            iterations += 1
            current = best
            for k in range(6):
                for direction in [-1, 1]:
                    p = current['parameters'].copy()
                    p[k] += direction*step
                    candidate = evaluate(p)
                    if better(candidate, best):
                        best = candidate
            if best is current:
                break
        stages.append({'stepMmOrDegrees': step, 'iterations': iterations, 'stopReason': 'no improving coordinate neighbor' if best is current else 'iteration limit'})
    solvers = []
    if full:
        def objective(parameters):
            m = metrics(parameters)
            return m['meanSquaredPositiveFieldMm']+.001*np.sum(parameters[:3]**2)+.0001*np.sum(parameters[3:]**2)+1000*m['outsideCrop']

        def constraints(parameters):
            a = apply(ap, parameters)
            values = [64-np.sum(parameters[:3]**2)]
            if constrained:
                values.extend(4-np.sum((a-ap)**2, axis=1))
                values.extend((baseline_distances+1)**2-np.sum((a-at)**2, axis=1))
            return np.array(values)

        for seed in [zero, best['parameters'].copy()]:
            solved = minimize(objective, np.array(seed), method='SLSQP', bounds=[(-8, 8)]*3+[(-10, 10)]*3,
                              constraints=[{'type': 'ineq', 'fun': constraints}], options={'maxiter': 150, 'ftol': 1e-9, 'eps': 1e-3})
            candidate = evaluate(solved.x)
            backtrack = None
            # A solver may stop nanometres outside the explicit budgets. Do not
            # relax those budgets: test poses along the parameter ray toward the
            # known feasible zero pose, and keep only a re-evaluated feasible one.
            if constrained and candidate is None:
                for k in range(20):
                    alpha = 1-1e-6*2**k
                    if alpha <= 0:
                        break
                    projected = solved.x*alpha
                    candidate = evaluate(projected)
                    backtrack = {'parameterFraction': alpha, 'parameters': projected.tolist(), 'feasible': candidate is not None, 'metrics': metrics(projected)}
                    if candidate is not None:
                        break
            retained = better(candidate, best)
            if retained:
                best = candidate
            solvers.append({'success': bool(solved.success), 'status': int(solved.status), 'message': str(solved.message), 'iterations': int(solved.nit),
                            'evaluations': int(solved.nfev), 'parameters': solved.x.tolist(), 'minimumConstraintValue': float(constraints(solved.x).min()),
                            'rawSolverFeasible': evaluate(solved.x) is not None, 'feasibilityBacktrack': backtrack,
                            'feasible': candidate is not None, 'retainedAsBest': retained, 'metrics': metrics(solved.x)})
            print(json.dumps({'full': full, 'constrained': constrained, 'solver': solvers[-1]}), flush=True)
    r, t = transform(np.array(best['parameters']))
    matrix = np.eye(4)
    matrix[:3, :3], matrix[:3, 3] = r, t/1000
    result = {'mode': 'anchored' if constrained else 'unconstrained', 'best': best, 'matrixColumnMajor': matrix.flatten(order='F').tolist(), 'stages': stages, 'coupledSolvers': solvers, 'trials': trials}
    results.append(result)
    print(json.dumps({'mode': result['mode'], 'trials': len(trials), 'best': best}), flush=True)

snapshots = []
for mode, parameters in [('baseline', zero)]+[(r['mode'], r['best']['parameters']) for r in results]:
    r, t = transform(np.array(parameters))
    matrix = np.eye(4)
    matrix[:3, :3], matrix[:3, 3] = r, t/1000
    snapshot_parts = []
    for p in moving:
        # Same order as runtime Matrix4 application; round each saved coordinate
        # once to Float32, without altering index order or any fixed anatomy.
        positions = np.array(p['positions']).reshape(-1, 3)
        positions = (positions@r.T+t/1000).astype(np.float32)
        snapshot_parts.append({'id': p['id'], 'sourceGeometryId': p['sourceGeometryId'], 'positions': positions.ravel().tolist(), 'indices': p['indices']})
    saved_points = np.concatenate([np.array(p['positions']).reshape(-1, 3)[np.unique(p['indices'])] for p in snapshot_parts])*1000
    native = (saved_points/1000@inverse[:3, :3].T+inverse[:3, 3])*1000
    voxel = np.floor(native/spacing+.5).astype(int)-lo
    in_crop = ((voxel >= 0) & (voxel < np.array(mask.shape[::-1]))).all(axis=1)
    values = mask[voxel[in_crop, 2], voxel[in_crop, 1], voxel[in_crop, 0]]
    snapshots.append({'mode': mode, 'matrixColumnMajor': matrix.flatten(order='F').tolist(), 'parts': snapshot_parts,
                      'fullVertexMembership': {'vertices': len(saved_points), 'outsideCrop': int((~in_crop).sum()), 'nearestLabelCounts': np.bincount(values, minlength=3).tolist()}})
payload = out/'candidate-parts.json.gz'
payload.write_bytes(gzip.compress(json.dumps(snapshots).encode(), mtime=0))
tracked[str(payload)] = sha(payload)
tracked[__file__] = sha(__file__)
report = {'status': 'Offline whole-reference-brain rigid trials only; no runtime export or anatomical acceptance',
          'fullVertexObjective': full,
          'baseline': metrics(zero), 'pivotAtlasMm': pivot.tolist(), 'movingIds': anchors['movingIds'], 'sampleCounts': sample_counts, 'sampleVertices': len(samples),
          'limits': {'translationNormMm': 8, 'eachExtrinsicXyzAngleDegrees': 10, 'anchoredMaximumDisplacementMm': 2, 'anchoredMaximumPairedDistanceIncreaseMm': 1},
          'objective': 'Mean squared positive trilinear voxel-centre signed distance to skull label1 plus parameter regularizer; not pure bone tissue or a validated anatomical fitting target',
          'candidates': results, 'snapshots': [{k: v for k, v in s.items() if k != 'parts'} for s in snapshots], 'parts': str(payload),
          'limitations': ['The two interface budgets are numerical trial settings, not physiological or clinical thresholds; baseline interfaces already have gaps.',
                         'Fixed baseline point pairs discourage separation but do not establish valid tissue attachments or all neural connections.',
                         'No scale, per-part motion, vertex deletion or deformation is used. All 282 Allen reference meshes share one rigid transform.',
                         'Sampled mode caps each part at64 referenced vertices; full mode includes every referenced vertex. Neither is uniform surface-area sampling. Final triangle/skin interfaces require a separate audit.',
                         'Only the native skull rigid candidate frame is used for optimization. Current borrowed bones must also be audited before any consideration of runtime changes.',
                         'Coordinate descent and full-mode SLSQP termination are not global optimality or an infeasibility proof. A nonfeasible constrained solver result may be parameter-backtracked toward zero; only a rechecked feasible lower-score pose can replace the incumbent.'],
          'files': [{'file': f, 'sha256': h} for f, h in tracked.items()]}
(out/'fit.json').write_text(json.dumps(report, indent=2)+'\n')
