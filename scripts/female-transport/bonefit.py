import numpy as np
from scipy.spatial import cKDTree
def umeyama(src, dst, w=None):
    if w is None: w = np.ones(len(src))
    w = w / w.sum()
    ms, md = (w[:,None]*src).sum(0), (w[:,None]*dst).sum(0)
    s0, d0 = src - ms, dst - md
    cov = (w[:,None]*d0).T @ s0
    U, S, Vt = np.linalg.svd(cov)
    D = np.eye(3); D[2,2] = np.sign(np.linalg.det(U @ Vt))
    R = U @ D @ Vt
    var = (w*(s0**2).sum(1)).sum()
    s = np.trace(np.diag(S) @ D) / var
    t = md - s * R @ ms
    return s, R, t
def apply(T, p): s, R, t = T; return s * p @ R.T + t
def icp(src, dst, T0, iters=40, trim=0.9, tree=None, scale=True):
    tree = tree or cKDTree(dst)
    src_tree = cKDTree(src)
    T = T0
    for _ in range(iters):
        q = apply(T, src)
        d1, j1 = tree.query(q)
        # symmetric: female points to their nearest transformed male points
        qt = cKDTree(q); d2, j2 = qt.query(dst)
        A = np.vstack([src, src[j2]]); B = np.vstack([dst[j1], dst]); d = np.concatenate([d1, d2])
        keep = d <= np.quantile(d, trim)
        Tn = umeyama(A[keep], B[keep])
        if not scale: Tn = (1.0, Tn[1], Tn[2]) if False else Tn
        T = Tn
    q = apply(T, src); d1, _ = tree.query(q); d2, _ = cKDTree(q).query(dst)
    return T, float(np.sqrt(np.mean(np.concatenate([d1, d2])**2))), float(np.quantile(np.concatenate([d1,d2]), .95))
def init_centroid(src, dst):
    ms, md = src.mean(0), dst.mean(0)
    s = np.sqrt(((dst-md)**2).sum(1).mean() / ((src-ms)**2).sum(1).mean())
    return (s, np.eye(3), md - s*ms)
