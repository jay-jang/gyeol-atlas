"""Render selected original-grid CT sections with the offline stomach label.

This is a diagnostic visualization, not a proof of segmentation accuracy.
"""

import argparse
import hashlib
import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import nibabel as nib
import numpy as np


CT_SHA256 = "92996cd3b2e8169d2fcb5456b5a02e06c6269bdeb43b19de8eac1f3421f9edf9"
SEG_SHA256 = "220bbcb2c6d93634733da1c6d3d432d9c725604569c571f28629e024a8e9d28c"
SLICES = (("axial", 540), ("axial", 575), ("axial", 610), ("axial", 630),
          ("coronal", 115), ("sagittal", 130))


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ct", type=Path)
    parser.add_argument("segmentation", type=Path)
    parser.add_argument("image_output", type=Path)
    parser.add_argument("receipt_output", type=Path)
    args = parser.parse_args()
    if sha256(args.ct) != CT_SHA256 or sha256(args.segmentation) != SEG_SHA256:
        raise ValueError("Unexpected candidate CT or segmentation")
    ct = nib.load(args.ct)
    segmented = nib.load(args.segmentation)
    if ct.shape != segmented.shape or not np.allclose(ct.affine, segmented.affine, rtol=0, atol=1e-4):
        raise ValueError("CT and segmentation are not on the same candidate grid")
    volume = np.asanyarray(ct.dataobj)
    labels = np.asanyarray(segmented.dataobj)
    fig, axes = plt.subplots(2, 3, figsize=(13, 9), constrained_layout=True)
    descriptions = []
    for ax, (axis, position) in zip(axes.flat, SLICES):
        if axis == "axial":
            gray = volume[:, :, position].T
            mask = (labels[:, :, position] == 16).T
            xlabel, ylabel = "CT x voxel", "CT y voxel"
        elif axis == "coronal":
            gray = volume[:, position, :].T
            mask = (labels[:, position, :] == 16).T
            xlabel, ylabel = "CT x voxel", "CT z voxel"
        else:
            gray = volume[position, :, :].T
            mask = (labels[position, :, :] == 16).T
            xlabel, ylabel = "CT y voxel", "CT z voxel"
        ax.imshow(gray, origin="lower", cmap="gray", vmin=-200, vmax=500,
                  interpolation="nearest")
        overlay = np.zeros((*mask.shape, 4), dtype=np.float32)
        overlay[..., 0] = .95
        overlay[..., 1] = .2
        overlay[..., 2] = .3
        overlay[..., 3] = mask * .45
        ax.imshow(overlay, origin="lower", interpolation="nearest")
        ax.set_title(f"{axis} voxel {position}: stomach label16 / {int(mask.sum())} pixels", fontsize=10)
        ax.set_xlabel(xlabel)
        ax.set_ylabel(ylabel)
        if axis == "coronal":
            ax.set_xlim(55, 195)
            ax.set_ylim(490, 665)
        elif axis == "sagittal":
            ax.set_xlim(60, 170)
            ax.set_ylim(490, 665)
        descriptions.append({"axis": axis, "index": position, "labelPixels": int(mask.sum())})
    fig.suptitle("Visible Human Female CT candidate: MOOSE stomach label (red)", fontsize=13)
    args.image_output.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.image_output, dpi=160)
    plt.close(fig)
    receipt = {
        "status": "SIX SELECTED 2D DIAGNOSTIC SECTIONS; NOT SEGMENTATION APPROVAL",
        "ctSha256": CT_SHA256, "segmentationSha256": SEG_SHA256,
        "displayHUWindow": [-200, 500], "slices": descriptions,
        "imageSha256": sha256(args.image_output),
        "scriptSha256": sha256(Path(__file__)),
    }
    args.receipt_output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print({"slices": len(descriptions), "imageSha256": receipt["imageSha256"]})


if __name__ == "__main__":
    main()
