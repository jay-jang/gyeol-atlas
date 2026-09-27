"""Small exact geometry cases for the offline transverse-plane diagnostic."""
import importlib.util
from pathlib import Path
import sys
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
spec = importlib.util.spec_from_file_location('cord_section', Path(__file__).with_name('audit-cord-section-clearance.py'))
section = importlib.util.module_from_spec(spec)
spec.loader.exec_module(section)


def square(x0, z0, x1, z1):
    vertices = np.array([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], dtype=np.float64)
    return np.array([[vertices[i], vertices[(i+1) % 4]] for i in range(4)])


class ClearanceCases(unittest.TestCase):
    def test_disjoint_and_crossing(self):
        bone = square(0, 0, 2, 2)
        self.assertFalse(section.collides(square(3, 0, 4, 1), bone))
        self.assertTrue(section.collides(square(1, 1, 3, 3), bone))

    def test_both_containment_directions(self):
        bone = square(0, 0, 4, 4)
        self.assertTrue(section.collides(square(1, 1, 2, 2), bone))
        self.assertTrue(section.collides(square(-1, -1, 5, 5), bone))

    def test_hole_and_touch(self):
        ring = np.concatenate([square(0, 0, 5, 5), square(1, 1, 4, 4)])
        self.assertFalse(section.collides(square(2, 2, 3, 3), ring))
        self.assertTrue(section.collides(square(2, 2, 4, 3), ring))
        self.assertEqual(section.nonmanifold_section_nodes(ring), 0)


if __name__ == '__main__':
    unittest.main()
