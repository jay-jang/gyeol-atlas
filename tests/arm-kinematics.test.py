import importlib.util
from pathlib import Path
import unittest
import numpy as np
from scipy.spatial.transform import Rotation

spec = importlib.util.spec_from_file_location('kin', Path(__file__).resolve().parents[1] / 'scripts/lib/arm-kinematics.py')
kin = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kin)


class Kinematics(unittest.TestCase):
    def test_circle_preserves_both_lengths_at_every_swivel(self):
        s, w = np.array([.2, 1.3, -.1]), np.array([.4, .9, -.05])
        c, r, u, v = kin.elbow_circle(s, w, .27, .24)
        for angle in np.linspace(-np.pi, np.pi, 101):
            elbow = c + r * (u * np.cos(angle) + v * np.sin(angle))
            self.assertAlmostEqual(np.linalg.norm(elbow - s), .27)
            self.assertAlmostEqual(np.linalg.norm(w - elbow), .24)

    def test_unreachable_and_degenerate_targets_rejected(self):
        for wrist, a, b in [([0, 0, 1], .3, .2), ([0, 0, .01], .3, .2), ([0, 0, 0], .3, .2), ([0, 0, .3], -1, .2), ([0, 0, np.nan], .3, .2)]:
            with self.assertRaises(ValueError):
                kin.elbow_circle([0, 0, 0], wrist, a, b)

    def test_endpoint_transform_preserves_shape_scale_and_orientation(self):
        a, b, p, q = [np.array(v, float) for v in [[1, 2, 3], [1, 1, 3], [-2, 1, 4], [-1, 1, 4]]]
        original = np.array([a, b, p, q])
        reference = Rotation.from_euler('xyz', [.1, .3, -.7]).as_matrix()
        for twist in [-np.pi, -.3, 0, .8, np.pi]:
            linear, translation = kin.endpoint_transform(a, b, p, q, reference, twist)
            np.testing.assert_allclose(a @ linear + translation, p, atol=1e-12)
            np.testing.assert_allclose(b @ linear + translation, q, atol=1e-12)
            np.testing.assert_allclose(linear @ linear.T, np.eye(3), atol=1e-12)
            self.assertAlmostEqual(np.linalg.det(linear), 1.)
        np.testing.assert_array_equal([a, b, p, q], original)

    def test_straight_chain_and_antiparallel_alignment(self):
        c, r, _, _ = kin.elbow_circle([0, 0, 0], [0, 0, .5], .3, .2)
        self.assertAlmostEqual(r, 0)
        np.testing.assert_allclose(c, [0, 0, .3])
        linear, translation = kin.endpoint_transform([0, 0, 0], [0, 1, 0], [0, 0, 0], [0, -2, 0], np.eye(3))
        np.testing.assert_allclose(np.array([0, 1, 0]) @ linear + translation, [0, -2, 0], atol=1e-12)
        np.testing.assert_allclose(linear @ linear.T, np.eye(3) * 4, atol=1e-12)


if __name__ == '__main__':
    unittest.main()
