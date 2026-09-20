"""Synthetic parser regression tests, not validation of source anatomy."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[1] / 'scripts/audit-vivaplus.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class SourceParser(unittest.TestCase):
    def node(self, nid, point):
        return f'{nid:8d}' + ''.join(f'{value:16}' for value in point)

    def test_fixed_width_nodes_and_comments(self):
        text = '*KEYWORD\n$ ignored\n*NODE\n' + self.node(1, (1.5, -2.0, 3.0)) + '\n*END'
        self.assertEqual(audit.read_nodes(text), {1: (1.5, -2.0, 3.0)})
        self.assertEqual(list(audit.blocks('$*INCLUDE\n$male.k\n*END')), [('*END', [])])

    def test_invalid_nodes_fail(self):
        for rows in ([self.node(1, (1, 2, 3))] * 2, [self.node(1, ('nan', 2, 3))]):
            with self.assertRaises(ValueError):
                audit.read_nodes('*NODE\n' + '\n'.join(rows))
        with self.assertRaises(ValueError):
            audit.read_nodes('*NODE_LONG\n')

    def test_selected_references_and_quad_hex_counts(self):
        nodes = {i: (i, 0, 0) for i in range(1, 9)}
        row = lambda values: ''.join(f'{v:8d}' for v in values)
        counts, refs = audit.read_elements('*ELEMENT_SHELL\n' + row((1, 7, 1, 2, 3, 4)) + '\n*ELEMENT_SOLID\n' + row((2, 7, 1, 2, 3, 4, 5, 6, 7, 8)), {7: 'part'}, nodes)
        self.assertEqual(dict(counts[7]), {'*ELEMENT_SHELL': 1, '*ELEMENT_SOLID': 1})
        self.assertEqual(refs[7], set(nodes))
        for values in ((1, 7, 1, 2, 3, 9), (1, 7, 1, 2, 3, 3), (1, 7, 1, 2, 3)):
            with self.assertRaises(ValueError):
                audit.read_elements('*ELEMENT_SHELL\n' + row(values), {7: 'part'}, nodes)
        with self.assertRaises(ValueError):
            audit.read_elements('*ELEMENT_SHELL\n' + (row((1, 7, 1, 2, 3, 4)) + '\n') * 2, {7: 'part'}, nodes)

    def test_unknown_card_fails(self):
        with self.assertRaises(ValueError):
            audit.read_elements('*ELEMENT_UNKNOWN\n', {7: 'part'}, {1: (0, 0, 0)})

    def test_discrete_is_not_surface(self):
        row = ''.join(f'{v:8d}' for v in (1, 7, 1, 2)) + '      0.'
        counts, refs = audit.read_elements('*ELEMENT_DISCRETE\n' + row, {7: 'ligament'}, {1: (0, 0, 0), 2: (1, 0, 0)})
        self.assertEqual(dict(counts[7]), {'*ELEMENT_DISCRETE': 1})
        self.assertEqual(refs[7], {1, 2})

    def test_thickness_continuation_is_not_element(self):
        row = ''.join(f'{v:8d}' for v in (1, 7, 1, 2, 3, 4))
        nodes = {n: (n, 0, 0) for n in range(1, 5)}
        counts, _ = audit.read_elements('*ELEMENT_SHELL_THICKNESS\n' + row + '\n1.0 1.0 1.0 1.0', {7: 'part'}, nodes)
        self.assertEqual(dict(counts[7]), {'*ELEMENT_SHELL_THICKNESS': 1})
        with self.assertRaises(ValueError):
            audit.read_elements('*ELEMENT_SHELL_THICKNESS\n' + row, {7: 'part'}, nodes)

    def test_joint_fixed_width_pairs(self):
        text = '*CONSTRAINED_JOINT_REVOLUTE_ID\n' + f'{10:10d}UX-Test-L\n' + ''.join(f'{n:10d}' for n in (1, 2, 3, 4))
        nodes = {1: (0, 0, 0), 2: (0, 0, 0), 3: (3, 4, 0), 4: (3, 4, 0)}
        joint = audit.read_joints(text, nodes)[0]
        self.assertEqual(joint['pairedNodeDistancesMm'], [0, 0])
        self.assertEqual(joint['axisNodeDistancesMm'], [5, 5])
        with self.assertRaises(ValueError):
            audit.read_joints(text, {1: nodes[1]})

    def test_archive_hash_guard(self):
        with self.assertRaisesRegex(ValueError, 'hash differs'):
            audit.audit(Path(__file__))

    def test_part_record_lengths_and_duplicates(self):
        record = 'example\n' + f'{7:10d}'
        self.assertEqual(audit.read_parts('*PART\n' + record), {7: 'example'})
        for text in ('*PART\nexample', '*PART\n' + record + '\nextra',
                     ('*PART\n' + record + '\n') * 2):
            with self.assertRaises(ValueError):
                audit.read_parts(text)

    def test_joint_missing_or_extra_rows_fail_closed(self):
        header = '*CONSTRAINED_JOINT_SPHERICAL_ID\n' + f'{10:10d}UX-Test-L'
        for text in (header, header + '\n' + f'{1:10d}{2:10d}' + '\nextra'):
            with self.assertRaises(ValueError):
                audit.read_joints(text, {1: (0, 0, 0), 2: (0, 0, 0)})


if __name__ == '__main__':
    unittest.main()
