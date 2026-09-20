"""Experimental source-frame surfaces only; writes ignored .cache, never public assets.

This is a geometric boundary extraction, not a simulation or tissue segmentation.
Material shell thicknesses are NOT extruded into invented anatomy.
"""
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import zipfile

SPEC = importlib.util.spec_from_file_location('source', Path(__file__).with_name('audit-vivaplus.py'))
source = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(source)
HEX_FACES = ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
             (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7))


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def centroid(points):
    return [sum(p[i] for p in points) / len(points) for i in range(3)]


def canonical_quad(q):
    source.require(len(q) == 4 and len(set(q)) == 4, 'Expected distinct quad nodes')
    return ((q[1], q[2], q[3], q[0])
            if tuple(sorted((q[0], q[2]))) > tuple(sorted((q[1], q[3]))) else tuple(q))


def hex_boundary(cells, nodes):
    """Cancel shared node-ID faces across all selected parts; orient exterior quads.

    Eight distinct corner nodes in standard hexahedral order are required.
    Matching coordinates with different node IDs are not silently welded.
    """
    faces = collections.defaultdict(list)
    seen = set()
    for cell in cells:
        source.require(len(cell) == 8 and len(set(cell)) == 8, 'Expected eight distinct hex nodes')
        signature = tuple(sorted(cell))
        source.require(signature not in seen, 'Duplicate volume cell')
        seen.add(signature)
        centre = centroid([nodes[n] for n in cell])
        for local in HEX_FACES:
            ids = tuple(cell[i] for i in local)
            faces[tuple(sorted(ids))].append((ids, centre))
    boundary, internal = [], 0
    for copies in faces.values():
        source.require(len(copies) <= 2, 'Nonmanifold volume face')
        if len(copies) == 2:
            internal += 1
            continue
        ids, centre = copies[0]
        ids = canonical_quad(ids)
        p = [nodes[n] for n in ids]
        normals = [cross(sub(p[1], p[0]), sub(p[2], p[0])),
                   cross(sub(p[2], p[0]), sub(p[3], p[0]))]
        normal = [a + b for a, b in zip(*normals)]
        orientation = dot(normal, sub(centroid(p), centre))
        source.require(math.isfinite(orientation) and abs(orientation) > 1e-12,
                       'Degenerate boundary face or invalid cell centre')
        direction = 1 if orientation > 0 else -1
        source.require(all(direction * dot(n, sub(p[0], centre)) > 1e-12 for n in normals),
                       'Boundary triangles disagree about outward direction')
        boundary.append(ids if orientation > 0 else (ids[0], ids[3], ids[2], ids[1]))
    return boundary, internal


def triangulate(quads, nodes):
    source_ids = sorted({n for quad in quads for n in quad})
    lookup = {n: i for i, n in enumerate(source_ids)}
    positions = [v for n in source_ids for v in (nodes[n][1] / 1000, nodes[n][2] / 1000, nodes[n][0] / 1000)]
    indices = []
    for q in quads:
        # Adjacent groups may enumerate a warped face with different starting
        # corners. Choose the same node-ID diagonal for either orientation.
        # Otherwise two tessellations of one shared quad can appear to cross.
        q = canonical_quad(q)
        for tri in ((q[0], q[1], q[2]), (q[0], q[2], q[3])):
            p = [nodes[n] for n in tri]
            source.require(dot(cross(sub(p[1], p[0]), sub(p[2], p[0])),
                               cross(sub(p[1], p[0]), sub(p[2], p[0]))) > 1e-18,
                           'Degenerate triangle')
            indices.extend(lookup[n] for n in tri)
    error = max((abs(positions[i * 3 + axis] * 1000 - nodes[n][(1, 2, 0)[axis]])
                 for i, n in enumerate(source_ids) for axis in range(3)), default=0)
    source.require(error < 1e-9, 'Coordinate conversion changed source positions')
    return dict(sourceNodeIds=source_ids, positions=positions, indices=indices), error


def component_summary(mesh):
    """Index-connected components; signed volumes are geometric, not tissue names."""
    roots = list(range(len(mesh['sourceNodeIds'])))
    def root(i):
        while roots[i] != i:
            roots[i] = roots[roots[i]]
            i = roots[i]
        return i
    triangles = [mesh['indices'][i:i + 3] for i in range(0, len(mesh['indices']), 3)]
    for a, b, c in triangles:
        roots[root(b)] = root(a)
        roots[root(c)] = root(a)
    groups = collections.defaultdict(list)
    for tri in triangles:
        groups[root(tri[0])].append(tri)
    p = [mesh['positions'][i:i + 3] for i in range(0, len(mesh['positions']), 3)]
    result = []
    for triangles in groups.values():
        used = sorted({i for tri in triangles for i in tri})
        origin = centroid([p[i] for i in used])
        volume = math.fsum(dot(sub(p[a], origin), cross(sub(p[b], origin), sub(p[c], origin))) / 6
                           for a, b, c in triangles)
        result.append(dict(minSourceNodeId=min(mesh['sourceNodeIds'][i] for i in used),
                           triangles=len(triangles), vertices=len(used), signedVolumeMm3=volume * 1e9))
    return sorted(result, key=lambda row: row['minSourceNodeId'])


