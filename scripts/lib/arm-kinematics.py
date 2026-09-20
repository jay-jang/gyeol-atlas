"""Geometric two-link constraints only; no anatomical landmark inference."""
import numpy as np
from scipy.spatial.transform import Rotation


def elbow_circle(shoulder, wrist, upper_length, forearm_length):
    shoulder, wrist = np.asarray(shoulder, float), np.asarray(wrist, float)
    delta = wrist - shoulder
    distance = np.linalg.norm(delta)
    if not np.isfinite([*shoulder, *wrist, upper_length, forearm_length]).all():
        raise ValueError('Non-finite chain')
    if min(upper_length, forearm_length, distance) <= 0:
        raise ValueError('Degenerate chain')
    if distance > upper_length + forearm_length + 1e-12 or distance < abs(upper_length - forearm_length) - 1e-12:
        raise ValueError('Unreachable wrist; do not stretch bones to hide it')
    axis = delta / distance
    along = (upper_length**2 - forearm_length**2 + distance**2) / (2 * distance)
    radius = np.sqrt(max(0., upper_length**2 - along**2))
    centre = shoulder + along * axis
    seed = np.eye(3)[np.argmin(np.abs(axis))]
    u = np.cross(axis, seed)
    u /= np.linalg.norm(u)
    v = np.cross(axis, u)
    return centre, radius, u, v


def endpoint_transform(source_a, source_b, target_a, target_b, reference, twist=0.):
    """Row-vector similarity, aligning both endpoints; twist is in radians."""
    a, b, p, q = map(lambda v: np.asarray(v, float), [source_a, source_b, target_a, target_b])
    before, after = b - a, q - p
    if min(np.linalg.norm(before), np.linalg.norm(after)) < 1e-12:
        raise ValueError('Coincident endpoints')
    before /= np.linalg.norm(before)
    axis = after / np.linalg.norm(after)
    reference = np.asarray(reference, float)
    if not np.allclose(reference.T @ reference, np.eye(3), atol=1e-9) or not np.isclose(np.linalg.det(reference), 1):
        raise ValueError('Reference must be a proper rotation')
    correction, _ = Rotation.align_vectors([axis], [reference @ before])
    rotation = Rotation.from_rotvec(axis * twist) * correction * Rotation.from_matrix(reference)
    scale = np.linalg.norm(q - p) / np.linalg.norm(b - a)
    linear = rotation.as_matrix().T * scale
    translation = p - a @ linear
    return linear, translation
