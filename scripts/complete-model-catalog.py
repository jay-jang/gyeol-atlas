"""Include every available muscle and neural structure from the pinned source tree.
Membership comes from the source part-of/composite relations, not name guessing.
"""
import csv, json
from collections import defaultdict, Counter
from pathlib import Path

inputs = json.loads(Path('scripts/model-inputs.json').read_text())
tree = json.loads(Path('.cache/catalog/tree.json').read_text())
files = {Path(x['path']).stem: x['path'] for x in tree['tree'] if x['path'].endswith('.stl')}
names = dict(r for r in csv.reader(open('data/catalog/parts.txt'), delimiter='\t') if len(r) == 2)
edges = defaultdict(set)
for f in ['conventional_part_of.txt', 'composite_parts.txt']:
    for row in list(csv.reader(open('data/catalog/' + f), delimiter='\t'))[1:]:
        if len(row) >= 4: edges[row[0]].add(row[2])
def descendants(*roots):
    found = set(); queue = list(roots)
    while queue:
        key = queue.pop()
        if key not in found:
            found.add(key); queue.extend(edges[key])
    return found & files.keys()

muscles = descendants('FMA72954')
nerves = descendants('FMA7157')
bones = descendants('FMA23881')
organs = descendants('FMA7152', 'FMA7158', 'FMA7159', 'FMA7160', 'FMA9668', 'FMA74594', 'FMA78499', 'FMA7088') - muscles - nerves - bones
organs.add('FMA12513') # Eyeball is a source leaf outside the conventional sense-organ subtree.
vessels = {i for i in organs if any(t in names[i] for t in ['artery', 'vein', 'coronary sinus'])}
teeth = {i for i in organs if 'tooth' in names[i]}
organs -= vessels | teeth
assets = {a['id']: a for a in inputs['assets']}
before = {'skin': 1, 'bone': 101, 'muscle': 42, 'organ': 19, 'vessel': 50, 'nerve': 7}
previous = Path('docs/anatomy-expansion/catalog-audit.json')
old_added = {a['id'] for a in json.loads(previous.read_text()).get('added', [])} if previous.exists() else set()
original_ids = set(assets) - old_added
added = []
for layer, ids in [('muscle', muscles), ('nerve', nerves), ('organ', organs), ('vessel', vessels), ('bone', teeth)]:
    for key in sorted(ids):
        if key in assets:
            if layer in ['vessel', 'bone']: assets[key]['layer'] = layer
            continue
        a = {'id': key, 'name': names[key], 'layer': layer, 'path': files[key]}
        assets[key] = a; added.append(a)
inputs['assets'] = list(assets.values())
Path('scripts/model-inputs.json').write_text(json.dumps(inputs, ensure_ascii=False, indent=2) + '\n')
report = {'sourceCommit': inputs['commit'], 'before': dict(before),
          'after': dict(Counter(a['layer'] for a in assets.values())),
          'requiredSourceIds': {'muscle': sorted(muscles), 'nerve': sorted(nerves), 'organ': sorted(organs)},
          'added': [a for a in assets.values() if a['id'] not in original_ids]}
Path('docs/anatomy-expansion/catalog-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(report['before'], '->', report['after'])
