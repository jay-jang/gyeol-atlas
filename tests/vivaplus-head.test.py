import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('head',Path(__file__).resolve().parents[1]/'scripts/audit-vivaplus-head.py')
head=importlib.util.module_from_spec(spec);spec.loader.exec_module(head)
spec2=importlib.util.spec_from_file_location('extract',Path(__file__).resolve().parents[1]/'scripts/extract-vivaplus-head.py')
extract=importlib.util.module_from_spec(spec2);spec2.loader.exec_module(extract)
def row(values): return ''.join(f'{v:8d}' for v in values)

class HeadInventoryTests(unittest.TestCase):
    def setUp(self):
        self.nodes={i:(0,0,0) for i in range(1,9)}
    def test_thickness_continuation_is_not_an_element(self):
        text='*ELEMENT_SHELL_THICKNESS\n'+row([1,101101,1,2,3,4])+'\n       2.3       2.3       2.3       2.3\n'
        result=head.head_elements(text,{101101:'frontal'},self.nodes)
        self.assertEqual(result[101101],[dict(id=1,keyword='*ELEMENT_SHELL_THICKNESS',nodes=[1,2,3,4])])
    def test_rejects_missing_continuation_node_and_duplicate_id(self):
        text='*ELEMENT_SHELL_THICKNESS\n'+row([1,101101,1,2,3,4])+'\n'
        with self.assertRaisesRegex(ValueError,'continuation'): head.head_elements(text,{101101:'frontal'},self.nodes)
        text='*ELEMENT_SOLID\n'+row([1,101102,1,2,3,4,5,6,7,9])+'\n'
        with self.assertRaisesRegex(ValueError,'Missing head node'): head.head_elements(text,{101102:'frontal'},self.nodes)
        text='*ELEMENT_SHELL\n'+row([1,101101,1,2,3,4])+'\n'+row([1,101101,1,2,3,4])+'\n'
        with self.assertRaisesRegex(ValueError,'Duplicate'): head.head_elements(text,{101101:'frontal'},self.nodes)
    def test_source_ids_filter_without_counting_mass_as_anatomy(self):
        text='*ELEMENT_MASS\nanything\n*ELEMENT_SHELL\n'+row([1,999,1,2,3,4])+'\n'
        self.assertEqual(head.head_elements(text,{101101:'frontal'},self.nodes),{101101:[]})
        with self.assertRaisesRegex(ValueError,'Unknown'): head.head_elements('*ELEMENT_UNSUPPORTED\n',{},self.nodes)
    def test_shell_reference_not_extruded_and_rejects_solid_mix(self):
        nodes={1:(0,0,0),2:(10,0,0),3:(10,10,0),4:(0,10,0)}
        elements={101101:[dict(id=1,keyword='*ELEMENT_SHELL_THICKNESS',nodes=[1,2,3,4])]}
        mesh,stats=extract.extract_group([101101],'shell-reference',elements,nodes)
        self.assertEqual(stats['triangles'],2);self.assertEqual(stats['vertices'],4)
        self.assertEqual(mesh['positions'],[0,0,0,0,0,.01,.01,0,.01,.01,0,0])
        with self.assertRaisesRegex(ValueError,'Non-solid'):extract.extract_group([101101],'solid-boundary',elements,nodes)

if __name__=='__main__':unittest.main()
