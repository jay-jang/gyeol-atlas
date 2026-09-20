import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('sampling', Path(__file__).resolve().parents[1] / 'scripts/lib/surface-sampling.py')
sampling = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sampling)


class Sampling(unittest.TestCase):
    def test_area_proportions_and_reconstruction(self):
        points = np.array([[0, 0, 0], [2, 0, 0], [0, 1, 0], [10, 0, 0], [16, 0, 0], [10, 1, 0]], float)
        triangles = np.array([[0, 1, 2], [3, 4, 5]])
        samples, ids, weights = sampling.sample_surface(points, triangles, 20000, 91)
        self.assertLess(abs(np.mean(ids == 1) - .75), .01)
        np.testing.assert_allclose(weights.sum(axis=1), 1)
        np.testing.assert_allclose(samples, (points[triangles[ids]] * weights[:, :, None]).sum(axis=1))
        np.testing.assert_array_equal(samples, sampling.sample_surface(points, triangles, 20000, 91)[0])

    def test_subdivision_does_not_weight_by_vertex_count(self):
        # One side has twice as many triangles, but both squares have area 1.
        points = np.array([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
                           [2, 0, 0], [3, 0, 0], [3, 1, 0], [2, 1, 0], [2.5, .5, 0]])
        triangles = np.array([[0, 1, 2], [0, 2, 3], [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8]])
        samples, _, _ = sampling.sample_surface(points, triangles, 20000, 2)
        self.assertLess(abs(np.mean(samples[:, 0] > 1.5) - .5), .01)

    def test_invalid_and_zero_area(self):
        with self.assertRaises(ValueError):
            sampling.sample_surface([[0, 0, 0]], [[0, 0, 0]], 10)
        with self.assertRaises(ValueError):
            sampling.sample_surface([[0, 0, 0]], [[0, 1, 2]], 10)


if __name__ == '__main__':
    unittest.main()
