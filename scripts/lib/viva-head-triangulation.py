"""Consistent planar approximation of pinned FE faces; no coordinate changes.

Both triangles must pass the existing 1e-12 mm^3 cell-centre orientation check
for EVERY incident solid cell. Shared faces and shells use one global diagonal.
This is not an exact bilinear FE face or a biological surface reconstruction.
"""
import collections
import importlib.util
from pathlib import Path

spec=importlib.util.spec_from_file_location('diagnostic',Path(__file__).resolve().parents[1]/'diagnose-vivaplus-head-boundaries.py')
diagnostic=importlib.util.module_from_spec(spec);spec.loader.exec_module(diagnostic)
s=diagnostic.s
require=diagnostic.extract.require


def solid_faces(rows,nodes):
    faces=collections.defaultdict(list);seen=set()
    for row in rows:
        require(row['keyword']=='*ELEMENT_SOLID','Only solids may constrain diagonals')
        ids=row['nodes'];require(len(ids)==8 and len(set(ids))==8,'Expected eight distinct node IDs')
        signature=tuple(sorted(ids));require(signature not in seen,'Duplicate volume cell');seen.add(signature)
        centre=s.centroid([nodes[n] for n in ids])
        for local in s.HEX_FACES:
            quad=tuple(ids[i] for i in local);faces[tuple(sorted(quad))].append((quad,centre,row['id']))
    require(all(len(c)<=2 for c in faces.values()),'Nonmanifold volume face')
    return faces


def choose_diagonals(rows,nodes):
    faces=solid_faces(rows,nodes);choices={};changes=[];failures=[]
    for key,copies in faces.items():
        q=s.canonical_quad(copies[0][0]);candidates=[q,q[1:]+q[:1]]
        edges={tuple(sorted((q[0],q[2]))),tuple(sorted((q[1],q[3])))}
        for quad,_,_ in copies:
            require({tuple(sorted((quad[0],quad[2]))),tuple(sorted((quad[1],quad[3])))}==edges,'Shared face has inconsistent cyclic order')
        checks=[[diagnostic.face_diagnostics(candidate,centre,nodes) for _,centre,_ in copies] for candidate in candidates]
        # A shared surface must point in opposite directions for its two cells.
        # Passing each centre separately is insufficient when both lie on one side.
        allowed=[all(c['passes'] for c in check) and (len(check)==1 or check[0]['orientation']*check[1]['orientation']<0) for check in checks]
        if not any(allowed):
            failures.append(dict(quadNodeIds=key,elementIds=[r[2] for r in copies],candidateChecks=checks));continue
        chosen=0 if allowed[0] else 1
        quad=candidates[chosen];choices[key]=tuple(sorted((quad[0],quad[2])))
        if chosen:changes.append(dict(quadNodeIds=key,elementIds=[r[2] for r in copies],diagonal=choices[key]))
    return choices,dict(uniqueSolidFaces=len(faces),sharedSolidFaces=sum(len(c)==2 for c in faces.values()),
                        changedDiagonals=changes,failures=failures)


def orient_quad(q,choices):
    q=tuple(q);edge=choices.get(tuple(sorted(q)))
    if edge is None:return s.canonical_quad(q)
    if tuple(sorted((q[0],q[2])))==edge:return q
    require(tuple(sorted((q[1],q[3])))==edge,'Choice is not a source quad diagonal')
    return q[1:]+q[:1]


def boundary(rows,nodes,choices):
    faces=solid_faces(rows,nodes);quads=[];internal=0
    for key,copies in faces.items():
        if len(copies)==2:internal+=1;continue
        require(key in choices,'Unresolved solid face')
        q,centre,_=copies[0];q=orient_quad(q,choices)
        check=diagnostic.face_diagnostics(q,centre,nodes)
        require(check['passes'],'Chosen triangles fail original orientation guard')
        quads.append(q if check['orientation']>0 else (q[0],q[3],q[2],q[1]))
    return quads,internal


def triangulate(quads,nodes,choices):
    ids=sorted({n for q in quads for n in q});lookup={n:i for i,n in enumerate(ids)}
    positions=[v for n in ids for v in (nodes[n][1]/1000,nodes[n][2]/1000,nodes[n][0]/1000)]
    indices=[]
    for quad in quads:
        q=orient_quad(quad,choices)
        for tri in ((q[0],q[1],q[2]),(q[0],q[2],q[3])):
            p=[nodes[n] for n in tri];normal=s.cross(s.sub(p[1],p[0]),s.sub(p[2],p[0]))
            require(s.dot(normal,normal)>1e-18,'Degenerate triangle')
            indices.extend(lookup[n] for n in tri)
    error=max((abs(positions[i*3+a]*1000-nodes[n][(1,2,0)[a]]) for i,n in enumerate(ids) for a in range(3)),default=0)
    require(error<1e-9,'Source coordinates changed')
    return dict(sourceNodeIds=ids,positions=positions,indices=indices),error
