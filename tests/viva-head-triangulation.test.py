import importlib.util
import math
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('triangulation',Path(__file__).resolve().parents[1]/'scripts/lib/viva-head-triangulation.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
CUBE=((0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1))
def cell(eid,ids):return dict(id=eid,keyword='*ELEMENT_SOLID',nodes=ids)

# Pinned v2.0.2 element 1043199: no inferred or fitted coordinates.
TEMPORAL_IDS=[1037141,1034272,1037851,1038198,1037140,1040378,1040494,1038197]
TEMPORAL=((19.445,-62.96,1507.296),(13.446,-64.848,1504.131),
          (13.422,-64.13,1505.156),(19.235,-61.889,1508.566),
          (20.477,-62.765,1502.323),(13.988,-64.131,1498.928),
          (13.678,-63.158,1500.175),(20.321,-62.445,1503.572))

class HeadTriangulationTests(unittest.TestCase):
    def test_cube_source_roundtrip_outward(self):
        nodes=dict(enumerate(CUBE,1));rows=[cell(1,list(nodes))]
        choices,report=t.choose_diagonals(rows,nodes)
        self.assertFalse(report['failures']);self.assertFalse(report['changedDiagonals'])
        quads,internal=t.boundary(rows,nodes,choices)
        mesh,error=t.triangulate(quads,nodes,choices)
        self.assertEqual((len(quads),internal,error),(6,0,0))
        self.assertAlmostEqual(t.s.component_summary(mesh)[0]['signedVolumeMm3'],1)

    def test_shared_face_and_shell_use_same_diagonal(self):
        nodes=dict(enumerate(CUBE,1));nodes.update({9:(2,0,0),10:(2,1,0),11:(2,0,1),12:(2,1,1)})
        rows=[cell(1,list(range(1,9))),cell(2,[2,9,10,3,6,11,12,7])]
        choices,report=t.choose_diagonals(rows,nodes)
        self.assertEqual(report['sharedSolidFaces'],1);self.assertFalse(report['failures'])
        faces,internal=t.boundary(rows,nodes,choices)
        self.assertEqual((len(faces),internal),(10,1))
        triangles=[]
        for q in ((2,3,7,6),(3,7,6,2),(6,7,3,2),(2,6,7,3)):
            mesh,_=t.triangulate([q],nodes,choices)
            triangles.append({frozenset(mesh['sourceNodeIds'][n] for n in mesh['indices'][i:i+3]) for i in (0,3)})
        self.assertTrue(all(tris==triangles[0] for tris in triangles))

    def test_same_side_shared_cells_rejected(self):
        nodes=dict(enumerate(CUBE,1));nodes.update({9:(0,0,.8),10:(1,0,.8),11:(1,1,.8),12:(0,1,.8)})
        rows=[cell(1,list(range(1,9))),cell(2,[1,2,3,4,9,10,11,12])]
        choices,report=t.choose_diagonals(rows,nodes)
        self.assertEqual([f['quadNodeIds'] for f in report['failures']],[(1,2,3,4)])
        with self.assertRaisesRegex(ValueError,'Unresolved'):t.boundary(rows[:1],nodes,choices)

    def test_rejects_duplicate_cells_and_degenerate_triangles(self):
        nodes=dict(enumerate(CUBE,1));rows=[cell(1,list(nodes))]
        with self.assertRaisesRegex(ValueError,'Duplicate'):t.choose_diagonals(rows*2,nodes)
        with self.assertRaisesRegex(ValueError,'Degenerate'):t.triangulate([(1,2,3,4)],{i:(i,0,0) for i in range(1,5)},{})

    def test_actual_temporal_alternate_diagonal(self):
        nodes=dict(zip(TEMPORAL_IDS,TEMPORAL));q=(1037851,1038198,1038197,1040494)
        centre=t.s.centroid(TEMPORAL)
        self.assertFalse(t.diagnostic.face_diagnostics(q,centre,nodes)['passes'])
        self.assertTrue(t.diagnostic.face_diagnostics(q[1:]+q[:1],centre,nodes)['passes'])
        choices,report=t.choose_diagonals([cell(1043199,TEMPORAL_IDS)],nodes)
        self.assertFalse(report['failures'])
        self.assertEqual(choices[tuple(sorted(q))],tuple(sorted((q[1],q[3]))))
        faces,_=t.boundary([cell(1043199,TEMPORAL_IDS)],nodes,choices)
        mesh,error=t.triangulate(faces,nodes,choices)
        self.assertLess(error,1e-9);self.assertEqual(len(mesh['indices']),36)
        # Reversing the winding or rotating the starting node cannot undo the choice.
        for face in (q,q[1:]+q[:1],tuple(reversed(q))):
            oriented=t.orient_quad(face,choices)
            self.assertEqual(tuple(sorted((oriented[0],oriented[2]))),choices[tuple(sorted(q))])

    def test_jacobian_cube_and_reflection(self):
        for natural in ((0,0,0),(.3,-.7,.1),(1,1,1)):
            self.assertAlmostEqual(t.diagnostic.hex_jacobian(CUBE,natural),.125)
            self.assertAlmostEqual(t.diagnostic.hex_jacobian([(-x,y,z) for x,y,z in CUBE],natural),-.125)

    def test_jacobian_independent_finite_difference(self):
        # Interpolate via sequential linear blends, independently of derivative weights.
        def lerp(a,b,u):return [x+(y-x)*u for x,y in zip(a,b)]
        def position(p):
            u,v,w=[(x+1)/2 for x in p]
            lower=lerp(lerp(TEMPORAL[0],TEMPORAL[1],u),lerp(TEMPORAL[3],TEMPORAL[2],u),v)
            upper=lerp(lerp(TEMPORAL[4],TEMPORAL[5],u),lerp(TEMPORAL[7],TEMPORAL[6],u),v)
            return lerp(lower,upper,w)
        for p in ((0,0,0),(.2,-.3,.4),(-1,1,1)):
            cols=[];h=1e-4
            for axis in range(3):
                a=list(p);b=list(p);a[axis]-=h;b[axis]+=h
                cols.append([(y-x)/(2*h) for x,y in zip(position(a),position(b))])
            numerical=t.s.dot(cols[0],t.s.cross(cols[1],cols[2]))
            self.assertAlmostEqual(t.diagnostic.hex_jacobian(TEMPORAL,p),numerical,places=6)
        samples=[(0,0,0),*t.diagnostic.SIGNS,*[tuple(x/math.sqrt(3) for x in s) for s in t.diagnostic.SIGNS]]
        self.assertAlmostEqual(min(t.diagnostic.hex_jacobian(TEMPORAL,p) for p in samples),.8096358307501553)

if __name__=='__main__':unittest.main()
