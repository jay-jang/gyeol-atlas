# Load the fitted male->female field: articulated pre-pose + residual B-spline.
import sys, json, re, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scipy.spatial import cKDTree
from scene import load
from segments import segment_of
from ffd import FFD
GROUP = {'girdle': 'torso', 'finger': 'forearm', 'hand': 'forearm', 'toes': 'foot'}
def group(seg):
    base, _, side = seg.partition('-'); base = re.sub(r'\d', '', base); g = GROUP.get(base, base); return g if g in ('torso', 'head', 'organ') else f'{g}-{side}'
class Field:
    def __init__(self, path='.cache/female-transport/field.npz', male=None):
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
