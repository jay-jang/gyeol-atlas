import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('extract', Path(__file__).resolve().parents[1] / 'scripts/extract-vivaplus-surfaces.py')
extract = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extract)
NODES = dict(enumerate(((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0),
                        (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)), start=1))


class HexBoundary(unittest.TestCase):
    def test_cube_outward_and_roundtrip(self):
        faces, internal = extract.hex_boundary([list(range(1, 9))], NODES)
        self.assertEqual((len(faces), internal), (6, 0))
        for face in faces:
            points = [NODES[n] for n in face]
            normal = extract.cross(extract.sub(points[1], points[0]), extract.sub(points[2], points[0]))
            self.assertGreater(extract.dot(normal, extract.sub(extract.centroid(points), (.5, .5, .5))), 0)
        mesh, error = extract.triangulate(faces, NODES)
        self.assertEqual((len(mesh['positions']), len(mesh['indices'])), (24, 36))
        self.assertEqual(error, 0)
        self.assertEqual(mesh['positions'][3:6], [0, 0, .001])
        self.assertAlmostEqual(extract.component_summary(mesh)[0]['signedVolumeMm3'], 1)

    def test_adjacent_cubes_cancel_interface_across_parts(self):
        nodes = dict(NODES)
        nodes.update({9: (2, 0, 0), 10: (2, 1, 0), 11: (2, 0, 1), 12: (2, 1, 1)})
        faces, internal = extract.hex_boundary([list(range(1, 9)), [2, 9, 10, 3, 6, 11, 12, 7]], nodes)
        self.assertEqual((len(faces), internal), (10, 1))

    def test_coordinate_duplicates_not_welded(self):
        nodes = {**NODES, **{n + 8: p for n, p in NODES.items()}}
        faces, internal = extract.hex_boundary([list(range(1, 9)), list(range(9, 17))], nodes)
        self.assertEqual((len(faces), internal), (12, 0))

    def test_invalid_shapes_fail(self):
        for cells in ([[1, 2, 3, 4]], [[1, 2, 3, 4, 5, 6, 7, 7]], [list(range(1, 9))] * 2):
            with self.assertRaises(ValueError):
                extract.hex_boundary(cells, NODES)

    def test_shared_warped_quad_uses_same_diagonal(self):
        nodes = {1: (0, 0, 0), 2: (1, 0, 0), 3: (1, 1, .1), 4: (0, 1, 0)}
        expected = {frozenset((1, 2, 3)), frozenset((1, 3, 4))}
        for quad in ((1, 2, 3, 4), (2, 3, 4, 1), (4, 3, 2, 1), (1, 4, 3, 2)):
            mesh, _ = extract.triangulate([quad], nodes)
            actual = {frozenset(mesh['sourceNodeIds'][i] for i in mesh['indices'][j:j + 3])
                      for j in range(0, len(mesh['indices']), 3)}
            self.assertEqual(actual, expected)

    def test_mirrored_volume_keeps_outward_orientation(self):
        nodes = {n: (-p[0], p[1], p[2]) for n, p in NODES.items()}
        faces, _ = extract.hex_boundary([list(range(1, 9))], nodes)
        mesh, _ = extract.triangulate(faces, nodes)
        self.assertAlmostEqual(extract.component_summary(mesh)[0]['signedVolumeMm3'], 1)


if __name__ == '__main__':
    unittest.main()
