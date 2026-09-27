"""Acquire all official 4.3 lung part_of members for offline replacement review."""
import hashlib
import http.cookiejar
from importlib.util import spec_from_file_location, module_from_spec
import io
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import zipfile

spec = spec_from_file_location('source_probe', Path(__file__).with_name('download-detail-source-probe.py'))
probe = module_from_spec(spec)
spec.loader.exec_module(probe)


def main():
    root = Path('.cache/bp4-official/lung43')
    root.mkdir(parents=True, exist_ok=True)
    listing = root.parent/'v43-upload-list.html'
    parser = probe.Rows()
    parser.feed(listing.read_text())
    relations = {}
    table = Path('data/catalog/v43-FMA2Obj.txt')
    assert table.read_text().startswith('# Data Version\t4.3\n')
    for line in table.read_text().splitlines():
        if line and not line.startswith('#'):
            concept, logic, ids = line.split('\t')
            relations[concept, logic] = set(ids.split('+'))
    ids = sorted(relations['FMA7309', 'part_of'] | relations['FMA7310', 'part_of'])
    rows = []
    for id in ids:
        matches = [row for row in parser.rows if row['art_id'] == id]
        assert len(matches) == 1 and matches[0].get('rep_id'), (id, matches)
        rows.append(matches[0])
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    with opener.open('https://lifesciencedb.jp/bp3d/?lng=en', timeout=60) as response:
        response.read()
    receipts, parts = [], []
    for start in range(0, len(rows), 30):
        batch = rows[start:start+30]
        archive = root/f'{start:04d}.zip'
        form = {'ids': json.dumps([r['art_id'] for r in batch]), 'rep_id': json.dumps([r['rep_id'] for r in batch]),
                'filename': f'gyeol-lung43-{start:04d}', 'type': 'art_file', 'all_downloads': '1'}
        if not archive.exists():
            request = urllib.request.Request('https://lifesciencedb.jp/bp3d/download.cgi', data=urllib.parse.urlencode(form).encode(),
                                             headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://lifesciencedb.jp/bp3d/?lng=en'})
            with opener.open(request, timeout=120) as response:
                raw = response.read()
            assert raw.startswith(b'PK'), repr(raw[:200])
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                assert z.testzip() is None
            archive.write_bytes(raw)
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            for row in batch:
                names = [n for n in z.namelist() if Path(n).name.startswith(row['art_id']+'_') and n.endswith('.obj')]
                assert len(names) == 1, (row['art_id'], names)
                raw = z.read(names[0])
                header = dict(re.findall(r'^# ([^:\n]+?)\s*:\s*(.*)$', raw.decode(), re.M))
                assert header['File ID'] == row['art_id'] and header['Compatibility version'] == '4.3', header
                parts.append({'id': row['art_id'], 'archive': str(archive), 'entry': names[0], 'bytes': len(raw),
                              'sha256': hashlib.sha256(raw).hexdigest(), 'header': header, 'listing': row})
        receipts.append({'file': str(archive), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'form': form})
        print(f'Checked {start+len(batch)}/{len(rows)} lung source files', flush=True)
    report = {'status': 'Offline source acquisition, not anatomical approval', 'version': '4.3',
              'concepts': ['FMA7309', 'FMA7310'], 'logic': 'part_of', 'parts': parts, 'archives': receipts,
              'files': [{'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                        for p in [listing, table, Path(__file__).resolve().relative_to(Path.cwd())]]}
    (root/'receipt.json').write_text(json.dumps(report, indent=2)+'\n')


if __name__ == '__main__':
    main()
