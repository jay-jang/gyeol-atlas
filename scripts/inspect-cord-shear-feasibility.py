"""Check the actual linearized targets; infeasibility is not anatomical impossibility."""
import gzip
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
import scipy
from scipy.optimize import linprog

tag = 'cord-shear-seeded' if '--section-seed' in sys.argv else 'cord-shear'
fit_file = Path(f'docs/anatomy-alignment/{tag}-fit.json')
fit = json.loads(fit_file.read_text())
rows = json.loads(gzip.decompress(Path(fit['constraintsFile']).read_bytes()))
a = np.array([r['a'] for r in rows])
b = np.array([r['b'] for r in rows])
n = a.shape[1]
bound = fit['coefficientBoundMm']/1000
primal = linprog(np.zeros(n), A_ub=-a, b_ub=-b, bounds=[(-bound, bound)]*n, method='highs')
# A nonnegative weighted sum of the inequalities with zero left-hand side and
# positive right-hand side is a contradiction for this finite linear system.
all_a = np.concatenate([a, np.eye(n), -np.eye(n)])
all_b = np.concatenate([b, np.full(2*n, -bound)])
dual = linprog(-all_b, A_eq=np.vstack([all_a.T, np.ones(len(all_b))]), b_eq=np.r_[np.zeros(n), 1.0], bounds=(0, None), method='highs')
certificate = None
if dual.success:
    weights = dual.x
    positive = np.flatnonzero(weights > 0)
    certificate = {'weightedNormal': (weights@all_a).tolist(), 'positiveBoundM': float(weights@all_b),
                   'weightSum': float(weights.sum()), 'rows': []}
    for i in positive:
        row = {'index': int(i), 'weight': float(weights[i]), 'a': all_a[i].tolist(), 'b': float(all_b[i])}
        row['source'] = rows[i] if i < len(rows) else {'coefficientBound': int(i-len(rows))}
        certificate['rows'].append(row)
result = {'scope': 'Finite nearest-surface tangent constraints with fixed coefficient bounds, not proof that a valid cord pose or another nonlinear model is impossible.',
          'scipyVersion': scipy.__version__, 'constraints': len(rows), 'variables': n,
          'primal': {'status': int(primal.status), 'success': bool(primal.success), 'message': primal.message},
          'dual': {'status': int(dual.status), 'success': bool(dual.success), 'message': dual.message},
          'certificate': certificate,
          'files': [{'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [fit_file, Path(fit['constraintsFile']), Path(__file__).relative_to(Path.cwd()) if Path(__file__).is_absolute() else Path(__file__)]]}
Path(f'docs/anatomy-alignment/{tag}-feasibility.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'primal': result['primal'], 'dual': result['dual'], 'rows': len(certificate['rows']) if certificate else None,
                  'positiveBoundMm': certificate['positiveBoundM']*1000 if certificate else None,
                  'normalResidual': max(abs(v) for v in certificate['weightedNormal']) if certificate else None,
                  'sources': [{'weight': r['weight'], 'source': {k: v for k, v in r['source'].items() if k in ['cordId', 'boneId', 'vertex', 'kind', 'normal', 'original', 'coefficientBound']}} for r in certificate['rows']] if certificate else None}))
