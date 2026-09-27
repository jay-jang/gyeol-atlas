"""Compare version-stamped pulmonary OBJ coordinates without modifying the atlas."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

import numpy as np
from scipy.spatial import cKDTree


def mesh(raw):
    text = raw.decode()
    header = dict(re.findall(r'^# ([^:\n]+?)\s*:\s*(.*)$', text, re.M))
    vertices, triangles = [], []
    for line in text.splitlines():
        if line.startswith('v '):
            vertices.append([float(v) for v in line.split()[1:4]])
        elif line.startswith('f '):
            indices = [int(v.split('/')[0]) for v in line.split()[1:]]
            indices = [i-1 if i > 0 else len(vertices)+i for i in indices]
            for j in range(1, len(indices)-1):
                triangles.append([indices[0], indices[j], indices[j+1]])
    vertices, triangles = np.asarray(vertices), np.asarray(triangles, dtype=np.int64)
    assert vertices.ndim == triangles.ndim == 2
    assert vertices.shape[1] == triangles.shape[1] == 3
    assert np.isfinite(vertices).all() and triangles.min() >= 0 and triangles.max() < len(vertices)
    return header, vertices, triangles


def distances(a, b):
    forward = cKDTree(b).query(a)[0]
    reverse = cKDTree(a).query(b)[0]
    return {'forwardMaxMm': float(forward.max()), 'reverseMaxMm': float(reverse.max()),
            'forwardP95Mm': float(np.percentile(forward, 95)), 'reverseP95Mm': float(np.percentile(reverse, 95)),
            'minimumVertexDistanceMm': float(forward.min())}


def main():
    root = Path('.cache/bp4-official')
    receipt = json.loads((root/'v43-pulmonary-source.json').read_text())
    archive = Path(receipt['archive'])
    assert hashlib.sha256(archive.read_bytes()).hexdigest() == receipt['archiveSha256']
    existing_ids = ['FJ2974', 'FJ2975', 'FJ2976', 'FJ2977', 'FJ2979', 'FJ2980', 'FJ2981']
    new_ids = ['FJ6044', 'FJ6045', 'FJ6046', 'FJ6047', 'FJ6049', 'FJ6050', 'FJ6051']
    current, newer, records = {}, {}, []
    with zipfile.ZipFile(root/'isa_BP3D_4.0_obj_99.zip') as old, zipfile.ZipFile(archive) as new:
        assert old.testzip() is None and new.testzip() is None
        for id in ['FJ2041', 'FJ2044', *existing_ids]:
            header, vertices, triangles = mesh(old.read(f'isa_BP3D_4.0_obj_99/{id}.obj'))
            assert header['File ID'] == id and header['Compatibility version'] == '4.0'
            current[id] = vertices
        for row in receipt['parts']:
            id = row['metadata']['art_id']
            raw = new.read(row['entry'])
            assert hashlib.sha256(raw).hexdigest() == row['sha256']
            header, vertices, triangles = mesh(raw)
            assert header['File ID'] == id and header['Compatibility version'] == '4.3'
            newer[id] = vertices
            records.append({'id': id, 'header': header, 'vertices': len(vertices), 'triangles': len(triangles),
                            'boundsMm': [vertices.min(axis=0).tolist(), vertices.max(axis=0).tolist()],
                            'sha256': row['sha256'], 'listingRepresentation': row['metadata']['rep_id'],
                            'objRepresentation': header['Representation ID'],
                            'sameId40Distances': distances(current[id], vertices) if id in current else None})
    pairs = [{'oldId': a, 'addedId': b, **distances(newer[a], newer[b])} for a, b in zip(existing_ids, new_ids)]
    target = np.concatenate([newer[id] for id in new_ids])
    detached = [{'id': id, 'rawBoundsMm': [current[id].min(axis=0).tolist(), current[id].max(axis=0).tolist()],
                 'verticalBoxGapMm': float(target[:, 2].min()-current[id][:, 2].max()),
                 **distances(current[id], target)} for id in ['FJ2041', 'FJ2044']]
    report = {'status': 'Offline source comparison; no runtime changes', 'parts': records,
              'nearbyVersionPairs': pairs, 'detached40Parts': detached,
              'limitations': ['Nearest-vertex distances are not surface distances, connectivity, anatomical registration or duplicate-proof.',
                             'The seven comparison pairs were selected by corresponding source filename suffixes; no files were removed.',
                             'Official part_of membership includes the old seven branch IDs and seven added parent-concept IDs. Automatic union can overlay closely matching geometry.',
                             'Exporter representation IDs differ from upload-list IDs; actual OBJ 4.3 headers are preserved.'],
              'files': [{'file': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                        for path in [archive, root/'v43-pulmonary-source.json', root/'v43-upload-list.html', Path(__file__)]]}
    output = Path('docs/anatomy-alignment/pulmonary-source-probe.json')
    output.write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'parts': len(records), 'versionPairs': pairs, 'detached': detached}, indent=2))


if __name__ == '__main__':
    main()
