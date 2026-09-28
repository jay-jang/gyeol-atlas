"""Match a VHF DICOM slice to the BoneHub derivative before CT inference.

The >1500 stored-value mask is an image-registration feature only, not a
clinical bone threshold or validation of the whole DICOM series. No images or
atlas geometry are changed by this audit.
"""

import argparse
import hashlib
import io
import json
from pathlib import Path
from urllib.request import Request, urlopen

import nibabel as nib
import numpy as np
import pydicom
from scipy.ndimage import zoom
from scipy.signal import fftconvolve


SOURCE_SHA256 = "638c569c9a702a6c7b3f50e36fe4be8ef7acc2ab0c53d960ad19418d7f00d979"
DICOM_URL = "https://dataverse.harvard.edu/api/access/datafile/7575838"
DICOM_SHA256 = "0eb0922c813c97a3659cd6984be0297e2f64030b445904fc966d2b6902a386bd"
DICOM_MD5 = "c429a90d77b413d9b19e2e664cd2b56d"
SOURCE_CROP_X = slice(215, 445)
SOURCE_CROP_Y = slice(159, 455)
SOURCE_SLICES = slice(1580, 1605, 2)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--dicom", type=Path, help="A previously downloaded copy of the pinned DICOM slice")
    args = parser.parse_args()
    if sha256(args.source) != SOURCE_SHA256:
        raise ValueError("Unexpected BoneHub CT source SHA-256")
    if args.dicom:
        dicom_bytes = args.dicom.read_bytes()
    else:
        request = Request(DICOM_URL, headers={"User-Agent": "GYEOL source audit/1.0"})
        with urlopen(request, timeout=60) as response:
            dicom_bytes = response.read()
    if hashlib.sha256(dicom_bytes).hexdigest() != DICOM_SHA256 or hashlib.md5(dicom_bytes).hexdigest() != DICOM_MD5:
        raise ValueError("Unexpected Harvard Dataverse DICOM checksum")
    dicom = pydicom.dcmread(io.BytesIO(dicom_bytes))
    if float(dicom.RescaleSlope) != 1 or float(dicom.RescaleIntercept) != -1024:
        raise ValueError("Unexpected original DICOM rescale")
    if list(map(float, dicom.ImagePositionPatient)) != [0, 0, 1599]:
        raise ValueError("Unexpected original DICOM position")
    pixel_spacing = np.asarray(dicom.PixelSpacing, dtype=np.float64)
    orientation = np.asarray(dicom.ImageOrientationPatient, dtype=np.float64)
    if not np.allclose(pixel_spacing, [1, 1], atol=1e-6):
        raise ValueError("Unexpected original DICOM pixel spacing")
    if not np.allclose(orientation, [1, 0, 0, 0, 1, 0], atol=1e-6):
        raise ValueError("Unexpected original DICOM image orientation")
    if float(dicom.SliceThickness) != 1:
        raise ValueError("Unexpected original DICOM slice thickness")
    dicom_values = dicom.pixel_array.astype(np.float32)
    if dicom_values.shape != (512, 512):
        raise ValueError("Unexpected original DICOM dimensions")
    image = nib.load(args.source)
    if image.shape != (673, 670, 1727) or image.get_data_dtype() != np.dtype("uint16"):
        raise ValueError("Unexpected BoneHub CT dimensions or dtype")
    if not np.allclose(image.header.get_zooms()[:3], [.7226560115814209, .7226560115814209, 1], atol=1e-6):
        raise ValueError("Unexpected BoneHub CT spacing")
    # DICOM arrays are row/column (y/x); the transposed BoneHub crop below is
    # also row/column. Match physical spacing before translation-only search.
    bonehub_spacing = image.header.get_zooms()[:2]
    downsample_yx = (bonehub_spacing[1] / pixel_spacing[0],
                     bonehub_spacing[0] / pixel_spacing[1])
    crops = np.asanyarray(image.dataobj)[SOURCE_CROP_X, SOURCE_CROP_Y, SOURCE_SLICES]
    source_mask = (dicom_values > 1500).astype(np.float32)
    source_count = int(source_mask.sum())
    matches = []
    for offset in range(crops.shape[2]):
        candidate = crops[:, :, offset].T
        template_mask = zoom((candidate > 1500).astype(np.float32), downsample_yx, order=0)
        correlation = fftconvolve(source_mask, template_mask[::-1, ::-1], mode="valid")
        shift_yx = np.unravel_index(np.argmax(correlation), correlation.shape)
        overlap = round(float(correlation[shift_yx]))
        template_count = int(template_mask.sum())
        union = source_count + template_count - overlap
        matches.append({
            "bonehubZ": SOURCE_SLICES.start + offset * SOURCE_SLICES.step,
            "offsetYX": [int(v) for v in shift_yx],
            "intersection": overlap,
            "sourceMaskPixels": source_count,
            "candidateMaskPixels": template_count,
            "iou": overlap / union,
        })
    best = max(matches, key=lambda row: row["iou"])
    candidate = crops[:, :, (best["bonehubZ"] - SOURCE_SLICES.start) // SOURCE_SLICES.step].T
    resampled = zoom(candidate.astype(np.float32), downsample_yx, order=1)
    y, x = best["offsetYX"]
    source_patch = dicom_values[y:y + resampled.shape[0], x:x + resampled.shape[1]]
    paired = (source_patch > 0) & (resampled > 0)
    source_pixels, candidate_pixels = source_patch[paired], resampled[paired]
    regression = np.polyfit(source_pixels, candidate_pixels, 1)
    difference = candidate_pixels - source_pixels
    report = {
        "status": "ONE-SLICE STORED-VALUE CALIBRATION SUPPORT; NOT WHOLE-CT OR SEGMENTATION VALIDATION",
        "source": {"path": str(args.source), "sha256": SOURCE_SHA256, "shape": image.shape,
                   "storedDtype": str(image.get_data_dtype()), "niftiSlope": 1, "niftiIntercept": 0},
        "dicom": {"url": DICOM_URL, "datasetDoi": "10.7910/DVN/3JDZCT",
                  "fileId": 7575838, "filename": "VHFCT1mm-Head (100).dcm", "sha256": DICOM_SHA256,
                  "md5": DICOM_MD5, "rescaleSlope": float(dicom.RescaleSlope),
                  "rescaleIntercept": float(dicom.RescaleIntercept),
                  "imagePositionPatient": list(map(float, dicom.ImagePositionPatient)),
                  "pixelSpacingMm": pixel_spacing.tolist(),
                  "imageOrientationPatient": orientation.tolist(),
                  "sliceThicknessMm": float(dicom.SliceThickness)},
        "matching": {"feature": "stored intensity >1500, not a clinical bone threshold",
                     "candidateZValues": [row["bonehubZ"] for row in matches],
                     "best": best, "allCandidates": matches,
                     "positivePairs": int(paired.sum()),
                     "storedValueCorrelation": float(np.corrcoef(source_pixels, candidate_pixels)[0, 1]),
                     "candidateOnSourceLinearSlope": float(regression[0]),
                     "candidateOnSourceLinearIntercept": float(regression[1]),
                     "medianStoredValueDifference": float(np.median(difference)),
                     "p95AbsoluteStoredValueDifference": float(np.quantile(np.abs(difference), .95))},
        "interpretation": [
            "The original DICOM slice has slope 1 and intercept -1024. The BoneHub NIfTI has unsigned stored values and a 1/0 NIfTI scale.",
            "The near-matched same-donor slice supports, but does not prove for every voxel, applying stored value minus 1024 to the BoneHub derivative.",
            "The 2mm MOOSE input is a separate downsampled candidate; neither this audit nor automatic labels are anatomy approval.",
        ],
        "scriptSha256": sha256(Path(__file__)),
    }
    if best["iou"] < .8 or report["matching"]["storedValueCorrelation"] < .99:
        raise ValueError("Original/derivative slice match is too weak for the intended preflight")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print({"best": best, "positivePairs": int(paired.sum()),
           "storedValueCorrelation": report["matching"]["storedValueCorrelation"]})


if __name__ == "__main__":
    main()
