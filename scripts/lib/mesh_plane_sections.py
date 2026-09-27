"""Exact triangle/axis-plane diagnostic sections; no filled tissue inference."""
import numpy as np


def sections(positions, indices, axis, coordinate, epsilon=1e-8):
    assert isinstance(axis, (int, np.integer)) and axis in (0, 1, 2)
    assert np.isfinite(epsilon) and epsilon >= 0
    positions = np.asarray(positions, dtype=np.float64)
    raw_indices = np.asarray(indices)
    assert np.issubdtype(raw_indices.dtype, np.integer) and raw_indices.size > 0 and raw_indices.size % 3 == 0
    triangles = raw_indices.astype(np.int64).reshape(-1, 3)
    assert positions.ndim == 2 and positions.shape[1] == 3
    assert triangles.size and triangles.min() >= 0 and triangles.max() < len(positions)
    assert np.isfinite(positions).all() and np.isfinite(coordinate)
    vertices = positions[triangles]
    d = vertices[:, :, axis] - coordinate
    on = np.abs(d) <= epsilon
    coplanar = on.all(axis=1)
    crossing = ((d < -epsilon).any(axis=1) & (d > epsilon).any(axis=1))
    ids = np.flatnonzero(crossing & ~on.any(axis=1))
    # The ordinary case has exactly two sign-changing edges. Keep triangle ids
    # for a separate source-edge/plane readback; edge order has no anatomy meaning.
    segment_array = np.empty((len(ids), 2, 3), dtype=np.float64)
    count = np.zeros(len(ids), dtype=np.int8)
    for a, b in [(0, 1), (1, 2), (2, 0)]:
        select = (d[ids, a] < 0) != (d[ids, b] < 0)
        selected_ids = ids[select]
        t = d[selected_ids, a] / (d[selected_ids, a] - d[selected_ids, b])
        segment_array[select, count[select]] = vertices[selected_ids, a] + t[:, None] * (vertices[selected_ids, b] - vertices[selected_ids, a])
        count[select] += 1
    assert (count == 2).all()
    extra, extra_ids, point_contacts = [], [], 0
    for i in np.flatnonzero(on.any(axis=1) & ~coplanar):
        points = [vertices[i, k].copy() for k in np.flatnonzero(on[i])]
        for a, b in [(0, 1), (1, 2), (2, 0)]:
            if (d[i, a] < -epsilon and d[i, b] > epsilon) or (d[i, b] < -epsilon and d[i, a] > epsilon):
                t = d[i, a] / (d[i, a] - d[i, b])
                points.append(vertices[i, a] + t * (vertices[i, b] - vertices[i, a]))
        if len(points) == 1:
            point_contacts += 1
        else:
            assert len(points) == 2
            extra.append(points)
            extra_ids.append(int(i))
    if extra:
        segment_array = np.concatenate([segment_array, np.asarray(extra)])
        ids = np.concatenate([ids, np.asarray(extra_ids, dtype=np.int64)])
    return {'segments': segment_array, 'triangleIds': ids,
            'coplanarTriangles': int(coplanar.sum()), 'pointContacts': point_contacts}
