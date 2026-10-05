# Inside test for closed meshes: the generalised winding number (sum of the
# solid angles of the triangles seen from the point, over 4 pi). Robust near
# thin tubes, where the normal of the nearest surface point can face away.
import numpy as np
def winding(Q, V, T, chunk=256):
    out = np.empty(len(Q))
    for i in range(0, len(Q), chunk):
        q = Q[i:i + chunk]; A = V[T[:, 0]][None] - q[:, None]; B = V[T[:, 1]][None] - q[:, None]; C = V[T[:, 2]][None] - q[:, None]
        a, b, c = np.linalg.norm(A, axis=2), np.linalg.norm(B, axis=2), np.linalg.norm(C, axis=2)
        det = (A * np.cross(B, C)).sum(2); den = a * b * c + (A * B).sum(2) * c + (B * C).sum(2) * a + (C * A).sum(2) * b
        out[i:i + chunk] = np.arctan2(det, den).sum(1) / (2 * np.pi)
    return out
def inside_any(Q, parts, threshold=0.4):
    """True where a point lies inside (or on) any of the closed meshes (pos, tri);
    a point on the surface has winding number 1/2."""
    return np.any([np.abs(winding(Q, p['pos'], p['tri'])) > threshold for p in parts], axis=0)
def surface_samples(p, n, rng):
    """Area-weighted points on a mesh surface (pos, tri), with its vertices."""
    T = p['tri']; A = p['pos'][T[:, 0]]; B = p['pos'][T[:, 1]]; C = p['pos'][T[:, 2]]
    area = np.linalg.norm(np.cross(B - A, C - A), axis=1); k = rng.choice(len(T), n, p=area / area.sum())
    u, v = rng.random(n), rng.random(n); f = u + v > 1; u[f], v[f] = 1 - u[f], 1 - v[f]
    return np.vstack([p['pos'], A[k] + u[:, None] * (B[k] - A[k]) + v[:, None] * (C[k] - A[k])])
