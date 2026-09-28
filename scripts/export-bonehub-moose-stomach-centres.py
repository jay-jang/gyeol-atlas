"""Export every same-donor CT stomach-label voxel centre for offline HRA screening.

The output is a derived diagnostic point cloud in .cache, not a surface mesh or
an app asset. It does not imply successful CT-to-HRA organ registration.
"""

import argparse
import hashlib
import json
from pathlib import Path

import nibabel as nib
import numpy as np


SEGMENTATION_SHA256 = "220bbcb2c6d93634733da1c6d3d432d9c725604569c571f28629e024a8e9d28c"
THORAX_SHA256 = "5e20c0ffc696b262a2732b99c57df32319232697aad371dcad63cf4e02583dee"
STOMACH_LABEL = 16


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("segmentation", type=Path)
    parser.add_argument("thorax_report", type=Path)
    parser.add_argument("points_output", type=Path)
    parser.add_argument("receipt_output", type=Path)
    args = parser.parse_args()
    if sha256(args.segmentation) != SEGMENTATION_SHA256 or sha256(args.thorax_report) != THORAX_SHA256:
        raise ValueError("Unexpected segmentation or thoracic alignment source")
    if args.points_output.resolve() == args.segmentation.resolve():
        raise ValueError("Refusing to overwrite the segmentation")
    thorax = json.loads(args.thorax_report.read_text(encoding="utf-8"))
    matrix = np.asarray(next(row for row in thorax["candidates"] if row["mode"] == "rigid")[
        "matrixColumnMajor"], dtype=np.float64).reshape((4, 4), order="F")
    image = nib.load(args.segmentation)
    mask = np.asanyarray(image.dataobj) == STOMACH_LABEL
    indices = np.column_stack(np.nonzero(mask)).astype(np.float64)
    if len(indices) != 108011:
        raise ValueError("Unexpected same-donor stomach-label voxel count")
    ras = indices @ image.affine[:3, :3].T + image.affine[:3, 3]
    app = np.column_stack((-ras[:, 0], ras[:, 2], ras[:, 1])) / 1000
    placed = app @ matrix[:3, :3].T + matrix[:3, 3]
    if not np.all(np.isfinite(placed)):
        raise ValueError("Nonfinite registered voxel centre")
    output = np.asarray(placed, dtype="<f4")
    args.points_output.parent.mkdir(parents=True, exist_ok=True)
    output.tofile(args.points_output)
    receipt = {
        "status": "OFFLINE VOXEL CENTRES ONLY; NOT A STOMACH SURFACE OR ATLAS MODEL",
        "segmentationSha256": SEGMENTATION_SHA256,
        "thoraxScreenSha256": THORAX_SHA256,
        "label": STOMACH_LABEL, "voxels": len(output),
        "pointFormat": "XYZ float32 little-endian metres in candidate HRA frame",
        "pointFile": str(args.points_output), "pointFileSha256": sha256(args.points_output),
        "centroidMetres": output.astype(np.float64).mean(axis=0).tolist(),
        "boundsMetres": [output.min(axis=0).tolist(), output.max(axis=0).tolist()],
        "scriptSha256": sha256(Path(__file__)),
    }
    args.receipt_output.parent.mkdir(parents=True, exist_ok=True)
    args.receipt_output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print({"voxels": len(output), "pointsSha256": receipt["pointFileSha256"]})


if __name__ == "__main__":
    main()
