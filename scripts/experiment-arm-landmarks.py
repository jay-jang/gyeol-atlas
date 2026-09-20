"""Offline skin cross-sections for articulated donor registration research.

Reports geometric wrist candidates, NOT validated articular joint centres.
No public model, source vertices, or runtime registration is changed.
"""
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import ConvexHull

ROOT = Path(__file__).resolve().parents[1]
files = {}


def read_atlas(relative):
    path = ROOT / relative
    files[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
    return json.loads(path.read_text())


def mesh(atlas, part, folder):
    chunk = atlas['chunks'][part['chunk']]
    relative = folder + '/' + chunk['gzip'].split('/')[-1]
    compressed = (ROOT / relative).read_bytes()
    files[relative] = hashlib.sha256(compressed).hexdigest()
    assert len(compressed) == chunk['gzipBytes']
    data = gzip.decompress(compressed)
    assert len(data) == chunk['bytes']
    points = np.frombuffer(data, '<f4', part['vertexCount'] * 3, part['positions']).reshape(-1, 3).astype(float)
    triangles = np.frombuffer(data, '<u4', part['indexCount'], part['indices']).reshape(-1, 3)
    return points, triangles


def distal_arm(points, triangles, side, cut):
    allowed = (points[:, 1] < cut) & (points[:, 0] * side > 0)
    tri = triangles[allowed[triangles].all(axis=1)]
    edges = np.concatenate((tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]))
    graph = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(len(points), len(points)))
    _, labels = connected_components(graph, directed=False)
    used = np.unique(tri)
    seed = used[np.argmax(points[used, 0] * side)]
    tri = tri[(labels[tri] == labels[seed]).all(axis=1)]
    selected = points[np.unique(tri)]
    assert len(selected) > 200
    assert selected[:, 1].min() > .45 and (selected[:, 0] * side).min() > .07
    return tri, selected


def section(points, triangles, origin, axis, basis):
    tri = points[triangles]
    distances = (tri - origin) @ axis
    # Include vertices/edges lying on the plane, including a coplanar face.
    distances[np.abs(distances) < 1e-12] = 0
    crosses = (distances.min(axis=1) <= 0) & (distances.max(axis=1) >= 0)
    tri, distances = tri[crosses], distances[crosses]
    intersections = [tri[distances == 0]]
    for a, b in [(0, 1), (1, 2), (2, 0)]:
        mask = distances[:, a] * distances[:, b] < 0
        t = distances[mask, a] / (distances[mask, a] - distances[mask, b])
        intersections.append(tri[mask, a] + t[:, None] * (tri[mask, b] - tri[mask, a]))
    vertices = np.unique(np.concatenate(intersections), axis=0)
    if len(vertices) < 3:
        raise ValueError('Plane does not define a polygonal section')
    projected = (vertices - origin) @ basis.T
    hull = ConvexHull(projected)
    polygon = projected[hull.vertices]
    next_polygon = np.roll(polygon, -1, axis=0)
    cross = polygon[:, 0] * next_polygon[:, 1] - next_polygon[:, 0] * polygon[:, 1]
    centroid = ((polygon + next_polygon) * cross[:, None]).sum(axis=0) / (3 * cross.sum())
    return {'hullAreaMm2': float(hull.volume * 1e6),
            'centroid': (centroid @ basis + origin).tolist(),
            'sectionVertices': int(len(vertices)),
            'hullVertices': int(len(hull.vertices))}


def main():
    male = read_atlas('.cache/male-details/atlas.json')
    female = read_atlas('public/models/female/atlas-female.json')
    assert files['.cache/male-details/atlas.json'] == 'd6979fc62cf18fa4f08a9e6efae8fdac9ec383c5a1f3c757920125ac758429fe'
    report = {'status': 'GEOMETRIC CANDIDATES ONLY: skin constriction is not an articular joint centre',
              'method': 'Triangle-plane intersections; convex hull area (not true possibly concave section area); PCA arm axis; distance measured from distal skin projection',
              'profiles': []}
    for body, atlas, folder, cuts in [('source', male, '.cache/arm-registration', {'left': 1.22, 'right': 1.20}),
                                    ('target', female, 'public/models/female', {'left': 1.17, 'right': 1.17})]:
        skin = next(p for p in atlas['parts'] if p['name'] == 'Skin')
        points, triangles = mesh(atlas, skin, folder)
        for side, label in [(1, 'left'), (-1, 'right')]:
            cut = cuts[label]
            arm_triangles, arm = distal_arm(points, triangles, side, cut)
            centre = arm.mean(axis=0)
            _, _, directions = np.linalg.svd(arm - centre, full_matrices=False)
            axis = directions[0]
            if axis[1] > 0:
                axis = -axis
            basis = directions[1:]
            distal = float(np.max((arm - centre) @ axis))
            rows = []
            for distance in np.arange(.05, .302, .002):
                origin = centre + axis * (distal - distance)
                rows.append({'distanceFromDistalMm': float(distance * 1000),
                             **section(points, arm_triangles, origin, axis, basis)})
            minima = [r for i, r in enumerate(rows[1:-1], 1)
                      if 140 <= r['distanceFromDistalMm'] <= 230
                      and r['hullAreaMm2'] < rows[i-1]['hullAreaMm2']
                      and r['hullAreaMm2'] < rows[i+1]['hullAreaMm2']]
            item = {'body': body, 'side': label, 'cutY': cut, 'axis': axis.tolist(),
                    'centre': centre.tolist(), 'distalProjection': distal,
                    'wristSearchWindowMm': [140, 230], 'localMinima': minima, 'sections': rows}
            report['profiles'].append(item)
            print(json.dumps({k: v for k, v in item.items() if k not in ['sections', 'centre', 'axis']}))
    report['files'] = [{'path': p, 'sha256': h} for p, h in files.items()]
    report['files'].append({'path': str(Path(__file__).relative_to(ROOT)),
                            'sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
    (ROOT / '.cache/arm-registration/landmarks.json').write_text(json.dumps(report, indent=2) + '\n')


if __name__ == '__main__':
    main()
