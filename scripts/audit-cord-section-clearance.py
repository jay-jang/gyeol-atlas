"""Offline 2-D source-section translation diagnostic; never edits atlas geometry."""
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np

from lib.mesh_plane_sections import sections


SOURCE = Path('docs/anatomy-alignment/neural-component-source.json')
OUTPUT = Path('docs/anatomy-alignment/cord-section-clearance.json')
HALF_WIDTH_MM = 6.0
STEP_MM = 0.5
PLANE_OFFSET_MM = 0.137  # avoid the source vertex used as the deepest witness


def xy_segments(part, y):
    position = np.asarray(part['positions'], dtype=np.float64).reshape(-1, 3)
    index = np.asarray(part['indices'], dtype=np.int64)
    result = sections(position, index, 1, y, epsilon=1e-10)
    return result['segments'][:, :, [0, 2]], result


def nonmanifold_section_nodes(segments):
    if not len(segments):
        return 0
    # 1 nm rounding only absorbs floating arithmetic at shared source edges.
    nodes = np.rint(segments.reshape(-1, 2) * 1e9).astype(np.int64)
    _, counts = np.unique(nodes, axis=0, return_counts=True)
    return int(np.count_nonzero(counts != 2))


def proper_or_touching_crossings(a, b, tolerance=1e-12):
    """Return whether any segments intersect; collinear contact is also a collision."""
    if not len(a) or not len(b):
        return False
    amin, amax = a.min(axis=1), a.max(axis=1)
    bmin, bmax = b.min(axis=1), b.max(axis=1)
    pair = ((amin[:, None, :] <= bmax[None, :, :] + tolerance) &
            (bmin[None, :, :] <= amax[:, None, :] + tolerance)).all(axis=2)
    rows, columns = np.nonzero(pair)
    if not len(rows):
        return False
    aa, bb = a[rows], b[columns]
    cross = lambda u, v: u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]
    d1 = cross(aa[:, 1]-aa[:, 0], bb[:, 0]-aa[:, 0])
    d2 = cross(aa[:, 1]-aa[:, 0], bb[:, 1]-aa[:, 0])
    d3 = cross(bb[:, 1]-bb[:, 0], aa[:, 0]-bb[:, 0])
    d4 = cross(bb[:, 1]-bb[:, 0], aa[:, 1]-bb[:, 0])
    return bool(np.any((np.minimum(d1, d2) <= tolerance) &
                       (np.maximum(d1, d2) >= -tolerance) &
                       (np.minimum(d3, d4) <= tolerance) &
                       (np.maximum(d3, d4) >= -tolerance)))


def inside_section(points, segments):
    """Even/odd diagnostic for a plane section of a closed source bone mesh."""
    if not len(segments):
        return np.zeros(len(points), dtype=bool)
    p = np.asarray(points, dtype=np.float64)
    a, b = segments[:, 0], segments[:, 1]
    crosses_z = (a[None, :, 1] > p[:, None, 1]) != (b[None, :, 1] > p[:, None, 1])
    x_hit = a[None, :, 0] + ((p[:, None, 1]-a[None, :, 1]) *
                              (b-a)[None, :, 0] / np.where(crosses_z, (b-a)[None, :, 1], 1))
    return np.count_nonzero(crosses_z & (x_hit > p[:, None, 0]), axis=1) % 2 == 1


def collides(cord, bone):
    if not len(cord) or not len(bone):
        return False
    if proper_or_touching_crossings(cord, bone):
        return True
    return bool(np.any(inside_section(cord.reshape(-1, 2), bone)) or
                np.any(inside_section(bone.reshape(-1, 2), cord)))


def audit():
    report = json.loads(SOURCE.read_text())
    source_file = Path(report['geometryFile'])
    parts = {part['id']: part for part in json.loads(gzip.decompress(source_file.read_bytes()))}
    rows = [r for r in next(m for m in report['modes'] if m['mode'] == 'source')['rows'] if r['deepest']]
    offsets = np.arange(-HALF_WIDTH_MM, HALF_WIDTH_MM + STEP_MM/2, STEP_MM)
    results = []
    for row in rows:
        # Two non-vertex planes bracket the original witness; a single chosen
        # plane could miss a narrow contact or a triangle edge.
        for side in [-1, 1]:
            y = row['deepest']['point'][1] + side * PLANE_OFFSET_MM / 1000
            cord, cs = xy_segments(parts[row['cordId']]['source'], y)
            if not len(cord):
                results.append({'cordId': row['cordId'], 'boneId': row['boneId'],
                                'side': side, 'planeYmeters': y, 'error': 'empty cord section'})
                continue
            bones = []
            search_min = cord.min(axis=(0, 1)) - HALF_WIDTH_MM / 1000
            search_max = cord.max(axis=(0, 1)) + HALF_WIDTH_MM / 1000
            for part in parts.values():
                if part['kind'] != 'bone':
                    continue
                b, bs = xy_segments(part['source'], y)
                if len(b) and np.all(b.max(axis=(0, 1)) >= search_min) and np.all(b.min(axis=(0, 1)) <= search_max):
                    bones.append((part['id'], b, bs))
            grid = []
            for dz_mm in offsets:
                for dx_mm in offsets:
                    moved = cord + np.array([dx_mm, dz_mm]) / 1000
                    hits = [identifier for identifier, bone, _ in bones if collides(moved, bone)]
                    grid.append({'dxMm': float(dx_mm), 'dzMm': float(dz_mm), 'hits': hits})
            target_safe = [g for g in grid if row['boneId'] not in g['hits']]
            all_safe = [g for g in grid if not g['hits']]
            closest = lambda values: min(values, key=lambda g: (g['dxMm']**2+g['dzMm']**2,
                                                                  abs(g['dxMm'])+abs(g['dzMm']),
                                                                  g['dxMm'], g['dzMm'])) if values else None
            results.append({'cordId': row['cordId'], 'boneId': row['boneId'], 'side': side,
                            'planeYmeters': y, 'cordSegments': len(cord),
                            'cordPointContacts': cs['pointContacts'],
                            'cordNonDegreeTwoNodes': nonmanifold_section_nodes(cord),
                            'bones': [{'id': identifier, 'segments': len(bone),
                                       'pointContacts': bs['pointContacts'],
                                       'nonDegreeTwoNodes': nonmanifold_section_nodes(bone)} for identifier, bone, bs in bones],
                            'originalHits': next(g['hits'] for g in grid if g['dxMm']==g['dzMm']==0),
                            'targetSafeCount': len(target_safe), 'allBoneSafeCount': len(all_safe),
                            'nearestTargetSafe': closest(target_safe), 'nearestAllBoneSafe': closest(all_safe),
                            'grid': grid})
        print(row['cordId'], row['boneId'], [(r['side'], r.get('allBoneSafeCount')) for r in results[-2:]], flush=True)
    file_hash = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()
    result = {'scope': 'Finite 0.5 mm XY grid of two exact non-vertex transverse planes per source collision witness; 2-D section only, NOT a 3-D collision-free deformable cord.',
              'halfWidthMm': HALF_WIDTH_MM, 'stepMm': STEP_MM, 'planeOffsetMm': PLANE_OFFSET_MM,
              'sourceSha256': file_hash(SOURCE), 'geometrySha256': file_hash(source_file),
              'results': results}
    OUTPUT.write_text(json.dumps(result, separators=(',', ':'))+'\n')
    print(json.dumps({'planes': len(results), 'output': str(OUTPUT)}))


if __name__ == '__main__':
    audit()
