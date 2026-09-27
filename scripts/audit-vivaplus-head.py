"""Pinned female-standing head inventory, not a solver or anatomical approval.

Keeps solid, shell, CSF and computational null representations separate. Writes
only ignored cache reports; no model assets or application state are changed.
"""
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import zipfile

SPEC = importlib.util.spec_from_file_location('viva_source', Path(__file__).with_name('audit-vivaplus.py'))
source = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(source)
HEAD = 'model/common/vivaplus-10-Head.k'


def head_elements(text, parts, nodes):
    selected = {pid: [] for pid in parts}
    seen = set()
    widths = {'*ELEMENT_SHELL': 6, '*ELEMENT_SOLID': 10,
              '*ELEMENT_SHELL_THICKNESS': 6, '*ELEMENT_SHELL_THICKNESS_BETA': 6,
              '*ELEMENT_BEAM': 4, '*ELEMENT_BEAM_ORIENTATION': 4, '*ELEMENT_DISCRETE': 4}
    for keyword, rows in source.blocks(text):
        if not keyword.startswith('*ELEMENT_') or keyword in ('*ELEMENT_MASS', '*ELEMENT_MASS_NODE_SET'):
            continue
        source.require(keyword in widths, f'Unknown pinned element keyword {keyword}')
        step = 2 if 'THICKNESS' in keyword or keyword == '*ELEMENT_BEAM_ORIENTATION' else 1
        source.require(len(rows) % step == 0, f'Missing continuation for {keyword}')
        for row in rows[::step]:
            values = [int(row[8*i:8*(i+1)]) for i in range(widths[keyword])]
            eid, pid, *ids = values
            if pid not in parts:
                continue
            source.require(eid > 0 and eid not in seen, f'Duplicate/invalid head element {eid}')
            source.require(all(n in nodes for n in ids), f'Missing head node {eid}')
            seen.add(eid)
            selected[pid].append(dict(id=eid, keyword=keyword, nodes=ids))
    return selected


def load_head():
    path = Path('.cache/vivaplus/vivaplus-v2.0.2.zip')
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    source.require(digest == source.SHA256, 'Archive differs from pinned version')
    files = dict(main=source.FILES['main'], nodes=source.FILES['nodes'], parts=HEAD, elements=source.FILES['elements'])
    with zipfile.ZipFile(path) as archive:
        source.require(archive.comment.decode() == source.COMMIT, 'Archive commit mismatch')
        source.require(archive.testzip() is None, 'ZIP CRC failure')
        data = {k: archive.read(source.ROOT + v) for k, v in files.items()}
    parameters = '\n'.join(row for keyword, rows in source.blocks(data['main'].decode()) if keyword == '*PARAMETER' for row in rows)
    source.require('R SEX             0.' in parameters and 'R STANDING        1.' in parameters, 'Not female standing')
    nodes = source.read_nodes(data['nodes'].decode())
    parts = source.read_parts(data['parts'].decode())
    elements = head_elements(data['elements'].decode(), parts, nodes)
    metadata = dict(url=source.URL, tag='v2.0.2', commit=source.COMMIT, archiveSha256=digest, variant='50F-standing', zipCrcVerified=True,
                    files=[dict(path=files[k], bytes=len(v), sha256=hashlib.sha256(v).hexdigest()) for k, v in data.items()])
    return nodes, parts, elements, metadata


def audit():
    nodes, parts, elements, metadata = load_head()
    entries = []
    for pid, name in sorted(parts.items()):
        rows = elements[pid]
        ids = sorted({n for row in rows for n in row['nodes']})
        counts = collections.Counter(row['keyword'] for row in rows)
        shapes = collections.Counter(f"{row['keyword']}:{len(set(row['nodes']))}" for row in rows)
        entries.append(dict(id=pid, name=name, elementCounts=dict(counts), distinctNodeCounts=dict(shapes), referencedNodes=len(ids),
                            boundsMm=[[min(nodes[n][axis] for n in ids) for axis in range(3)],
                                      [max(nodes[n][axis] for n in ids) for axis in range(3)]] if ids else None))
    totals = collections.Counter()
    for row in entries:
        totals.update(row['elementCounts'])
    report = dict(source=metadata, status='HEAD SOURCE INVENTORY ONLY; not exported, registered, or anatomically validated',
                  nodeFileCount=len(nodes), declaredParts=len(parts), nonemptyParts=sum(bool(elements[p]) for p in parts),
                  elementCounts=dict(totals), parts=entries,
                  limitations=['PART names describe FE materials/regions, not independent anatomical structures or verified left/right labels.',
                               'CSF, oral cavity and computational null parts must not be relabelled as neural tissue.',
                               'Shell reference surfaces omit assigned thickness. Solid mesh boundaries and topology are not yet checked.',
                               'No HRA fitting, landmark correspondence, containment, source pose agreement or whole-body completion is claimed.'],
                  code=[dict(path=str(p), sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in [Path(__file__), Path(source.__file__)]])
    folder = Path('.cache/vivaplus-head'); folder.mkdir(exist_ok=True)
    (folder / 'inventory.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(json.dumps({k: report[k] for k in ('nodeFileCount', 'declaredParts', 'nonemptyParts', 'elementCounts')}))
    print(json.dumps([dict(id=r['id'], name=r['name'], elements=r['distinctNodeCounts']) for r in entries]))


if __name__ == '__main__':
    audit()
