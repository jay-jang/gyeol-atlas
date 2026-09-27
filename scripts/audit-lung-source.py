"""Review every 4.3 lung mesh and cross-cohort nearest-vertex relationships.

Bounding-box lower bounds prune an otherwise exhaustive Hausdorff-vertex search.
No surface registration, automatic replacement or runtime mutation is performed.
"""
import hashlib
from importlib.util import spec_from_file_location, module_from_spec
import json
import subprocess
from pathlib import Path
import zipfile
import numpy as np
from scipy.spatial import cKDTree

spec = spec_from_file_location('probe', Path(__file__).with_name('audit-pulmonary-source-probe.py'))
probe = module_from_spec(spec)
spec.loader.exec_module(probe)


def main():
    source_path = Path('.cache/bp4-official/lung43/receipt.json')
    source = json.loads(source_path.read_text())
    for row in source['archives']:
        assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest() == row['sha256']
    parts, vertices, trees, bounds, triangles = {}, {}, {}, {}, {}
    archives = {a['file']: zipfile.ZipFile(a['file']) for a in source['archives']}
    try:
        for row in source['parts']:
            raw = archives[row['archive']].read(row['entry'])
            assert hashlib.sha256(raw).hexdigest() == row['sha256']
            header, v, f = probe.mesh(raw)
            id = row['id']
            assert header['File ID'] == id and header['Compatibility version'] == '4.3'
            parts[id] = row
            vertices[id], triangles[id], trees[id] = v, f, cKDTree(v)
            bounds[id] = np.array([v.min(axis=0), v.max(axis=0)])
    finally:
        for archive in archives.values():
            archive.close()
    baseline_ref = '66db40fadf2fcb19237abb57202bfbd2ed9da4a6'
    baseline_groups = json.loads(subprocess.check_output(['git','show',f'{baseline_ref}:data/male-detail-groups.json']))
    existing = {id.removeprefix('BP4_') for g in baseline_groups if g['id'] == 'lung' for id in g['ids']}
    common = sorted(existing & parts.keys())
    added = sorted(parts.keys()-existing)
    old_bounds = np.asarray([bounds[id] for id in common])
    matches = []
    for id in added:
        lower = np.abs(old_bounds-bounds[id]).max(axis=(1, 2))
        best = None
        checked = 0
        for n in np.argsort(lower):
            if best is not None and lower[n] > best['maximumMm']:
                break
            other = common[n]
            forward = trees[other].query(vertices[id])[0]
            reverse = trees[id].query(vertices[other])[0]
            score = max(float(forward.max()), float(reverse.max()))
            checked += 1
            if best is None or score < best['maximumMm']:
                best = {'id': other, 'maximumMm': score, 'forwardMaxMm': float(forward.max()),
                        'reverseMaxMm': float(reverse.max()), 'forwardP95Mm': float(np.percentile(forward,95)),
                        'reverseP95Mm': float(np.percentile(reverse,95))}
        matches.append({'id': id, 'cohort': parts[id]['listing']['artg_name'],
                        'concept': parts[id]['header']['Concept ID'], 'name': parts[id]['header']['English name'],
                        'nearestExistingMesh': best, 'evaluatedCandidates': checked})
    rows = [{'id': id, 'header': parts[id]['header'], 'sourceFilename': parts[id]['listing']['art_name'],
             'cohort': parts[id]['listing']['artg_name'], 'vertices': len(vertices[id]), 'triangles': len(triangles[id]),
             'boundsMm': bounds[id].tolist(), 'sha256': parts[id]['sha256']} for id in sorted(parts)]
    matched = {m['nearestExistingMesh']['id'] for m in matches if m['nearestExistingMesh']['maximumMm'] < 5}
    report = {'status': 'Offline source review; not anatomical approval or runtime replacement', 'baselineRef':baseline_ref, 'parts': rows,
              'newToExisting': matches, 'existingWithoutNewMatchWithin5mm': sorted(set(common)-matched),
              'excluded40Ids': sorted(existing-parts.keys()),
              'files': [{'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                        for p in [source_path, Path(__file__).resolve().relative_to(Path.cwd())]],
              'limitations': ['Distances are symmetric Hausdorff distances between vertex sets, not surfaces or clinical anatomy.',
                             '5mm labels a diagnostic near-match, not an acceptance or deletion threshold.',
                             'Source artist/date cohorts are not by themselves proof of mutually exclusive anatomical coverage.']}
    Path('docs/anatomy-alignment/lung-source-cohorts.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'parts': len(rows), 'vertices': sum(r['vertices'] for r in rows), 'triangles': sum(r['triangles'] for r in rows),
                      'added': len(added), 'nearMatchesUnder5mm': sum(m['nearestExistingMesh']['maximumMm'] < 5 for m in matches),
                      'existingWithoutNewMatchWithin5mm': report['existingWithoutNewMatchWithin5mm'],
                      'farMatchIds': [m['id'] for m in matches if m['nearestExistingMesh']['maximumMm'] >= 5]}, indent=2))


if __name__ == '__main__':
    main()
