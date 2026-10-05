# Load the fitted male->female field: articulated pre-pose + residual B-spline.
import sys, os, json, re, hashlib, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from segments import segment_of
from ffd import FFD
GROUP = {'girdle': 'torso', 'finger': 'forearm', 'hand': 'forearm', 'toes': 'foot'}
def group(seg):
    base, _, side = seg.partition('-'); base = re.sub(r'\d', '', base); g = GROUP.get(base, base); return g if g in ('torso', 'head', 'organ') else f'{g}-{side}'
class Field:
    def __init__(self, path='.cache/female-transport/field.npz', male=None, junctions=True):
        z = np.load(path, allow_pickle=False)
        self.ffd = FFD(np.zeros(3), np.ones(3), float(z['h'])); self.ffd.o = z['o']; self.ffd.n = z['n']; self.ffd.coef = z['coef']
        self.segs = [str(s) for s in z['segs']]; self.sigma = float(z['sigma'])
        self.T = {s: (r[0], r[1:10].reshape(3, 3), r[10:13]) for s, r in zip(self.segs, z['segT'])}
        male = male or load('.cache/female-transport/male-scene'); mby = {p['name']: p for p in male}
        inputs = json.load(open('scripts/model-inputs.json'))['assets']; clouds = {}
        for a in inputs:
            if a['layer'] == 'bone' and a['id'] in mby:
                g = group(segment_of(a['name']))
                if g in self.T: clouds.setdefault(g, []).append(mby[a['id']]['pos'])
        self.trees = {s: cKDTree(np.vstack(clouds[s])) for s in self.segs}
        self.skin = cKDTree(z['skinPoints']); self.residual = z['skinResidual']; self.skinSigma = float(z['skinSigma']); self.skinMass = float(z['skinMass'])
        self.vessel = cKDTree(z['vesselPoints']); self.vresidual = z['vesselResidual']; self.vSigma = float(z['vesselSigma']); self.vMass = float(z['vesselMass'])
        # Junction layer (scripts/female-transport/junction_layer.py), fitted on this field.
        self.junction = None
        jpath = path.replace('field.npz', 'field-junctions.npz')
        if junctions and os.path.exists(jpath):
            jz = np.load(jpath, allow_pickle=False)
            if str(jz['fieldSha256']) != hashlib.sha256(open(path, 'rb').read()).hexdigest():
                raise RuntimeError(f'{jpath} was fitted on another field.npz; re-run junction_layer.py')
            self.junction = {k: (jz[f'{k}Points'], jz[f'{k}Weights'], float(jz[f'{k}Sigma'])) for k in ('artery', 'vein')}
            self.bends = {}
            for i, x, r, w in zip(jz['bendIds'], jz['bendPoints'], jz['bendMoves'], jz['bendWidths']): self.bends.setdefault(str(i), []).append((x, r, float(w)))
    def vessel_layer(self, P, kind=None):
        """Vessel layer for a carried vessel ('artery'/'vein') or lymph ('lymph'); kind None leaves out the junction layer."""
        d, j = self.vessel.query(P, k=64, workers=-1); K = np.exp(-d ** 2 / (2 * self.vSigma ** 2))
        out = (K[:, :, None] * self.vresidual[j]).sum(1) / np.maximum(K.sum(1), self.vMass)[:, None]
        return out + self.junction_layer(P, kind) if self.junction is not None and kind else out
    def root_bend(self, structure, P):
        """The bend of one carried vessel near its origin (junction_layer.py), zero for others."""
        out = np.zeros_like(P)
        for x, r, w in (self.bends.get(structure, []) if self.junction is not None else []):
            out += np.exp(-((P - x) ** 2).sum(1) / (2 * w ** 2))[:, None] * r
        return out
    def junction_layer(self, P, kind):
        X, Wt, s = self.junction['artery' if kind == 'lymph' else kind]; out = np.zeros_like(P)
        if not len(X): return out
        for i in range(0, len(P), 50000):
            K = np.exp(-((P[i:i + 50000, None, :] - X[None]) ** 2).sum(2) / (2 * s ** 2)); out[i:i + 50000] = (K @ Wt) / np.maximum(K.sum(1), 1)[:, None]
        return out
    def skin_layer(self, P):
        d, j = self.skin.query(P, k=64, workers=-1); K = np.exp(-d ** 2 / (2 * self.skinSigma ** 2))
        return (K[:, :, None] * self.residual[j]).sum(1) / np.maximum(K.sum(1), self.skinMass)[:, None]
    def prepose(self, P):
        D = np.stack([self.trees[s].query(P, workers=-1)[0] for s in self.segs], axis=1)
        dmin = D.min(1, keepdims=True); w = np.exp(-(D ** 2 - dmin ** 2) / (2 * self.sigma ** 2)); w /= w.sum(1, keepdims=True)
        out = np.zeros_like(P)
        for k, s in enumerate(self.segs):
            sc, R, t = self.T[s]; out += w[:, k:k+1] * (sc * P @ R.T + t)
        return out
    def __call__(self, P, chunk=300000):
        out = np.empty_like(P)
        for i in range(0, len(P), chunk):
            Q = self.prepose(P[i:i+chunk]); out[i:i+chunk] = Q + self.ffd(Q) + self.skin_layer(P[i:i+chunk])
        return out
