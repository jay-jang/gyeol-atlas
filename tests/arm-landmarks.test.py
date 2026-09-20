"""Small synthetic tests; not validation of anatomical wrist landmarks."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation

spec = importlib.util.spec_from_file_location('sections', Path(__file__).resolve().parents[1] / 'scripts/experiment-arm-landmarks.py')
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)


class Sections(unittest.TestCase):
    def setUp(self):
        self.points = np.array([[x, y, z] for x in [-1., 1.] for y in [-1., 1.] for z in [-1., 1.]])
        self.triangles = ConvexHull(self.points).simplices

    def test_box_and_coplanar_face(self):
        for height in [0., 1.]:
            r = g.section(self.points, self.triangles, np.array([0, 0, height]), np.array([0, 0, 1]), np.eye(3)[:2])
            self.assertAlmostEqual(r['hullAreaMm2'], 4e6)
            np.testing.assert_allclose(r['centroid'], [0, 0, height], atol=1e-12)

    def test_rotation_translation_and_input_immutability(self):
        rotation = Rotation.from_euler('xyz', [.3, -.7, .2]).as_matrix()
        offset = np.array([.4, -.2, .8])
        points = self.points @ rotation.T + offset
        before, triangles_before = points.copy(), self.triangles.copy()
        r = g.section(points, self.triangles, offset, rotation[:, 2], rotation.T[:2])
        self.assertAlmostEqual(r['hullAreaMm2'], 4e6)
        np.testing.assert_allclose(r['centroid'], offset, atol=1e-12)
        np.testing.assert_array_equal(points, before)
        np.testing.assert_array_equal(self.triangles, triangles_before)

    def test_no_intersection_rejected(self):
        with self.assertRaises(ValueError):
            g.section(self.points, self.triangles, np.array([0, 0, 3]), np.array([0, 0, 1]), np.eye(3)[:2])


if __name__ == '__main__':
    unittest.main()
