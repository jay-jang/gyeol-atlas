"""Download the pinned 4.3 supplement from the public Anatomography exporter."""
import http.cookiejar
import json, urllib.request, urllib.parse, zipfile, io, re, hashlib, time
from pathlib import Path
rows = json.loads(Path('data/catalog/v43-supplement.json').read_text())
out = Path('.cache/models'); out.mkdir(exist_ok=True, parents=True)
cache = Path('.cache/catalog/v43-chunks'); cache.mkdir(exist_ok=True)
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
with opener.open('https://lifesciencedb.jp/bp3d/?lng=en', timeout=60) as response: response.read()
for start in range(0, len(rows), 30):
    batch = rows[start:start+30]
    key = hashlib.sha256(json.dumps(batch, sort_keys=True).encode()).hexdigest()[:16]
    archive = cache / (key + '.zip')
    if not archive.exists():
        form = urllib.parse.urlencode({'ids':json.dumps([r['id'] for r in batch]),'rep_id':json.dumps([r['repId'] for r in batch]),'filename':'gyeol-neural-supplement','type':'art_file','all_downloads':'1'}).encode()
        req = urllib.request.Request('https://lifesciencedb.jp/bp3d/download.cgi',data=form,headers={'User-Agent':'Mozilla/5.0','Referer':'https://lifesciencedb.jp/bp3d/?lng=en'})
        with opener.open(req,timeout=120) as response: blob=response.read()
        if not blob.startswith(b'PK'): raise ValueError(blob[:500])
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            if z.testzip(): raise ValueError('corrupt archive')
        archive.write_bytes(blob)
    with zipfile.ZipFile(archive) as z:
        for row in batch:
            hits=[n for n in z.namelist() if re.match(re.escape(row['id'])+r'_',Path(n).name) and n.endswith('.obj')]
            if len(hits)!=1: raise ValueError((row['id'],hits))
            (out / (row['id']+'.obj')).write_bytes(z.read(hits[0]))
    print('Downloaded',min(start+30,len(rows)),'/',len(rows),flush=True)
    time.sleep(0.3)
