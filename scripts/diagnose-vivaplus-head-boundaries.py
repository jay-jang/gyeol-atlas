"""Explain rejected linear head boundaries without changing source coordinates."""
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path

spec=importlib.util.spec_from_file_location('extract',Path(__file__).with_name('extract-vivaplus-head.py'))
extract=importlib.util.module_from_spec(spec);spec.loader.exec_module(extract)
s=extract.surface
SIGNS=((-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1))


def hex_jacobian(points, natural):
    columns=[]
    for axis in range(3):
        derivative=[]
        for sign in SIGNS:
            weight=sign[axis]/8
            for k in range(3):
                if k!=axis:weight*=1+sign[k]*natural[k]
            derivative.append(weight)
        columns.append([math.fsum(points[i][d]*derivative[i] for i in range(8)) for d in range(3)])
    return s.dot(columns[0],s.cross(columns[1],columns[2]))


def face_diagnostics(quad, centre, nodes):
    p=[nodes[n] for n in quad]
    normals=[s.cross(s.sub(p[1],p[0]),s.sub(p[2],p[0])),s.cross(s.sub(p[2],p[0]),s.sub(p[3],p[0]))]
    average=[a+b for a,b in zip(*normals)]
    orientation=s.dot(average,s.sub(s.centroid(p),centre))
    direction=1 if orientation>0 else -1
    values=[direction*s.dot(n,s.sub(p[0],centre)) for n in normals]
    distances=[direction*s.dot(n,s.sub(p[0],centre))/math.sqrt(s.dot(n,n)) if s.dot(n,n)>0 else None for n in normals]
    return dict(orientation=orientation,triangleCentreProducts=values,triangleCentreDistancesMm=distances,
                passes=math.isfinite(orientation) and abs(orientation)>1e-12 and all(v>1e-12 for v in values))


def boundary_failures(rows,nodes):
    faces=collections.defaultdict(list)
    for r in rows:
        ids=r['nodes'];extract.require(len(set(ids))==8,'Not an eight-node source cell')
        centre=s.centroid([nodes[n] for n in ids])
        for local in s.HEX_FACES:
            quad=tuple(ids[i] for i in local);faces[tuple(sorted(quad))].append((quad,centre,r))
    failures=[];boundary=0
    for copies in faces.values():
        extract.require(len(copies)<=2,'Nonmanifold shared face')
        if len(copies)==2:continue
        boundary+=1
        quad,centre,row=copies[0];quad=s.canonical_quad(quad)
        canonical=face_diagnostics(quad,centre,nodes)
        if canonical['passes']:continue
        alternate=face_diagnostics(quad[1:]+quad[:1],centre,nodes)
        points=[nodes[n] for n in row['nodes']]
        samples=[(0,0,0),*SIGNS,*[tuple(v/math.sqrt(3) for v in sign) for sign in SIGNS]]
        values=[hex_jacobian(points,p) for p in samples]
        failures.append(dict(elementId=row['id'],nodeIds=row['nodes'],sourcePositionsMm=points,quadNodeIds=quad,
                             canonical=canonical,alternate=alternate,jacobianSamples=[dict(natural=p,determinantMm3=v) for p,v in zip(samples,values)],
                             minimumSampledJacobianMm3=min(values)))
    return boundary,failures


def diagnose():
    nodes,parts,elements,metadata=extract.head.load_head();records=[]
    for pid,name in sorted(parts.items()):
        rows=elements[pid]
        if {r['keyword'] for r in rows}!={'*ELEMENT_SOLID'}:continue
        boundary,failures=boundary_failures(rows,nodes)
        records.append(dict(id=pid,name=name,sourceCells=len(rows),boundaryFaces=boundary,failures=failures))
    failures=[f for r in records for f in r['failures']]
    report=dict(source=metadata,status='DIAGNOSTIC ONLY; source/extractor not repaired or exported',records=records,
                summary=dict(solidParts=len(records),failingParts=sum(bool(r['failures']) for r in records),
                             failingBoundaryFaces=len(failures),alternateDiagonalPasses=sum(f['alternate']['passes'] for f in failures),
                             facesOnCellsWithNonpositiveSampledJacobian=sum(f['minimumSampledJacobianMm3']<=0 for f in failures)),
                limitations=['Failure concerns linear triangulation oriented against a cell centre, not a clinical defect diagnosis.',
                             'Jacobian samples are centre, eight corners and eight Gauss points of the trilinear eight-node map; they do not prove global element validity.',
                             'Reported Jacobian counts are failing faces, not unique cells. No nodes, source order or tolerances are changed.',
                             'Changing a quad diagonal can alter a warped surface and is not automatically an anatomically correct repair.'],
                code=[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [Path(__file__),Path(extract.__file__),Path(s.__file__)]])
    Path('.cache/vivaplus-head/boundary-failures.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps(report['summary']));print(json.dumps([dict(id=r['id'],name=r['name'],failedFaces=len(r['failures'])) for r in records if r['failures']]))

if __name__=='__main__':diagnose()
