"""Extract an offline *candidate* stomach boundary from the pinned female CT mask.

This Marching Cubes isovalue is a segmentation-derived boundary, not validated
stomach wall anatomy. The output stays in .cache and is never an app asset.
"""

import argparse
import hashlib
import json
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy import ndimage
from skimage.measure import marching_cubes


SEGMENTATION_SHA256 = "220bbcb2c6d93634733da1c6d3d432d9c725604569c571f28629e024a8e9d28c"
THORAX_SHA256 = "5e20c0ffc696b262a2732b99c57df32319232697aad371dcad63cf4e02583dee"
STOMACH_LABEL = 16
STOMACH_VOXELS = 108011


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
    parser.add_argument("mesh_output", type=Path)
    parser.add_argument("receipt_output", type=Path)
    args = parser.parse_args()
    if sha256(args.segmentation) != SEGMENTATION_SHA256 or sha256(args.thorax_report) != THORAX_SHA256:
        raise ValueError("Unexpected segmentation or thoracic alignment source")
    if args.mesh_output.resolve() in (args.segmentation.resolve(), args.thorax_report.resolve()):
        raise ValueError("Refusing to overwrite a source")
    image = nib.load(args.segmentation)
    labels = np.asanyarray(image.dataobj)
    box = ndimage.find_objects(labels)[STOMACH_LABEL - 1]
    if box is None:
        raise ValueError("Stomach label missing")
    mask = labels[box] == STOMACH_LABEL
    if int(mask.sum()) != STOMACH_VOXELS:
        raise ValueError("Unexpected stomach label voxel count")
    padded = np.pad(mask, 1, mode="constant", constant_values=False)
    vertices, faces, _, _ = marching_cubes(padded.astype(np.uint8), level=.5,
                                           allow_degenerate=False, method="lewiner")
    index = vertices.astype(np.float64) + np.asarray([s.start - 1 for s in box])
    ras = index @ image.affine[:3, :3].T + image.affine[:3, 3]
    app = np.column_stack((-ras[:, 0], ras[:, 2], ras[:, 1])) / 1000
    thorax = json.loads(args.thorax_report.read_text(encoding="utf-8"))
    matrix = np.asarray(next(row for row in thorax["candidates"] if row["mode"] == "rigid")[
        "matrixColumnMajor"], dtype=np.float64).reshape((4, 4), order="F")
    placed = app @ matrix[:3, :3].T + matrix[:3, 3]
    if not np.all(np.isfinite(placed)) or len(vertices) == 0 or len(faces) == 0:
        raise ValueError("Invalid stomach candidate surface")
    positions = np.asarray(placed, dtype="<f4")
    triangles = np.asarray(faces, dtype="<u4")
    args.mesh_output.parent.mkdir(parents=True, exist_ok=True)
    with args.mesh_output.open("wb") as stream:
        stream.write(positions.tobytes(order="C"))
        stream.write(triangles.tobytes(order="C"))
    receipt = {
        "status": "OFFLINE SEGMENTATION-BOUNDARY CANDIDATE; NOT VALIDATED STOMACH ANATOMY",
        "segmentationSha256": SEGMENTATION_SHA256,
        "thoraxScreenSha256": THORAX_SHA256,
        "label": STOMACH_LABEL, "sourceVoxelCount": STOMACH_VOXELS,
        "algorithm": "scikit-image Lewiner marching_cubes, padded binary mask, level 0.5",
        "coordinateFrame": "CT voxel index -> NIfTI RAS mm -> app left/up/anterior m -> thoracic rigid candidate",
        "meshFormat": "XYZ float32 little-endian metres, then triangle ABC uint32 little-endian",
        "vertexCount": len(positions), "triangleCount": len(triangles),
        "vertexBoundsMetres": [positions.min(axis=0).tolist(), positions.max(axis=0).tolist()],
        "meshFile": str(args.mesh_output), "meshFileSha256": sha256(args.mesh_output),
        "scriptSha256": sha256(Path(__file__)),
    }
    args.receipt_output.parent.mkdir(parents=True, exist_ok=True)
    args.receipt_output.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print({"vertices": len(positions), "triangles": len(triangles),
           "meshSha256": receipt["meshFileSha256"]})


if __name__ == "__main__":
    main()
