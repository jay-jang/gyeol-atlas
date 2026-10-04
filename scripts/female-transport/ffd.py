# Cubic B-spline free-form deformation with bending-energy regularisation.
import numpy as np, scipy.sparse as sp
from scipy.sparse.linalg import cg
def _basis(t):
    t2, t3 = t * t, t * t * t
    return np.stack([(1 - t) ** 3 / 6, (3 * t3 - 6 * t2 + 4) / 6, (-3 * t3 + 3 * t2 + 3 * t + 1) / 6, t3 / 6], axis=-1)
class FFD:
    def __init__(self, lo, hi, h):
        self.h = h; self.o = np.asarray(lo, float) - 3 * h
        self.n = np.ceil((np.asarray(hi, float) + 3 * h - self.o) / h).astype(int) + 1
        self.coef = np.zeros((int(np.prod(self.n)), 3))
    def _stencil(self, P):
        u = (P - self.o) / self.h; f = np.floor(u).astype(int); t = u - f; b = f - 1
        b = np.clip(b, 0, self.n - 4)
        Bx, By, Bz = _basis(t[:, 0]), _basis(t[:, 1]), _basis(t[:, 2])
        w = (Bx[:, :, None, None] * By[:, None, :, None] * Bz[:, None, None, :]).reshape(len(P), 64)
        a = np.arange(4)
        ix = b[:, 0, None, None, None] + a[None, :, None, None]; iy = b[:, 1, None, None, None] + a[None, None, :, None]; iz = b[:, 2, None, None, None] + a[None, None, None, :]
        idx = ((ix * self.n[1] + iy) * self.n[2] + iz).reshape(len(P), 64)
        return idx, w
    def matrix(self, P):
        idx, w = self._stencil(P); rows = np.repeat(np.arange(len(P)), 64)
        return sp.csr_matrix((w.ravel(), (rows, idx.ravel())), shape=(len(P), len(self.coef)))
    def __call__(self, P, chunk=200000):
        out = np.empty((len(P), 3))
        for s in range(0, len(P), chunk):
            idx, w = self._stencil(P[s:s + chunk]); out[s:s + chunk] = np.einsum('nk,nkc->nc', w, self.coef[idx])
        return out
    def regulariser(self):
        nx, ny, nz = self.n
        def d1(n): return sp.diags([-np.ones(n - 1), np.ones(n - 1)], [0, 1], shape=(n - 1, n))
        def d2(n): return sp.diags([np.ones(n - 2), -2 * np.ones(n - 2), np.ones(n - 2)], [0, 1, 2], shape=(n - 2, n))
        I = sp.identity
        ops = [sp.kron(sp.kron(d2(nx), I(ny)), I(nz)), sp.kron(sp.kron(I(nx), d2(ny)), I(nz)), sp.kron(sp.kron(I(nx), I(ny)), d2(nz))]
        mixed = [sp.kron(sp.kron(d1(nx), d1(ny)), I(nz)), sp.kron(sp.kron(d1(nx), I(ny)), d1(nz)), sp.kron(sp.kron(I(nx), d1(ny)), d1(nz))]
        R = sum((D.T @ D) for D in ops) + 2 * sum((D.T @ D) for D in mixed)
        return R.tocsr()
    def fit(self, P, R, w, lam, x0=None, tol=1e-7, maxiter=3000):
        A = self.matrix(P); W = sp.diags(w)
        M = (A.T @ W @ A + lam * self.regulariser()).tocsr()
        b = A.T @ (w[:, None] * R)
        d = M.diagonal(); pre = sp.diags(1 / np.where(d > 0, d, 1))
        for c in range(3):
            x, info = cg(M, b[:, c], x0=None if x0 is None else x0[:, c], rtol=tol, maxiter=maxiter, M=pre)
            self.coef[:, c] = x
        return self
