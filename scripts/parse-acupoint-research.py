"""Parse cached public research responses, never import needling instructions.

This writes research staging data only. Runtime content must be reviewed separately.
TCM Wiki text: CC BY-SA 4.0, https://tcmwiki.com/wiki/copyrights.
"""
import json
import re
from pathlib import Path

records = {}
for path in sorted(Path('.cache/acupoints/tcm-web').glob('*.txt')):
    if path.name == 'sample.txt':
        continue
    for block in path.read_text().split('--------------------------------------------------------------------------------'):
        match = re.search(r'\(https://tcmwiki.com/wiki/([^\)]+)\)', block)
        if not match:
            continue
        slug = match[1]
        clean = re.sub(r'cite[^†]*†([^]*)', r'\1', block)
        clean = re.sub(r'L\d+: ?', '', clean)
        clean = re.sub(r'(?<!\n)(## )', r'\n\1', clean)
        sections = re.findall(
            r'## (Locations?|Indications?|Incications|Actions?|Functions?)\s*\n(.*?)(?=\n## |Please enable|$)',
            clean, re.S | re.I)
        records[slug] = {
            'url': 'https://tcmwiki.com/wiki/' + slug,
            'sections': sections,
            'synonyms': clean.split('Synonyms:')[-1].split('##')[0][:600],
        }
Path('.cache/acupoints/tcm-sections.json').write_text(
    json.dumps(records, ensure_ascii=False, indent=2) + '\n')
print(f'{len(records)} research pages parsed; no procedure sections imported.')
