"""Source-frame head surfaces in ignored cache only; no HRA registration/export.

Do not extrude finite-element shell thickness or label computational nulls/CSF
as neural tissue. Existing strict hex extraction preserves source node mapping.
"""
import hashlib
import importlib.util
import json
from pathlib import Path

def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value

head = module('viva_head', 'audit-vivaplus-head.py')
surface = module('viva_surface', 'extract-vivaplus-surfaces.py')
require = head.source.require


def extract_group(ids, method, elements, nodes):
    rows = [r for pid in ids for r in elements[pid]]
    require(rows, 'Empty surface group')
    if method == 'solid-boundary':
        require(all(r['keyword'] == '*ELEMENT_SOLID' for r in rows), 'Non-solid in solid group')
        faces, internal = surface.hex_boundary([r['nodes'] for r in rows], nodes)
    else:
        require(method == 'shell-reference', 'Unsupported extraction method')
        require(all(r['keyword'] in ('*ELEMENT_SHELL', '*ELEMENT_SHELL_THICKNESS') for r in rows), 'Non-shell in shell group')
        faces, internal = [r['nodes'] for r in rows], 0
    mesh, error = surface.triangulate(faces, nodes)
    return mesh, dict(cells=len(rows), removedInternalFaces=internal, boundaryQuads=len(faces),
                      duplicateQuads=len(faces)-len({tuple(sorted(q)) for q in faces}),
                      vertices=len(mesh['sourceNodeIds']), triangles=len(mesh['indices'])//3,
                      components=surface.component_summary(mesh), maxCoordinateRoundtripErrorMm=error)


def extract():
    nodes, parts, elements, metadata = head.load_head()
    require(len(parts) == 73 and len(nodes) == 564960, 'Pinned head inventory changed')
    meshes, summaries, failures = [], [], []
    for pid, name in sorted(parts.items()):
        kinds = {r['keyword'] for r in elements[pid]}
        method = 'solid-boundary' if kinds == {'*ELEMENT_SOLID'} else 'shell-reference'
        try:
            mesh, summary = extract_group([pid], method, elements, nodes)
        except ValueError as error:
            failures.append(dict(id=str(pid),name=name,method=method,sourcePartIds=[pid],error=str(error)))
            continue
        mesh.update(id=str(pid), name=name, method=method, sourcePartIds=[pid])
        meshes.append(mesh); summaries.append(dict(id=str(pid), name=name, method=method, sourcePartIds=[pid], **summary))
    # Source IDs were inspected in the pinned head PART file; material partitions
    # are not additional anatomical bones. Nulls, CSF and oral cavity are excluded.
    brain_ids = [103000,105000,106000,107000,153000,155000,156000,157000]
    skull_ids = [101102,101202,101302,101402,101502,101602,101702,101802,
                 151102,151202,151302,151402,151502,151602,151702,151802]
    for name, ids, method in [('brain-tissue-union',brain_ids,'solid-boundary'),
                              ('skull-trabecular-union',skull_ids,'solid-boundary'),
                              ('head-skin-union',[104002,154002],'shell-reference')]:
        try:
            mesh, summary = extract_group(ids,method,elements,nodes)
        except ValueError as error:
            failures.append(dict(id=name,name=name,method=method,sourcePartIds=ids,error=str(error)))
            continue
        mesh.update(id=name,name=name,method=method,sourcePartIds=ids)
        meshes.append(mesh); summaries.append(dict(id=name,name=name,method=method,sourcePartIds=ids,**summary))
    folder=Path('.cache/vivaplus-head');folder.mkdir(exist_ok=True)
    output=folder/'surfaces.json'
    output.write_text(json.dumps(dict(source=metadata,meshes=meshes),separators=(',', ':'),allow_nan=False)+'\n')
    report=dict(source=metadata,status='INCOMPLETE SOURCE EXTRACTION' if failures else 'EXPERIMENTAL SOURCE BOUNDARIES ONLY; no HRA fitting or export',
                geometrySha256=hashlib.sha256(output.read_bytes()).hexdigest(),groups=summaries,failures=failures,
                displayTransform='(x,y,z) mm -> (y,z,x)/1000 m',
                code=[dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [Path(__file__),Path(head.__file__),Path(surface.__file__),Path(head.source.__file__)]],
                limitations=['73 PART surfaces and three union diagnostics are not 76 anatomical organs.',
                             'The skull union is trabecular solid boundaries only: cortical shell thickness, mandible and teeth are excluded.',
                             'Eight brain-labelled source partitions are grouped without CSF, oral cavity or nulls; this does not certify their biological fidelity.',
                             'Shared solid faces are removed by original node ID, no coordinate welding/smoothing/fitting.',
                             'Shell reference surfaces omit section/per-element thickness; no physical inner/outer shell geometry is invented.',
                             'Canonical quad triangulation approximates warped FE faces; not exact finite-element interpolation.',
                             'Not registered to HRA, not a complete female skeletal replacement, not deployed.'])
    (folder/'extraction.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps(dict(groups=len(meshes),triangles=sum(s['triangles'] for s in summaries),
                         unionSummaries=[s for s in summaries if s['id'].endswith('union')],failures=failures)))


if __name__ == '__main__':
    extract()
