"""Fetch selected published masks, not CT images or model inference.

Uses HTTP Range + ZIP CRC checks to avoid downloading the 23.6 GB archive.
Run without --subject to inspect female cases; with --subject to fetch masks.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile

URL = "https://zenodo.org/api/records/10047292/files/Totalsegmentator_dataset_v201.zip/content"
SIZE = 23581218285


class RemoteArchive(io.RawIOBase):
    def __init__(self):
        self.pos = 0
        self.transferred = 0

    def seekable(self):
        return True

    def seek(self, offset, whence=0):
        self.pos = offset if whence == 0 else (self.pos if whence == 1 else SIZE) + offset
        return self.pos

    def tell(self):
        return self.pos

    def read(self, count=-1):
        count = SIZE - self.pos if count < 0 else min(count, SIZE - self.pos)
        if not count:
            return b""
        if count > 25_000_000 or self.transferred + count > 100_000_000:
            raise ValueError("Refusing unexpectedly large range download")
        start = self.pos
        request = urllib.request.Request(URL, headers={"Range": f"bytes={start}-{start + count - 1}"})
        with urllib.request.urlopen(request, timeout=45) as response:
            if response.status != 206 or response.headers.get("Content-Range") != f"bytes {start}-{start + count - 1}/{SIZE}":
                raise ValueError("Server did not honor exact bounded range")
            data = response.read(count + 1)
        if len(data) != count:
            raise ValueError("Incomplete range")
        self.pos += count
        self.transferred += count
        return data


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--subject")
    parser.add_argument("--out", default=".cache/female-ct")
    parser.add_argument("--masks", nargs="+", default=[
        "stomach", "esophagus", "adrenal_gland_left", "adrenal_gland_right",
        "autochthon_left", "autochthon_right", "liver", "spleen", "kidney_left", "kidney_right",
        "pancreas", "vertebrae_T12", "vertebrae_L5", "hip_left", "hip_right",
    ])
    args = parser.parse_args()
    with urllib.request.urlopen("https://zenodo.org/api/records/10047292", timeout=45) as response:
        record = json.load(response)
    if record["metadata"]["license"]["id"] != "cc-by-4.0" or record["metadata"]["version"] != "2.0.1":
        raise ValueError("Source license/version changed; requires review")
    entry = next(f for f in record["files"] if f["key"] == "Totalsegmentator_dataset_v201.zip")
    if entry["size"] != SIZE or entry["checksum"] != "md5:fe250e5718e0a3b5df4c4ea9d58a62fe":
        raise ValueError("Pinned archive metadata changed")
    remote = RemoteArchive()
    with zipfile.ZipFile(remote) as archive:
        meta_name = next(name for name in archive.namelist() if name.endswith("/meta.csv") or name == "meta.csv")
        meta = archive.read(meta_name)
        rows = list(csv.DictReader(io.StringIO(meta.decode("utf-8-sig")), delimiter=";"))
        if not args.subject:
            print(json.dumps([row for row in rows if row.get("gender", "").lower() == "f"][:45], indent=2))
            return
        row = next(row for row in rows if row["image_id"] == args.subject)
        if row.get("gender", "").lower() != "f":
            raise ValueError("Only metadata-confirmed female subjects are allowed")
        out = Path(args.out) / args.subject
        out.mkdir(parents=True, exist_ok=True)
        records = []
        for mask in args.masks:
            name = next(name for name in archive.namelist() if ("/" + name).endswith(f"/{args.subject}/segmentations/{mask}.nii.gz"))
            info = archive.getinfo(name)
            if info.file_size > 10_000_000:
                raise ValueError("Unexpected mask size")
            data = archive.read(name)  # zipfile validates CRC32, including ZIP64 offsets
            (out / f"{mask}.nii.gz").write_bytes(data)
            records.append({"mask": mask, "archivePath": name, "crc32": f"{info.CRC:08x}", "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
            print(f"Fetched {args.subject}/{mask}: {len(data)} bytes", flush=True)
        (out / "source.json").write_text(json.dumps({
            "url": URL, "doi": "10.5281/zenodo.10047292", "version": "2.0.1", "license": "CC-BY-4.0",
            "archiveBytes": SIZE, "archiveMd5Published": "fe250e5718e0a3b5df4c4ea9d58a62fe",
            "archiveMd5Verified": False, "verification": "Selected ZIP entry CRC32 and local SHA256; whole archive not downloaded",
            "subject": row, "metadataSha256": hashlib.sha256(meta).hexdigest(), "files": records,
            "downloadBytes": remote.transferred,
        }, indent=2) + "\n")


if __name__ == "__main__":
    main()
