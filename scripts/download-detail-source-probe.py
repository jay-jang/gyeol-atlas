"""Fetch a bounded, offline source probe through the public BP3D exporter.

Keeps raw archives and source metadata; never writes runtime models.
"""
import hashlib
from html.parser import HTMLParser
import http.cookiejar
import io
import json
from pathlib import Path
import re
import urllib.parse
import urllib.request
import zipfile


class Rows(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows, self.row, self.field = [], {}, None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.row = {}
        if tag == 'td':
            self.field = dict(attrs).get('class')
        if tag == 'br' and self.field:
            self.row[self.field] = self.row.get(self.field, '') + '\n'

    def handle_data(self, data):
        if self.field:
            self.row[self.field] = self.row.get(self.field, '') + data

    def handle_endtag(self, tag):
        if tag == 'td':
            self.field = None
        if tag == 'tr' and 'art_id' in self.row:
            self.rows.append({k: v.strip() for k, v in self.row.items()})


def main():
    root = Path('.cache/bp4-official')
    root.mkdir(parents=True, exist_ok=True)
    parser = Rows()
    listing = root / 'v43-upload-list.html'
    listing_url = 'https://lifesciencedb.jp/bp3d/get-info.cgi?version=4.3&tree=isa&cmd=upload-all-list&load=1&md_id=1&mv_id=6&mr_id=1'
    if not listing.exists():
        with urllib.request.urlopen(listing_url, timeout=120) as response:
            listing.write_bytes(response.read())
    parser.feed(listing.read_text())
    # Inspect every file assigned to this concept in the official 4.3 table.
    relation = next(line for line in Path('data/catalog/v43-FMA2Obj.txt').read_text().splitlines()
                    if line.startswith('FMA8620\tpart_of\t'))
    ids = relation.split('\t')[2].split('+')
    batch = []
    for id in ids:
        hits = [row for row in parser.rows if row['art_id'] == id]
        assert len(hits) == 1, (id, len(hits))
        batch.append(hits[0])
    archive = root / 'v43-pulmonary-source.zip'
    endpoint = 'https://lifesciencedb.jp/bp3d/download.cgi'
    form = {'ids': json.dumps(ids), 'rep_id': json.dumps([row['rep_id'] for row in batch]),
            'filename': 'gyeol-pulmonary-source-probe', 'type': 'art_file', 'all_downloads': '1'}
    if not archive.exists():
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        with opener.open('https://lifesciencedb.jp/bp3d/?lng=en', timeout=60) as response:
            response.read()
        request = urllib.request.Request(endpoint, data=urllib.parse.urlencode(form).encode(),
                                         headers={'User-Agent': 'Mozilla/5.0', 'Referer': 'https://lifesciencedb.jp/bp3d/?lng=en'})
        with opener.open(request, timeout=120) as response:
            blob = response.read()
        if not blob.startswith(b'PK'):
            raise ValueError(f'Exporter did not return a ZIP: {blob[:200]!r}')
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            assert z.testzip() is None
        archive.write_bytes(blob)
    records = []
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        for row in batch:
            matches = [name for name in z.namelist() if Path(name).name.startswith(row['art_id']+'_') and name.endswith('.obj')]
            assert len(matches) == 1, (row['art_id'], matches)
            raw = z.read(matches[0])
            header = dict(re.findall(r'^# ([^:\n]+?)\s*:\s*(.*)$', raw.decode(), re.M))
            assert header['File ID'] == row['art_id']
            assert header['Compatibility version'] == '4.3'
            records.append({'metadata': row, 'entry': matches[0], 'header': header,
                            'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    report = {'status': 'Offline source probe only; no runtime replacement or anatomical approval',
              'endpoint': endpoint, 'form': form, 'archive': str(archive), 'listingUrl': listing_url,
              'archiveSha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
              'listingSha256': hashlib.sha256(listing.read_bytes()).hexdigest(), 'parts': records}
    (root / 'v43-pulmonary-source.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({'archive': str(archive), 'parts': len(records), 'archiveSha256': report['archiveSha256']}))


if __name__ == '__main__':
    main()
