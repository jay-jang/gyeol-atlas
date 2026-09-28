"""Check one official VHF DICOM header per named 1 mm CT series.

Sampling headers cannot establish calibration for every slice. This audit
never changes or reconstructs the atlas CT.
"""

import argparse
import hashlib
import io
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request, urlopen

import pydicom


DATASET_API = "https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/3JDZCT"
FILE_API = "https://dataverse.harvard.edu/api/access/datafile/"
SERIES = ("Ankle", "Head", "Hip", "Knee", "Pelvis", "Shoulder")
VERSION_ID = 354044


def read_url(url):
    request = Request(url, headers={"User-Agent": "GYEOL source audit/1.0"})
    with urlopen(request, timeout=60) as response:
        return response.read()


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def audit_file(item):
    entry = item["dataFile"]
    raw = read_url(FILE_API + str(entry["id"]))
    if len(raw) != entry["filesize"] or hashlib.md5(raw).hexdigest() != entry["md5"]:
        raise ValueError(f"Dataverse file length/checksum mismatch: {entry['filename']}")
    dicom = pydicom.dcmread(io.BytesIO(raw))
    pixels = dicom.pixel_array
    return {
        "name": entry["filename"], "fileId": entry["id"], "md5": entry["md5"],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "series": entry["filename"].split("-", 1)[1].split(" ", 1)[0],
        "rescaleSlope": float(dicom.RescaleSlope),
        "rescaleIntercept": float(dicom.RescaleIntercept),
        "pixelSpacingMm": [float(v) for v in dicom.PixelSpacing],
        "sliceThicknessMm": float(dicom.SliceThickness),
        "imageOrientationPatient": [float(v) for v in dicom.ImageOrientationPatient],
        "imagePositionPatient": [float(v) for v in dicom.ImagePositionPatient],
        "rows": int(dicom.Rows), "columns": int(dicom.Columns),
        "pixelRepresentation": int(dicom.PixelRepresentation),
        "bitsStored": int(dicom.BitsStored),
        "storedMin": int(pixels.min()), "storedMax": int(pixels.max()),
        "storedNegativePixels": int((pixels < 0).sum()),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    dataset = json.loads(read_url(DATASET_API))["data"]
    version = dataset["latestVersion"]
    if version["id"] != VERSION_ID:
        raise ValueError("Dataverse version changed; select a pinned version explicitly")
    selection = []
    series_counts = {}
    for series in SERIES:
        pattern = re.compile(rf"VHFCT1mm-{series} \((\d+)\)\.dcm$")
        matches = []
        for item in version["files"]:
            matched = pattern.fullmatch(item["dataFile"]["filename"])
            if matched:
                matches.append((int(matched[1]), item))
        if not matches:
            raise ValueError(f"Missing series: {series}")
        matches.sort(key=lambda pair: pair[0])
        series_counts[series] = len(matches)
        selection.append(matches[len(matches) // 2][1])
    with ThreadPoolExecutor(max_workers=3) as pool:
        rows = list(pool.map(audit_file, selection))
    # Do not infer every slice from these six samples. This is a check on a
    # plausible conversion candidate, not per-series or whole-CT proof.
    expected = {"rescaleSlope": 1.0, "rescaleIntercept": -1024.0,
                "pixelSpacingMm": [1.0, 1.0], "sliceThicknessMm": 1.0,
                "imageOrientationPatient": [1, 0, 0, 0, 1, 0],
                "rows": 512, "columns": 512}
    for row in rows:
        for key, value in expected.items():
            if row[key] != value:
                raise ValueError(f"Unexpected {key} in {row['name']}: {row[key]}")
    report = {
        "status": "SIX SERIES HEADER SAMPLES ONLY; NOT ALL DICOM SLICES",
        "datasetDoi": "10.7910/DVN/3JDZCT", "datasetVersionId": VERSION_ID,
        "datasetApi": DATASET_API, "seriesCounts": series_counts,
        "selection": "middle numbered file in each of six female CT 1mm series",
        "samples": rows,
        "limitations": [
            "A single header per series does not prove every DICOM file has the same scaling.",
            "These DICOM samples were not registered voxelwise to BoneHub except for the separate head-slice audit.",
            "BoneHub NIfTI processing may differ from original DICOM even if the acquisition scaling matches.",
        ],
        "scriptSha256": sha256(Path(__file__)),
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print({"samples": len(rows), "series": [r["series"] for r in rows]})


if __name__ == "__main__":
    main()
