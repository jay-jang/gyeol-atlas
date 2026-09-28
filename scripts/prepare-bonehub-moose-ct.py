"""Prepare a low-resolution, HU-calibrated *candidate* for offline MOOSE screening.

The BoneHub NIfTI holds unsigned CT stored values. A matching Visible Human
Female DICOM slice has RescaleSlope=1 and RescaleIntercept=-1024. This script
does not assert that an automatic segmentation is anatomically acceptable.
"""

import argparse
import hashlib
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy.ndimage import zoom


SOURCE_SHA256 = "638c569c9a702a6c7b3f50e36fe4be8ef7acc2ab0c53d960ad19418d7f00d979"
SOURCE_SHAPE = (673, 670, 1727)
SOURCE_SPACING = (0.7226560115814209, 0.7226560115814209, 1.0)
HU_INTERCEPT = -1024


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def candidate_affine(affine, source_shape, output_shape):
    """Map new voxel centres onto the old grid's equal-size voxel-edge extent."""
    ratios = np.asarray(source_shape, dtype=np.float64) / output_shape
    result = affine.copy()
    result[:3, :3] = affine[:3, :3] @ np.diag(ratios)
    result[:3, 3] = affine[:3, 3] + affine[:3, :3] @ ((ratios - 1) / 2)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--spacing-mm", type=float, default=2.0)
    args = parser.parse_args()
    if not np.isfinite(args.spacing_mm) or args.spacing_mm < 1.0:
        parser.error("--spacing-mm must be finite and at least 1 mm")
    if args.source.resolve() == args.output.resolve():
        parser.error("output must not overwrite the source")
    if sha256(args.source) != SOURCE_SHA256:
        raise ValueError("Unexpected BoneHub source SHA-256")

    image = nib.load(args.source)
    if image.shape != SOURCE_SHAPE or image.get_data_dtype() != np.dtype("uint16"):
        raise ValueError("Unexpected BoneHub CT shape or dtype")
    if not np.allclose(image.header.get_zooms()[:3], SOURCE_SPACING, atol=1e-6):
        raise ValueError("Unexpected BoneHub voxel spacing")
    if not np.allclose(image.affine[:3, :3], np.diag([-SOURCE_SPACING[0], -SOURCE_SPACING[1], 1]), atol=1e-6):
        raise ValueError("Unexpected BoneHub CT orientation")
    stored = np.asanyarray(image.dataobj)
    if stored.min() != 0 or stored.max() != 4050:
        raise ValueError("Unexpected stored-value range")

    factors = np.asarray(SOURCE_SPACING) / args.spacing_mm
    resampled = zoom(stored, factors, order=1, prefilter=False, grid_mode=True, mode="nearest", output=np.float32)
    affine = candidate_affine(image.affine, SOURCE_SHAPE, resampled.shape)
    np.rint(resampled, out=resampled)
    resampled += HU_INTERCEPT
    hu = resampled.astype(np.int16)
    result = nib.Nifti1Image(hu, affine)
    result.header.set_xyzt_units("mm")
    result.set_qform(affine, code=1)
    result.set_sform(affine, code=1)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    nib.save(result, args.output)
    print({
        "sourceSha256": SOURCE_SHA256,
        "output": str(args.output),
        "outputSha256": sha256(args.output),
        "shape": result.shape,
        "spacingMm": result.header.get_zooms()[:3],
        "huCandidateRange": (int(hu.min()), int(hu.max())),
        "status": "candidate only; segmentation and original DICOM-wide calibration not validated",
    })


if __name__ == "__main__":
    main()
