"""Screen automatic bone labels against BoneHub's same-donor CT segmentations.

This is voxel agreement at about 2 mm, not anatomy/clinical validation. It
does not write any model geometry or change the atlas.
"""

import argparse
import hashlib
import json
from pathlib import Path

import nibabel as nib
import nrrd
import numpy as np


CT_SHA256 = "638c569c9a702a6c7b3f50e36fe4be8ef7acc2ab0c53d960ad19418d7f00d979"
INPUT_SHA256 = "92996cd3b2e8169d2fcb5456b5a02e06c6269bdeb43b19de8eac1f3421f9edf9"
SEGMENTATION_SHA256 = "c9e3566b36443600051e1c7067a4cf306375fa836e863348d52a7d6918f6b150"
MODEL_DATASET_SHA256 = "f3d8e43a0f9dada1ec77f86fbedd6c06dc0605d2d5018ddb831c81fb382c1a6f"
SOURCE_SHAPE = (673, 670, 1727)
COMPARISONS = {
    "SKULL.seg.nrrd": [(23, None, "skull with mandible")],
    "UPPER_EXTREMITY_RIGHT.seg.nrrd": [
        (4, 1, "clavicle_right"), (22, 2, "scapula_right"),
        (12, 3, "humerus_right"), (20, 4, "radius_right"),
        (31, 5, "ulna_right"),
    ],
    "LOWER_EXTREMITY_LEFT.seg.nrrd": [
        (26, 1, "tibia_left"), (7, 2, "fibula_left"),
        (5, 3, "femur_left"), (17, 4, "patella_left"),
    ],
}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def summary(mask, affine):
    indices = np.nonzero(mask)
    count = len(indices[0])
    if not count:
        return {"voxels": 0, "centroidMm": None, "bboxVoxels": None}
    centre = np.array([axis.mean() for axis in indices])
    return {
        "voxels": count,
        "centroidMm": (affine[:3, :3] @ centre + affine[:3, 3]).tolist(),
        "bboxVoxels": [[int(axis.min()), int(axis.max())] for axis in indices],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ct", type=Path)
    parser.add_argument("candidate_input", type=Path)
    parser.add_argument("segmentation", type=Path)
    parser.add_argument("source_labels", type=Path)
    parser.add_argument("model_dataset_json", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    for path, expected in ((args.ct, CT_SHA256), (args.candidate_input, INPUT_SHA256),
                           (args.segmentation, SEGMENTATION_SHA256),
                           (args.model_dataset_json, MODEL_DATASET_SHA256)):
        if sha256(path) != expected:
            raise ValueError(f"Unexpected input hash: {path}")
    model_labels = json.loads(args.model_dataset_json.read_text(encoding="utf-8"))["labels"]
    for comparisons in COMPARISONS.values():
        for model_id, _, name in comparisons:
            label_name = "skull" if model_id == 23 else name
            if int(model_labels.get(label_name, -1)) != model_id:
                raise ValueError(f"MOOSE dataset label mapping changed: {label_name}")
    original = nib.load(args.ct)
    candidate = nib.load(args.candidate_input)
    segmented = nib.load(args.segmentation)
    if original.shape != SOURCE_SHAPE or candidate.shape != segmented.shape:
        raise ValueError("Unexpected CT/segmentation dimensions")
    if not np.allclose(candidate.affine, segmented.affine, atol=1e-4):
        raise ValueError("MOOSE result changed the candidate affine")
    if not np.allclose(original.affine[:3, :3], np.diag([-.7226560115814209,
                                                         -.7226560115814209, 1]), atol=1e-6):
        raise ValueError("Unexpected original CT coordinate directions")
    result = np.asanyarray(segmented.dataobj)
    if result.dtype.kind not in "ui":
        raise ValueError("Unexpected MOOSE label dtype")
    # NRRD uses LPS and NIfTI uses RAS. Here their voxel-index grids coincide;
    # prove that from both affines before indexing, instead of mirroring by eye.
    lps_to_ras = np.diag([-1, -1, 1, 1])
    ratios = np.asarray(SOURCE_SHAPE) / np.asarray(result.shape)
    axes = [np.clip(np.rint((np.arange(length) + .5) * ratio - .5).astype(np.intp),
                    0, SOURCE_SHAPE[d] - 1)
            for d, (length, ratio) in enumerate(zip(result.shape, ratios))]
    grid_points = np.stack(np.meshgrid(*[np.array([0, n - 1]) for n in result.shape],
                                       indexing="ij"), axis=-1).reshape(-1, 3)
    old_points = np.column_stack([((grid_points[:, d] + .5) * ratios[d] - .5)
                                  for d in range(3)])
    old_world = (original.affine[:3, :3] @ old_points.T).T + original.affine[:3, 3]
    new_world = (candidate.affine[:3, :3] @ grid_points.T).T + candidate.affine[:3, 3]
    if not np.allclose(old_world, new_world, atol=1e-3):
        raise ValueError("Candidate and original CT voxel centres do not align")
    report = {
        "status": "OFFLINE SCREEN ONLY; NOT APPROVED FOR ATLAS",
        "ctSha256": CT_SHA256, "candidateInputSha256": INPUT_SHA256,
        "segmentationSha256": SEGMENTATION_SHA256,
        "modelDatasetJsonSha256": MODEL_DATASET_SHA256,
        "comparisonGridShape": list(result.shape),
        "comparisonVoxelMm": list(map(float, segmented.header.get_zooms()[:3])),
        "resampling": "nearest-neighbour original NRRD label samples at 2 mm candidate voxel centres",
        "comparisons": [],
        "limitations": [
            "BoneHub labels are same-donor reference annotations, not a clinical gold standard.",
            "A low-resolution overlap score cannot approve topology, joints, skin fit, or HRA alignment.",
            "Only uniquely labelled source structures and skull union are compared; overlapping NRRD layers are excluded.",
        ],
    }
    for filename, comparisons in COMPARISONS.items():
        path = args.source_labels / filename
        source, header = nrrd.read(path, index_order="F")
        if source.shape != SOURCE_SHAPE:
            raise ValueError(f"Unexpected NRRD shape: {filename}")
        nrrd_affine = np.eye(4)
        nrrd_affine[:3, :3] = np.asarray(header["space directions"]).T
        nrrd_affine[:3, 3] = np.asarray(header["space origin"])
        if not np.allclose(original.affine, lps_to_ras @ nrrd_affine, atol=1e-6):
            raise ValueError(f"NRRD is not on the same original CT grid: {filename}")
        sampled = source[np.ix_(*axes)]
        label_sha = sha256(path)
        for model_id, source_id, name in comparisons:
            if source_id is None:
                reference_mask = sampled != 0
            else:
                if not any(header.get(f"Segment{i}_Name", "") == name.upper()
                           and int(header.get(f"Segment{i}_LabelValue", -1)) == source_id
                           for i in range(30)):
                    raise ValueError(f"Source label name/value mismatch: {name}")
                reference_mask = sampled == source_id
            candidate_mask = result == model_id
            reference = summary(reference_mask, candidate.affine)
            predicted = summary(candidate_mask, candidate.affine)
            intersection = int(np.count_nonzero(reference_mask & candidate_mask))
            denom = reference["voxels"] + predicted["voxels"]
            distance = None
            if reference["centroidMm"] and predicted["centroidMm"]:
                distance = float(np.linalg.norm(np.asarray(reference["centroidMm"]) -
                                                np.asarray(predicted["centroidMm"])))
            report["comparisons"].append({
                "name": name, "mooseLabel": model_id, "sourceFile": filename,
                "sourceFileSha256": label_sha, "sourceLabel": source_id,
                "reference": reference, "candidate": predicted,
                "intersectionVoxels": intersection,
                "dice": 2 * intersection / denom if denom else None,
                "centroidDistanceMm": distance,
            })
        del source, sampled
    report["scriptSha256"] = sha256(Path(__file__))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for item in report["comparisons"]:
        print(item["name"], "dice", round(item["dice"], 4), "centroidMm",
              round(item["centroidDistanceMm"], 2), "voxels",
              item["reference"]["voxels"], item["candidate"]["voxels"])


if __name__ == "__main__":
    main()
