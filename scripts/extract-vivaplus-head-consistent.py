"""Partial cache-only head candidate; unresolved groups fail, never lose faces."""
import hashlib
import importlib.util
import json
from pathlib import Path
spec=importlib.util.spec_from_file_location('triangulation',Path(__file__).with_name('lib')/'viva-head-triangulation.py')
t=importlib.util.module_from_spec(spec);spec.loader.exec_module(t)
head=t.diagnostic.extract.head


def extract():
    nodes,parts,elements,metadata=head.load_head()
    rows=[r for records in elements.values() for r in records if r['keyword']=='*ELEMENT_SOLID']
    choices,choice_report=t.choose_diagonals(rows,nodes)
    part_by_element={r['id']:pid for pid,records in elements.items() for r in records}
    for failure in choice_report['failures']:
        failure['sourcePartIds']=[part_by_element[eid] for eid in failure['elementIds']]
        failure['withinSinglePart']=len(set(failure['sourcePartIds']))==1
    folder=Path('.cache/vivaplus-head');folder.mkdir(exist_ok=True)
    (folder/'diagonals.json').write_text(json.dumps(choice_report,indent=2,allow_nan=False)+'\n')
    unresolved={tuple(f['quadNodeIds']) for f in choice_report['failures']}
    groups=[(str(pid),name,[pid],'solid-boundary' if {r['keyword'] for r in elements[pid]}=={'*ELEMENT_SOLID'} else 'shell-reference') for pid,name in sorted(parts.items())]
    groups += [('brain-tissue-union','brain-tissue-union',[103000,105000,106000,107000,153000,155000,156000,157000],'solid-boundary'),
               ('skull-trabecular-union','skull-trabecular-union',[101102,101202,101302,101402,101502,101602,101702,101802,151102,151202,151302,151402,151502,151602,151702,151802],'solid-boundary'),
               ('head-skin-union','head-skin-union',[104002,154002],'shell-reference')]
    meshes=[];summaries=[];failures=[]
    for id,name,ids,method in groups:
        selected=[r for pid in ids for r in elements[pid]]
        try:
            if method=='solid-boundary':quads,internal=t.boundary(selected,nodes,choices)
            else:
                t.require(all(r['keyword'] in ('*ELEMENT_SHELL','*ELEMENT_SHELL_THICKNESS') for r in selected),'Unexpected shell keyword')
                quads=[r['nodes'] for r in selected];internal=0
                t.require(not any(tuple(sorted(q)) in unresolved for q in quads),'Shell shares an unresolved solid face')
            mesh,error=t.triangulate(quads,nodes,choices)
        except ValueError as error:
            failures.append(dict(id=id,name=name,sourcePartIds=ids,method=method,error=str(error)))
            continue
        mesh.update(id=id,name=name,method=method,sourcePartIds=ids);meshes.append(mesh)
        summaries.append(dict(id=id,name=name,sourcePartIds=ids,method=method,cells=len(selected),removedInternalFaces=internal,
                              vertices=len(mesh['sourceNodeIds']),triangles=len(mesh['indices'])//3,maxCoordinateRoundtripErrorMm=error))
    output=folder/'consistent-surfaces.json'
    output.write_text(json.dumps(dict(source=metadata,meshes=meshes),separators=(',', ':'),allow_nan=False)+'\n')
    report=dict(source=metadata,status='PARTIAL SOURCE LINEARIZATION; no HRA fitting or deployment',geometrySha256=hashlib.sha256(output.read_bytes()).hexdigest(),failures=failures,
                groups=summaries,choiceSummary={k:v for k,v in choice_report.items() if k!='changedDiagonals'},changedDiagonalCount=len(choice_report['changedDiagonals']),
                code=[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [Path(__file__),Path(t.__file__),Path(t.diagnostic.__file__),Path(head.__file__),Path(t.s.__file__)]],
                limitations=['Original source node positions/IDs are retained; only planar triangulation of warped quadrilateral faces changes.',
                             'A single diagonal must satisfy the existing cell-centre orientation guard on every incident volume cell; this does not prove biological accuracy or FE validity.',
                             'Shell thickness is omitted, no cortical volume is fabricated. Skull union includes only trabecular volumes, not mandible/teeth.',
                             'Three unions are additional diagnostics, not three extra organs. Do not draw both union and component surfaces as duplicate anatomy.',
                             'CSF, oral cavity and computational nulls are not neural tissue.',
                             'Groups with unresolved boundary faces are rejected in full, not exported with holes. Cancelled interior faces are not rendered or assigned diagonals.',
                             'No HRA correspondence, skin fit, full female replacement, or runtime/clinical validation.'])
    (folder/'consistent-extraction.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps(dict(groups=len(meshes),triangles=sum(r['triangles'] for r in summaries),changedDiagonals=len(choice_report['changedDiagonals']),failedFaces=len(choice_report['failures']),failures=failures)))

if __name__=='__main__':extract()
