"""Reproducible triangle-area sampling. Samples geometry, not anatomical labels."""
import numpy as np


def sample_surface(points, triangles, count, seed=0):
    points, triangles = np.asarray(points, float), np.asarray(triangles)
    if points.ndim != 2 or points.shape[1] != 3 or not np.isfinite(points).all():
        raise ValueError('Expected finite Nx3 points')
    if triangles.ndim != 2 or triangles.shape[1] != 3 or not np.issubdtype(triangles.dtype, np.integer):
        raise ValueError('Expected integer Mx3 triangles')
    if count <= 0 or not isinstance(count, int) or triangles.size == 0:
        raise ValueError('Empty sample request')
    if triangles.min() < 0 or triangles.max() >= len(points):
        raise ValueError('Invalid triangle index')
    tri = points[triangles]
    areas = np.linalg.norm(np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]), axis=1) / 2
    total = areas.sum()
    if not np.isfinite(total) or total <= 0:
        raise ValueError('No nondegenerate surface')
    rng = np.random.default_rng(seed)
    ids = np.searchsorted(np.cumsum(areas), rng.random(count) * total, side='right')
    uv = rng.random((count, 2))
    s = np.sqrt(uv[:, 0])
    barycentric = np.c_[1 - s, s * (1 - uv[:, 1]), s * uv[:, 1]]
    samples = np.einsum('ij,ijk->ik', barycentric, tri[ids])
    return samples, ids, barycentric
