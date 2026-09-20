"""Separate closed triangle/plane contours; never merge fingers with a hull.

This measures surface geometry, not anatomical joint centres. Degenerate plane
contacts or open/branched contours are rejected instead of silently repaired.
"""
import numpy as np
from itertools import product


def closed_sections(points, triangles, origin, axis, basis, weld=1e-7):
    points, triangles = np.asarray(points, float), np.asarray(triangles)
    origin, axis, basis = np.asarray(origin, float), np.asarray(axis, float), np.asarray(basis, float)
    if (points.ndim != 2 or points.shape[1] != 3 or not np.isfinite(points).all()
            or triangles.ndim != 2 or triangles.shape[1] != 3
            or not np.issubdtype(triangles.dtype, np.integer)
            or triangles.size == 0 or triangles.min() < 0 or triangles.max() >= len(points)):
        raise ValueError('Invalid triangle mesh')
    if origin.shape != (3,) or axis.shape != (3,) or basis.shape != (2, 3):
        raise ValueError('Invalid section frame')
    frame = np.vstack([axis, basis])
    if not np.isfinite(origin).all() or not np.isfinite(frame).all() or not np.allclose(frame @ frame.T, np.eye(3), atol=1e-9):
        raise ValueError('Expected orthonormal section frame')
    if not np.isfinite(weld) or weld <= 0:
        raise ValueError('Invalid weld tolerance')
    tri = points[triangles]
    d = (tri - origin) @ axis
    crossing = (d.min(axis=1) <= 0) & (d.max(axis=1) >= 0)
    tri, d = tri[crossing], d[crossing]
    if not len(tri):
        return []
    if np.any(np.abs(d) < 1e-12):
        raise ValueError('Plane touches mesh vertex; choose an explicitly recorded offset')
    vertices, graph, buckets, segments = {}, {}, {}, set()
    neighbours = list(product([-1, 0, 1], repeat=3))

    def vertex_key(p):
        cell = tuple(np.floor(p / weld).astype(np.int64))
        matches = []
        for delta in neighbours:
            neighbour = tuple(cell[i] + delta[i] for i in range(3))
            matches.extend(k for k in buckets.get(neighbour, []) if np.linalg.norm(vertices[k] - p) <= weld)
        if len(matches) > 1:
            raise ValueError('Ambiguous contour welding')
        if matches:
            return matches[0]
        key = len(vertices)
        vertices[key] = p
        buckets.setdefault(cell, []).append(key)
        return key

    for face, dist in zip(tri, d):
        ends = []
        for a, b in [(0, 1), (1, 2), (2, 0)]:
            if dist[a] * dist[b] < 0:
                p = face[a] + dist[a] / (dist[a] - dist[b]) * (face[b] - face[a])
                ends.append(vertex_key(p))
        if len(ends) != 2 or ends[0] == ends[1]:
            raise ValueError('Degenerate section segment')
        segment = tuple(sorted(ends))
        if segment in segments:
            raise ValueError('Duplicate contour segment')
        segments.add(segment)
        for a, b in [ends, ends[::-1]]:
            graph.setdefault(a, set()).add(b)
    if any(len(neighbours) != 2 for neighbours in graph.values()):
        raise ValueError('Open or branched section contour')
    unused, result = set(graph), []
    while unused:
        first = min(unused)
        ring, previous, current = [], None, first
        while True:
            if current in ring:
                raise ValueError('Self-repeating contour')
            ring.append(current)
            options = sorted(graph[current] - ({previous} if previous is not None else set()))
            previous, current = current, options[0]
            if current == first:
                break
        unused.difference_update(ring)
        xyz = np.array([vertices[k] for k in ring])
        xy = (xyz - origin) @ basis.T
        other = np.roll(xy, -1, axis=0)
        cross = xy[:, 0] * other[:, 1] - other[:, 0] * xy[:, 1]
        area = cross.sum() / 2
        if abs(area) < weld * weld:
            raise ValueError('Zero-area contour')
        centre = ((xy + other) * cross[:, None]).sum(axis=0) / (6 * area)
        result.append({'areaMm2': float(abs(area) * 1e6),
                       'centroid': (origin + centre @ basis).tolist(),
                       'perimeterMm': float(np.linalg.norm(other - xy, axis=1).sum() * 1000),
                       'vertices': xyz.tolist()})
    return sorted(result, key=lambda r: tuple(r['centroid']))
