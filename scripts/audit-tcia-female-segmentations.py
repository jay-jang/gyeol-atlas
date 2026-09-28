"""Audit actual labels in TCIA Healthy-Total-Body-CTs v3 female segmentations.

This reads the public segmentation ZIP only; it never fetches controlled CT images.
 Requires NumPy and NiBabel. The source ZIP and clinical spreadsheet are supplied as arguments.
"""

import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET
import zipfile

import nibabel as nib
import numpy as np


NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
MEMBER_PATTERN = re.compile(r"(?:^|/)Healthy-Total-Body-CTs-(\d{3})\.nii\.gz$")
FOCUS_LABELS = {4: "Brain", 5: "Heart", 26: "Skull", 33: "Skeletal-muscle", 34: "Subcutaneous-fat"}


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def xlsx_rows(raw, sheet_number=1):
    with zipfile.ZipFile(io.BytesIO(raw)) as workbook:
        strings = []
        if "xl/sharedStrings.xml" in workbook.namelist():
            root = ET.fromstring(workbook.read("xl/sharedStrings.xml"))
            strings = ["".join(t.text or "" for t in item.findall(".//m:t", NS))
                       for item in root.findall("m:si", NS)]
        root = ET.fromstring(workbook.read(f"xl/worksheets/sheet{sheet_number}.xml"))
        rows = []
        for row in root.findall(".//m:sheetData/m:row", NS):
            cells = {}
            for cell in row.findall("m:c", NS):
                column = re.match(r"[A-Z]+", cell.attrib["r"]).group()
                value = cell.find("m:v", NS)
                inline = cell.find("m:is", NS)
                if value is not None:
                    text = value.text or ""
                    cells[column] = strings[int(text)] if cell.attrib.get("t") == "s" else text
                elif inline is not None:
                    cells[column] = "".join(t.text or "" for t in inline.findall(".//m:t", NS))
            if cells:
                rows.append(cells)
        return rows


def female_ids(clinical_raw):
    rows = xlsx_rows(clinical_raw)
    header = next(row for row in rows if "Gender" in row.values() and "Subject Number" in row.values())
    subject_col = next(column for column, value in header.items() if value == "Subject Number")
    gender_col = next(column for column, value in header.items() if value == "Gender")
    ids = set()
    for row in rows[rows.index(header) + 1:]:
        if row.get(gender_col, "").strip().lower() in {"f", "female"}:
            raw_id = row.get(subject_col, "").strip()
            match = re.fullmatch(r"Healthy-Total-Body-CTs-(\d{3})", raw_id)
            assert match, raw_id
            ids.add(match.group(1))
    assert ids, "No female case IDs found in clinical spreadsheet"
    return sorted(ids)


def label_names(raw):
    rows = xlsx_rows(raw, 2)
    names = {}
    for row in rows:
        for number_column, name_column in (("A", "B"), ("D", "E"), ("G", "H")):
            value = row.get(number_column, "")
            if re.fullmatch(r"\d+", value) and row.get(name_column):
                number = int(value)
                if number in names:
                    assert names[number] == row[name_column]
                names[number] = row[name_column]
    assert set(names) == set(range(1, 120)), sorted(names)
    return names


def nifti_header(source):
    header = source.read(352)
    assert len(header) == 352 and struct.unpack_from("<i", header)[0] == 348
    dimensions = struct.unpack_from("<8h", header, 40)
    assert dimensions[0] == 3 and all(value > 0 for value in dimensions[1:4]), dimensions
    datatype, bitpix = struct.unpack_from("<hh", header, 70)
    assert (datatype, bitpix) == (16, 32), (datatype, bitpix)
    spacing = struct.unpack_from("<8f", header, 76)[1:4]
    offset = int(struct.unpack_from("<f", header, 108)[0])
    assert offset >= 352 and offset < 4096, offset
    qform_code, sform_code = struct.unpack_from("<hh", header, 252)
    assert qform_code > 0 or sform_code > 0, "No qform or sform in NIfTI"
    affine = nib.Nifti1Header(binaryblock=header[:348]).get_best_affine().tolist()
    if offset > 352:
        assert len(source.read(offset - 352)) == offset - 352
    return dimensions[1:4], spacing, affine


