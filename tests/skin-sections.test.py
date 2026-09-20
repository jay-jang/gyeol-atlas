import importlib.util
import unittest
from pathlib import Path
import numpy as np

spec = importlib.util.spec_from_file_location('sections', Path(__file__).resolve().parents[1] / 'scripts/lib/skin-sections.py')
sections = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sections)


def box(centre):
    p = np.array([[x, y, z] for x in [-1., 1.] for y in [-1., 1.] for z in [-1., 1.]]) + centre
    faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]]
    t = np.array([tri for a, b, c, d in faces for tri in [[a, b, c], [a, c, d]]])
    return p, t


class Sections(unittest.TestCase):
    def cut(self, p, t, z=.123):
        return sections.closed_sections(p, t, [0, 0, z], [0, 0, 1], [[1, 0, 0], [0, 1, 0]])

    def test_separate_contours_no_convex_hull_bridge(self):
        a, ta = box([-3, 0, 0]); b, tb = box([3, 0, 0])
        rings = self.cut(np.r_[a, b], np.r_[ta, tb + len(a)])
        self.assertEqual(len(rings), 2)
        for row, x in zip(rings, [-3, 3]):
            np.testing.assert_allclose(row['centroid'], [x, 0, .123], atol=1e-12)
            self.assertAlmostEqual(row['areaMm2'], 4e6)
            self.assertAlmostEqual(row['perimeterMm'], 8000)

    def test_duplicate_face_vertices_still_weld(self):
        p, t = box([0, 0, 0])
        rings = self.cut(p[t].reshape(-1, 3), np.arange(t.size).reshape(-1, 3))
        self.assertEqual(len(rings), 1)
        self.assertAlmostEqual(rings[0]['areaMm2'], 4e6)

    def test_nearby_endpoints_across_grid_boundary_weld(self):
        p, t = box([.5e-7, .5e-7, 0])
        points = p[t].reshape(-1, 3)
        points[::3, 0] += 1e-10
        rings = self.cut(points, np.arange(t.size).reshape(-1, 3))
        self.assertEqual(len(rings), 1)
        self.assertAlmostEqual(rings[0]['areaMm2'], 4e6, places=2)

    def test_duplicate_overlapping_surface_rejected(self):
        p, t = box([0, 0, 0])
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            self.cut(np.r_[p, p], np.r_[t, t + len(p)])

    def test_open_plane_contact_and_bad_frame_rejected(self):
        p, t = box([0, 0, 0])
        with self.assertRaisesRegex(ValueError, 'Open'):
            self.cut(p, t[2:])
        with self.assertRaisesRegex(ValueError, 'touches'):
            self.cut(p, t, 1)
        with self.assertRaisesRegex(ValueError, 'orthonormal'):
            sections.closed_sections(p, t, [0, 0, 0], [0, 0, 2], [[1, 0, 0], [0, 1, 0]])
        self.assertEqual(self.cut(p, t, 2), [])


if __name__ == '__main__':
    unittest.main()
