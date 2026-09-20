"""Pinned, read-only source audit; not an LS-DYNA solver or anatomical validation.

Run with Python 3. No third-party modules. Only the report is written; the
archive is never extracted and no application assets are changed.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import zipfile

SHA256 = '94b9415ffdc844c14e6ff79ca5a7a79810bc7f7e8632966dedf20f7faddcf7d1'
COMMIT = 'cc986b7df66b109c1c73d4d5986553877e28b0dd'
ROOT = 'vivaplus-v2.0.2/'
URL = 'https://openvt.eu/fem/viva/vivaplus/-/archive/v2.0.2/vivaplus-v2.0.2.zip'
FILES = {
    'main': 'model/50F-standing/vivaplus-50F-standing.key',
    'nodes': 'model/50F-standing/vivaplus_50F-standing_nodes.k',
    'parts': 'model/common/vivaplus-30-Upper-Extremity.k',
    'elements': 'model/common/vivaplus-elements.k',
    'joints': 'model/common/vivaplus-joints.k',
}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def blocks(text):
    """Yield non-comment records. This deliberately handles the pinned format only."""
    keyword, rows = None, []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('$'):
            continue
        if line.startswith('*'):
            if keyword is not None:
                yield keyword, rows
            keyword, rows = line.strip(), []
        else:
            require(keyword is not None, 'Data before keyword')
            rows.append(line)
    if keyword is not None:
        yield keyword, rows


def read_nodes(text):
    nodes = {}
    for keyword, rows in blocks(text):
        require(keyword in ('*KEYWORD', '*NODE', '*END'), f'Unsupported node card {keyword}')
        if keyword != '*NODE':
            continue
        for row in rows:
            nid = int(row[:8])
            point = tuple(float(row[a:b]) for a, b in ((8, 24), (24, 40), (40, 56)))
            require(nid > 0 and nid not in nodes, f'Duplicate/invalid node {nid}')
            require(all(math.isfinite(v) for v in point), f'Nonfinite node {nid}')
            nodes[nid] = point
    require(nodes, 'No nodes')
    return nodes


def read_parts(text):
    parts = {}
    for keyword, rows in blocks(text):
        if keyword in ('*PART', '*PART_CONTACT'):
            require(len(rows) == (3 if keyword == '*PART_CONTACT' else 2),
                    f'Unexpected pinned part record length: {keyword}')
            pid = int(rows[1][:10])
            require(pid not in parts, f'Duplicate part {pid}')
            parts[pid] = rows[0].strip()
    require(parts, 'No parts')
    return parts


def read_elements(text, parts, nodes):
    counts = {pid: collections.Counter() for pid in parts}
    references = {pid: set() for pid in parts}
    seen = set()
    for keyword, rows in blocks(text):
        if not keyword.startswith('*ELEMENT_'):
            continue
        if keyword in ('*ELEMENT_MASS', '*ELEMENT_MASS_NODE_SET'):
            continue  # These cards do not have the same part-ID field.
        widths = {'*ELEMENT_SHELL': 6, '*ELEMENT_SOLID': 10,
                  '*ELEMENT_SHELL_THICKNESS': 6, '*ELEMENT_SHELL_THICKNESS_BETA': 6,
                  '*ELEMENT_BEAM': 4, '*ELEMENT_BEAM_ORIENTATION': 4,
                  '*ELEMENT_DISCRETE': 4}
        require(keyword in widths, f'Unsupported element card {keyword}')
        step = 2 if 'THICKNESS' in keyword or keyword == '*ELEMENT_BEAM_ORIENTATION' else 1
        require(len(rows) % step == 0, 'Missing element continuation row')
        for row in rows[::step]:
            width = widths[keyword]
            # Beam/discrete cards have additional non-node fields after N2.
            values = [int(row[i * 8:(i + 1) * 8]) for i in range(width)]
            eid, pid, *nids = values
            if pid not in parts:
                continue
            require(eid not in seen, f'Duplicate selected element {eid}')
            seen.add(eid)
            require(len(set(nids)) == len(nids), f'Degenerate selected element {eid}')
            require(all(n in nodes for n in nids), f'Missing node in element {eid}')
            counts[pid][keyword] += 1
            references[pid].update(nids)
    require(all(references.values()), 'An upper-extremity part has no elements')
    return counts, references


def read_joints(text, nodes):
    joints = []
    for keyword, rows in blocks(text):
        if keyword not in ('*CONSTRAINED_JOINT_SPHERICAL_ID', '*CONSTRAINED_JOINT_REVOLUTE_ID'):
            continue
        require(len(rows) == 2, f'Unexpected pinned joint record length: {keyword}')
        name = rows[0][10:].strip()
        if not name.startswith('UX-'):
            continue
        count = 4 if 'REVOLUTE' in keyword else 2
        ids = [int(rows[1][i * 10:(i + 1) * 10]) for i in range(count)]
        require(all(n in nodes for n in ids), f'Missing joint node: {name}')
        points = [nodes[n] for n in ids]
        # Node pairs belong to the two connected bodies. They are not inferred
        # bone-surface landmarks, clinical joint gaps, or cartilage thicknesses.
        gaps = [math.dist(points[i], points[i + 1]) for i in range(0, count, 2)]
        joint = dict(id=int(rows[0][:10]), sourceName=name, keyword=keyword,
                     nodeIds=ids, sourcePositionsMm=points, pairedNodeDistancesMm=gaps)
        if count == 4:
            joint['axisNodeDistancesMm'] = [math.dist(points[0], points[2]),
                                            math.dist(points[1], points[3])]
        joints.append(joint)
    return joints


def audit(path):
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    require(digest == SHA256, 'Archive hash differs from pinned source')
    with zipfile.ZipFile(path) as archive:
        require(archive.comment.decode() == COMMIT, 'Archive commit mismatch')
        require(archive.testzip() is None, 'ZIP CRC failure')
        data = {key: archive.read(ROOT + value) for key, value in FILES.items()}
    parameters = '\n'.join(row for keyword, rows in blocks(data['main'].decode())
                           if keyword == '*PARAMETER' for row in rows)
    require('R SEX             0.' in parameters and 'R STANDING        1.' in parameters,
            'Not female standing source')
    nodes = read_nodes(data['nodes'].decode())
    parts = read_parts(data['parts'].decode())
    counts, refs = read_elements(data['elements'].decode(), parts, nodes)
    joints = read_joints(data['joints'].decode(), nodes)
    require(len(parts) == 96 and len(joints) == 16, 'Pinned inventory changed')
    entries = []
    for pid, name in sorted(parts.items()):
        points = [nodes[nid] for nid in refs[pid]]
        entries.append(dict(id=pid, sourceName=name, elementCounts=dict(counts[pid]),
                            uniqueReferencedNodes=len(points),
                            boundsMm={'min': [min(p[i] for p in points) for i in range(3)],
                                      'max': [max(p[i] for p in points) for i in range(3)]}))
    totals = collections.Counter()
    for count in counts.values():
        totals.update(count)
    require(dict(totals) == {'*ELEMENT_SHELL': 35123, '*ELEMENT_SOLID': 59678,
                            '*ELEMENT_DISCRETE': 4},
            'Pinned element inventory changed')
    return dict(
        source=dict(url=URL, tag='v2.0.2', commit=COMMIT, archiveSha256=digest,
                    zipCrcVerified=True, variant='50F-standing',
                    files=[dict(path=FILES[k], bytes=len(v), sha256=hashlib.sha256(v).hexdigest())
                           for k, v in data.items()]),
        coordinateSystem=dict(lengthUnit='mm', axes=['anterior', 'left', 'up'],
                              proposedDisplayOnlyTransform='(x,y,z) mm -> (y,z,x)/1000 m',
                              transformApplied=False, hraRegistrationValidated=False),
        scope='Selected upper-extremity element references and spherical/revolute joint nodes only',
        nodeFileCount=len(nodes), partCount=len(parts), elementCounts=dict(totals),
        uniqueUpperExtremityReferencedNodes=len(set().union(*refs.values())),
        joints=joints, parts=entries,
        limitations=[
            '96 finite-element parts are not 96 anatomical bones or muscles.',
            'Whole-Null surfaces are computational parts, not additional anatomical tissues.',
            'Carpal and phalangeal parts are aggregates; individual hand bones are not established.',
            'Joint definitions are simulation constraints, not HRA or BP4 registration landmarks.',
            'No surface extraction, collision, containment, or anatomical accuracy validation performed.',
            'Element material laws, continuation values, mass cards and whole-body completeness are not validated.',
            'LGPL source obligations and VIVA+ naming restrictions require review before asset distribution.',
        ], deployed=False, anatomicallyValidated=False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=Path('.cache/vivaplus/vivaplus-v2.0.2.zip'))
    parser.add_argument('--output', type=Path, default=Path('.cache/vivaplus/source-audit.json'))
    args = parser.parse_args()
    report = audit(args.archive)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + '\n')
    print(json.dumps({k: report[k] for k in ('nodeFileCount', 'partCount', 'elementCounts',
                                           'uniqueUpperExtremityReferencedNodes', 'deployed')}))