def audit_case(archive, member, with_bounds):
    counts = np.zeros(120, dtype=np.int64)
    invalid = 0
    bounds = {number: [[None, None, None], [None, None, None]] for number in FOCUS_LABELS} if with_bounds else {}
    with archive.open(member) as compressed, gzip.GzipFile(fileobj=compressed) as source:
        shape, spacing, affine = nifti_header(source)
        xsize, ysize, zsize = shape
        slice_bytes = xsize * ysize * 4
        for z in range(zsize):
            raw = source.read(slice_bytes)
            assert len(raw) == slice_bytes, (member, z, len(raw))
            values = np.frombuffer(raw, dtype="<f4").reshape(ysize, xsize)
            valid = np.isfinite(values) & (values >= 0) & (values < 120) & (values == np.floor(values))
            invalid += values.size - int(np.count_nonzero(valid))
            integral = values[valid].astype(np.int16)
            counts += np.bincount(integral, minlength=120)
            if with_bounds:
                for number, box in bounds.items():
                    yy, xx = np.where(values == number)
                    if not len(xx):
                        continue
                    low, high = box
                    current_low = [int(xx.min()), int(yy.min()), z]
                    current_high = [int(xx.max()), int(yy.max()), z]
                    for axis in range(3):
                        low[axis] = current_low[axis] if low[axis] is None else min(low[axis], current_low[axis])
                        high[axis] = current_high[axis] if high[axis] is None else max(high[axis], current_high[axis])
        assert source.read(1) == b"", (member, "unexpected trailing voxel data")
    assert int(counts.sum()) + invalid == xsize * ysize * zsize
    present = np.flatnonzero(counts[1:]) + 1
    return {
        "caseId": MEMBER_PATTERN.search(member).group(1),
        "shapeXyz": list(shape), "spacingMmXyz": list(spacing), "bestAffineRasMm": affine,
        "voxelCount": xsize * ysize * zsize, "invalidValueCount": invalid,
        "presentLabels": [int(value) for value in present],
        "positiveLabelCounts": {str(int(value)): int(counts[value]) for value in present},
        **({"focusBoundsGridInclusive": {str(number): box for number, box in bounds.items()}} if with_bounds else {}),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("segmentation_zip", type=Path)
    parser.add_argument("clinical_xlsx", type=Path)
    parser.add_argument("--output", type=Path, default=Path("docs/anatomy-alignment/tcia-v3-female-source.json"))
    parser.add_argument("--focus-case", default="003")
    args = parser.parse_args()
    assert args.segmentation_zip.is_file() and args.clinical_xlsx.is_file()
    clinical = args.clinical_xlsx.read_bytes()
    clinical_female = female_ids(clinical)
    with zipfile.ZipFile(args.segmentation_zip) as archive:
        assert archive.testzip() is None, "Segmentation ZIP CRC failed"
        members = {}
        for member in archive.namelist():
            match = MEMBER_PATTERN.search(member)
            if match and not member.startswith("__MACOSX/"):
                assert match.group(1) not in members, match.group(1)
                members[match.group(1)] = member
        organ_sheet = next(name for name in archive.namelist() if name.endswith("/segmentation_organ_values.xlsx") and not name.startswith("__MACOSX/"))
        names = label_names(archive.read(organ_sheet))
        available_female = sorted(set(clinical_female) & members.keys())
        missing_female = sorted(set(clinical_female) - members.keys())
        assert args.focus_case in available_female
        cases = [audit_case(archive, members[case_id], case_id == args.focus_case) for case_id in available_female]
        focus_sha = hashlib.sha256(archive.read(members[args.focus_case])).hexdigest()
    all_present = sorted({number for case in cases for number in case["presentLabels"]})
    report = {
        "source": "TCIA Healthy-Total-Body-CTs segmentation v3, 2026-09-23",
        "segmentationUrl": "https://www.cancerimagingarchive.net/wp-content/uploads/Healthy-Total-Body-Cts_20260923.zip",
        "clinicalUrl": "https://www.cancerimagingarchive.net/wp-content/uploads/Healthy-Total-Body-CTs_v02_20240927.xlsx",
        "archiveSha256": sha256(args.segmentation_zip), "clinicalSha256": hashlib.sha256(clinical).hexdigest(),
        "focusCompressedNiftiSha256": focus_sha, "focusCaseId": args.focus_case,
        "spreadsheetLabelCount": len(names), "spreadsheetLabels": {str(number): name for number, name in sorted(names.items())},
        "clinicalFemaleCaseIds": clinical_female, "femaleCasesMissingSegmentation": missing_female,
        "availableFemaleCaseIds": available_female, "allFemalePresentLabels": all_present,
        "cases": cases,
        "scope": "Public automatic segmentation masks only; no controlled CT images or anatomical accuracy validation.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"femaleCases": len(cases), "missingCases": missing_female,
                      "allPresentLabels": all_present, "focusBounds": next(case for case in cases if case["caseId"] == args.focus_case).get("focusBoundsGridInclusive")}, indent=2))


if __name__ == "__main__":
    main()
