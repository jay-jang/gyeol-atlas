"""Read small official ZIP members via bounded HTTP ranges; no runtime export.

The poly2 cross-tab tests an index-space hypothesis, not anatomical labeling.
"""
import collections
import gzip
import hashlib
import io
import json
import math
from pathlib import Path
import urllib.request
import zipfile

URL = 'https://sci.utah.edu/~datasets/SCI_headmodel/Mesh.zip'
LENGTH = 3463196500
ETAG = '"ce6c2f54-5824437da6580"'
FOLDER = Path('.cache/sci-head')


class RemoteZip(io.RawIOBase):
    def __init__(self):
        self.position = 0
        self.requests = []

    def seekable(self):
        return True

    def readable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        self.position = offset + (self.position if whence == 1 else LENGTH if whence == 2 else 0)
        if not 0 <= self.position <= LENGTH:
            raise ValueError('Invalid remote offset')
        return self.position

    def read(self, size=-1):
        if size < 0:
            size = LENGTH - self.position
        size = min(size, LENGTH - self.position)
        if size == 0:
            return b''
        # An accidental whole-archive request must fail, not download gigabytes.
        if size > 1024 * 1024 or len(self.requests) >= 100:
            raise ValueError('Remote read budget exceeded')
        start = self.position
        end = start + size - 1
        request = urllib.request.Request(URL, headers={
            'Range': f'bytes={start}-{end}', 'If-Match': ETAG,
            'Accept-Encoding': 'identity',
        })
        with urllib.request.urlopen(request, timeout=30) as response:
            assert response.status == 206
            assert response.headers['Content-Range'] == f'bytes {start}-{end}/{LENGTH}'
            assert response.headers['ETag'] == ETAG
            raw = response.read(size + 1)
        assert len(raw) == size
        self.requests.append(dict(start=start, bytes=size, sha256=hashlib.sha256(raw).hexdigest()))
        self.position += size
        return raw


def main():
    segmentation = (FOLDER / 'Segmentation.zip').read_bytes()
    assert hashlib.sha256(segmentation).hexdigest() == '31b7f32628a887bb8e5e089bc98e355cbb30f94b8d4cf52685a58449068ec021'
    with zipfile.ZipFile(io.BytesIO(segmentation)) as archive:
        nrrd = archive.read('Segmentation/HeadSegmentation.nrrd')
    voxels = gzip.decompress(nrrd.split(b'\n\n', 1)[1])
    assert len(voxels) == 208 * 256 * 256
    remote = RemoteZip()
    member = 'Mesh/ScaledMesh_15M/HeadMesh_poly2.vtk'
    with zipfile.ZipFile(remote) as archive:
        inventory = [dict(path=i.filename, bytes=i.file_size, compressedBytes=i.compress_size,
                          crc32=f'{i.CRC:08x}') for i in archive.infolist()]
        readme = archive.read('Mesh/README.txt')
        # zipfile checks the complete member's CRC; the other large members stay remote.
        raw = archive.read(member)
    assert len(raw) == 1996985
    tokens = raw.decode('ascii').split()
    start = tokens.index('POINTS')
    count = int(tokens[start + 1])
    assert tokens[start + 2] == 'float' and count == 7136
    points = [tuple(map(float, tokens[start + 3 + i * 3:start + 6 + i * 3])) for i in range(count)]
    assert all(math.isfinite(v) for p in points for v in p)
    tests = []
    # Test both common cell-center conventions explicitly, without picking one silently.
    for offset in (0, -0.5, 0.5):
        histogram = collections.Counter()
        for point in points:
            x, y, z = (math.floor(v + offset + 0.5) for v in point)
            label = voxels[x + 208 * (y + 256 * z)] if 0 <= x < 208 and 0 <= y < 256 and 0 <= z < 256 else 'outside'
            histogram[str(label)] += 1
        tests.append(dict(indexOffset=offset, nearestVoxelCounts=dict(sorted(histogram.items()))))
    report = dict(status='INDEX-SPACE CROSS-TAB ONLY; no authoritative anatomical crosswalk',
                  url=URL, archiveBytes=LENGTH, etag=ETAG, archiveSha256=None,
                  requests=remote.requests, transferredBytes=sum(r['bytes'] for r in remote.requests),
                  inventory=inventory, readme=readme.decode(),
                  member=dict(path=member, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest(),
                              crcVerified=True, points=count,
                              boundsXYZ=[[min(p[a] for p in points) for a in range(3)],
                                         [max(p[a] for p in points) for a in range(3)]]),
                  indexSpaceHypotheses=tests,
                  limitations=['Only one small mesh member and README were fully read; whole ZIP SHA/CRC is not verified.',
                               'Numeric suffix poly2 is not independently established as the simulation field material value.',
                               'Nearest voxel counts test possible coordinate conventions, not exact mesher correspondence.',
                               'No RAS/LPS orientation, physical units, anatomical names, HRA registration or runtime assets are assigned.'],
                  codeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (FOLDER / 'mesh-label-probe.json').write_text(json.dumps(report, indent=2, allow_nan=False) + '\n')
    print(json.dumps(dict(transferredBytes=report['transferredBytes'], member=report['member'], tests=tests)))


if __name__ == '__main__':
    main()