def extract():
    path = Path('.cache/vivaplus/vivaplus-v2.0.2.zip')
    report = source.audit(path)
    with zipfile.ZipFile(path) as archive:
        nodes = source.read_nodes(archive.read(source.ROOT + source.FILES['nodes']).decode())
        parts = source.read_parts(archive.read(source.ROOT + source.FILES['parts']).decode())
        elements = archive.read(source.ROOT + source.FILES['elements']).decode()
    shells, solids = collections.defaultdict(list), collections.defaultdict(list)
    for keyword, rows in source.blocks(elements):
        if keyword not in ('*ELEMENT_SHELL', '*ELEMENT_SOLID'):
            continue
        for row in rows:
            values = [int(row[i * 8:(i + 1) * 8]) for i in range(6 if keyword == '*ELEMENT_SHELL' else 10)]
            _, pid, *ids = values
            if pid in parts:
                (shells if keyword == '*ELEMENT_SHELL' else solids)[pid].append(ids)
    meshes, summaries = [], []
    for side, offset in (('left', 0), ('right', 50000)):
        groups = [
            # A single union of volume elements prevents material interfaces from
            # being mistaken for additional anatomical surfaces.
            ('clavicle', 'solid-boundary', [301102]),
            ('scapula', 'solid-boundary', [301202]),
            ('humerus', 'solid-boundary', [301311, 301312, 301321, 301331, 301332]),
            ('ulna', 'solid-boundary', [301411, 301412, 301421, 301431, 301432]),
            ('radius', 'solid-boundary', [301511, 301512, 301521, 301531, 301532]),
            ('carpal-aggregate', 'solid-boundary', [301603]),
            ('phalangeal-aggregate', 'solid-boundary', [303001]),
            ('humerus-null', 'source-shell', [301309]),
            ('ulna-null', 'source-shell', [301409]),
            ('radius-null', 'source-shell', [301509]),
            ('skin', 'source-shell', [305121, 305131, 305141, 305161]),
            ('subscapularis', 'solid-boundary', [305201]),
        ]
        for name, method, base_pids in groups:
            pids = [p + offset for p in base_pids]
            cells = [cell for pid in pids for cell in (solids if method == 'solid-boundary' else shells)[pid]]
            source.require(cells and all(pid in parts for pid in pids), 'Missing source group')
            quads, internal = hex_boundary(cells, nodes) if method == 'solid-boundary' else (cells, 0)
            duplicateQuads = len(quads) - len({tuple(sorted(q)) for q in quads})
            mesh, error = triangulate(quads, nodes)
            mesh.update(id=f'{side}-{name}', side=side, name=name, method=method, sourcePartIds=pids)
            meshes.append(mesh)
            summaries.append(dict(id=mesh['id'], method=method, sourcePartIds=pids,
                                  sourcePartNames=[parts[pid] for pid in pids], cells=len(cells),
                                  removedInternalFaces=internal, boundaryQuads=len(quads),
                                  duplicateQuadsByNodeIds=duplicateQuads,
                                  vertices=len(mesh['sourceNodeIds']), triangles=len(mesh['indices']) // 3,
                                  solidBoundaryComponents=component_summary(mesh) if method == 'solid-boundary' else None,
                                  maxCoordinateRoundtripErrorMm=error))
    output = Path('.cache/vivaplus/surfaces.json')
    output.write_text(json.dumps(dict(source=report['source'], meshes=meshes), separators=(',', ':'), allow_nan=False) + '\n')
    summary = dict(source=report['source'], displayTransform='(x,y,z) mm -> (y,z,x)/1000 m',
                   geometryFileSha256=hashlib.sha256(output.read_bytes()).hexdigest(),
                   groups=summaries, deployed=False, hraRegistered=False, anatomicallyValidated=False,
                   limitations=['Solid boundary is finite-element geometry, not additional segmented tissue.',
                                'Clavicle/scapula trabecular boundary coincides with shell reference surface; shell thickness is not extruded.',
                                'Quads use a canonical source-node-ID diagonal; warped quads are not exact FE interpolation surfaces.',
                                'Shell null surfaces are alternate computational representations; do not render/count them as extra bones.',
                                'Source shell winding is preserved, not repaired; duplicate quad counts are reported without deleting geometry.',
                                'No coordinate welding, smoothing, repositioning, joint repair or HRA overlay.'])
    Path('.cache/vivaplus/surface-extraction.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps(dict(groups=len(meshes), triangles=sum(s['triangles'] for s in summaries),
                         maxRoundtripErrorMm=max(s['maxCoordinateRoundtripErrorMm'] for s in summaries))))


if __name__ == '__main__':
    extract()
