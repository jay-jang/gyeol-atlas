import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('sections', Path(__file__).resolve().parents[1]/'scripts/lib/mesh_plane_sections.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class MeshPlaneSections(unittest.TestCase):
    def test_transverse_and_disjoint(self):
        p = [[0, 0, -1], [2, 0, 1], [0, 2, 1], [0, 0, 4], [1, 0, 4], [0, 1, 4]]
        r = module.sections(p, [0, 1, 2, 3, 4, 5], 2, 0)
        self.assertEqual(r['triangleIds'].tolist(), [0])
        np.testing.assert_allclose(r['segments'], [[[1, 0, 0], [0, 1, 0]]])
        self.assertEqual(r['coplanarTriangles'], 0)

    def test_vertex_edge_and_coplanar_cases_are_explicit(self):
        p = [[0, 0, 0], [2, 0, -1], [0, 2, 1], [0, 2, 0], [2, 0, 0], [0, 0, 2]]
        r = module.sections(p, [0, 1, 2, 0, 3, 5, 0, 2, 5, 0, 3, 4], 2, 0)
        self.assertEqual(r['triangleIds'].tolist(), [0, 1])
        self.assertEqual(r['pointContacts'], 1)
        self.assertEqual(r['coplanarTriangles'], 1)
        np.testing.assert_allclose(r['segments'], [[[0, 0, 0], [1, 1, 0]], [[0, 0, 0], [0, 2, 0]]])

    def test_axis_permutation_translation_and_no_mutation(self):
        p = np.array([[0, 0, -1], [2, 0, 1], [0, 2, 1]], dtype=np.float64)
        for axis in range(3):
            moved = np.roll(p, axis-2, axis=1)+[11, 22, 33]
            before = moved.copy()
            r = module.sections(moved, [0, 1, 2], axis, [11, 22, 33][axis])
            np.testing.assert_array_equal(moved, before)
            self.assertEqual(len(r['segments']), 1)
            np.testing.assert_allclose(r['segments'][:, :, axis], [11, 22, 33][axis])

    def test_invalid_geometry_rejected(self):
        for p, indices, axis in [([[0, 0, np.nan]], [0, 0, 0], 0), ([[0, 0, 0]], [0, 1, 2], 0), ([[0, 0, 0]], [0, 0, 0], 3), ([[0, 0, 0]], [0, .5, 0], 0), ([[0, 0, 0]], [0, 0], 0)]:
            with self.assertRaises(AssertionError):
                module.sections(p, indices, axis, 0)
        with self.assertRaises(AssertionError):
            module.sections([[0, 0, 0]], [0, 0, 0], 0, 0, epsilon=float('inf'))


if __name__ == '__main__':
    unittest.main()
