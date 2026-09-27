"""Small synthetic checks, separate from source-data evidence tests."""
import importlib.util
from pathlib import Path
import unittest
import numpy as np

spec = importlib.util.spec_from_file_location('envelope', Path(__file__).parents[1]/'scripts/build-bonehub-foot-envelope.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class CellSurfaceTests(unittest.TestCase):
    def check_mask(self, mask):
        spacing = np.array([.75, 1.25, 2.])
        points, faces, caps = module.cell_surface(mask, spacing)
        tri = points[faces].astype(np.float64)
        normals = np.cross(tri[:, 1]-tri[:, 0], tri[:, 2]-tri[:, 0])
        volume = np.sum(tri[:, 0]*normals)/6
        self.assertEqual(volume, mask.sum()*spacing.prod())
        self.assertEqual(int(caps.sum()), 2*int(mask[0].sum()+mask[-1].sum()))
        expected = 2*sum(np.count_nonzero(np.diff(np.pad(mask, 1), axis=a)) for a in range(3))
        self.assertEqual(len(faces), expected)
        grid = points/spacing
        for face, normal in zip(faces, normals):
            direction = np.sign(normal)
            center = grid[face].mean(axis=0)
            inside, outside = [np.floor(center+sign*direction*.25+.5).astype(int)[::-1] for sign in [-1, 1]]
            self.assertTrue(mask[tuple(inside)])
            if np.all(outside >= 0) and np.all(outside < mask.shape):
                self.assertFalse(mask[tuple(outside)])

    def test_single_cell_at_cut(self):
        self.check_mask(np.ones((1, 1, 1), dtype=bool))

    def test_offset_cell_no_cut(self):
        mask = np.zeros((5, 6, 7), dtype=bool)
        mask[2, 3, 4] = True
        self.check_mask(mask)

    def test_concave_disconnected_cells(self):
        mask = np.zeros((5, 6, 7), dtype=bool)
        mask[1:3, 2:4, 1:3] = True
        mask[1, 2, 1] = False
        mask[4, 5, 6] = True
        self.check_mask(mask)

    def test_hollow_volume_inner_winding(self):
        mask = np.ones((3, 3, 3), dtype=bool)
        mask[1, 1, 1] = False
        self.check_mask(mask)


if __name__ == '__main__':
    unittest.main()
