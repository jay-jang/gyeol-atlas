"""Screen same-donor female CT organ labels against HRA organ positions.

Uses the *held-out organ* comparison under an existing thoracic-spine rigid
candidate. A box-centre residual is not an anatomy registration or evidence
that an organ can be safely overlaid on the HRA body.
"""

import argparse
import hashlib
import itertools
import json
from pathlib import Path

import nibabel as nib
import numpy as np
from scipy import ndimage


INPUT_SHA256 = "92996cd3b2e8169d2fcb5456b5a02e06c6269bdeb43b19de8eac1f3421f9edf9"
SEGMENTATION_SHA256 = "220bbcb2c6d93634733da1c6d3d432d9c725604569c571f28629e024a8e9d28c"
MODEL_DATASET_SHA256 = "db8acaff49333781fc4d88572399e37fa483f9e94ff250db6bb5cbdae53fa05f"
THORAX_SHA256 = "5e20c0ffc696b262a2732b99c57df32319232697aad371dcad63cf4e02583dee"
ATLAS_SHA256 = "349ad9085901db2cced179d467542271289ee0b259414a78814402d5ac374d2f"
HRA_TARGETS = {
    "liver": ["HRAF0474"],
    "kidney_left": ["HRAF0528"],
    "kidney_right": ["HRAF0554"],
    "pancreas": ["HRAF0493", "HRAF0494", "HRAF0496", "HRAF0497"],
    "spleen": ["HRAF0809", "HRAF0810", "HRAF0811", "HRAF0812", "HRAF0813"],
    "gallbladder": ["HRAF0527"],
    "trachea": ["HRAF0773"],
}


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def world_from_index(index, affine, thorax_matrix):
    """NIfTI RAS mm -> app left/up/anterior m -> held-out-spine candidate."""
    index = np.asarray(index, dtype=np.float64)
    ras = index @ affine[:3, :3].T + affine[:3, 3]
    app = np.stack((-ras[..., 0], ras[..., 2], ras[..., 1]), axis=-1) / 1000
    return app @ thorax_matrix[:3, :3].T + thorax_matrix[:3, 3]


def candidate_bounds(voxel_bounds, affine, thorax_matrix):
    # Voxel cells, not just centre coordinates, determine the enclosed box.
    limits = [(start - .5, stop - .5) for start, stop in voxel_bounds]
    corners = np.asarray(list(itertools.product(*limits)), dtype=np.float64)
    world = world_from_index(corners, affine, thorax_matrix)
    return [world.min(axis=0).tolist(), world.max(axis=0).tolist()]


def group_bbox(parts, ids):
    boxes = np.asarray([parts[id]["bounds"] for id in ids], dtype=np.float64)
    return [boxes[:, 0].min(axis=0).tolist(), boxes[:, 1].max(axis=0).tolist()]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("candidate_input", type=Path)
    parser.add_argument("segmentation", type=Path)
    parser.add_argument("model_dataset_json", type=Path)
    parser.add_argument("thorax_report", type=Path)
    parser.add_argument("female_atlas", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    for path, expected in ((args.candidate_input, INPUT_SHA256),
                           (args.segmentation, SEGMENTATION_SHA256),
                           (args.model_dataset_json, MODEL_DATASET_SHA256),
                           (args.thorax_report, THORAX_SHA256),
                           (args.female_atlas, ATLAS_SHA256)):
        if sha256(path) != expected:
            raise ValueError(f"Unexpected pinned source: {path}")
    candidate = nib.load(args.candidate_input)
    segmented = nib.load(args.segmentation)
    if candidate.shape != (243, 242, 864) or segmented.shape != candidate.shape:
        raise ValueError("Unexpected candidate/segmentation shape")
    if not np.allclose(candidate.affine, segmented.affine, atol=1e-4, rtol=0):
        raise ValueError("MOOSE output is not on the candidate CT grid")
    labels = json.loads(args.model_dataset_json.read_text(encoding="utf-8"))["labels"]
    if {int(v) for v in labels.values()} != set(range(20)):
        raise ValueError("Unexpected MOOSE organ label set")
    thorax = json.loads(args.thorax_report.read_text(encoding="utf-8"))
    rigid = next(item for item in thorax["candidates"] if item["mode"] == "rigid")
    matrix = np.asarray(rigid["matrixColumnMajor"], dtype=np.float64).reshape((4, 4), order="F")
    if not np.allclose(matrix[3], [0, 0, 0, 1], atol=1e-12, rtol=0) or not np.isclose(
            np.linalg.det(matrix[:3, :3]), 1, atol=1e-5, rtol=0):
        raise ValueError("Unexpected thoracic-spine rigid transform")
    atlas = json.loads(args.female_atlas.read_text(encoding="utf-8"))
    if atlas["sex"] != "female" or "v1.10" not in atlas["version"]:
        raise ValueError("Unexpected target atlas")
    parts = {part["id"]: part for part in atlas["parts"]}
    if any(id not in parts or parts[id]["system"] == "borrowed"
           for ids in HRA_TARGETS.values() for id in ids):
        raise ValueError("Target organ missing or male-borrowed")
    # HRA lung segments are explicitly named and both sides have ten entries.
    lung = [part for part in atlas["parts"] if "bronchopulmonary segment" in part["name"].lower()]
    left = [part["id"] for part in lung if part["name"].startswith("Left ") or
            part["name"].startswith("Lingula ")]
    right = [part["id"] for part in lung if part["name"].startswith("Right ")]
    if len(left) != 10 or len(right) != 10:
        raise ValueError("Unexpected HRA lung segment membership")
    targets = {**HRA_TARGETS, "lung_left": left, "lung_right": right}
    seg = np.asanyarray(segmented.dataobj)
    voxel_volume_mm3 = float(abs(np.linalg.det(segmented.affine[:3, :3])))
    objects = ndimage.find_objects(seg)
    report = {
        "status": "SAME-DONOR CT ORGAN CANDIDATE; NOT HRA REGISTRATION OR ATLAS APPROVAL",
        "candidateInputSha256": INPUT_SHA256,
        "segmentationSha256": SEGMENTATION_SHA256,
        "modelDatasetJsonSha256": MODEL_DATASET_SHA256,
        "thoraxScreenSha256": THORAX_SHA256,
        "femaleAtlasSha256": ATLAS_SHA256,
        "sourceFrame": "MOOSE CT voxel -> NIfTI RAS mm -> app left/up/anterior m -> rigid fitted on even thoracic vertebra box centres",
        "voxelVolumeMm3": voxel_volume_mm3,
        "thoraxHeldOutOddVertebraMaxResidualMm": max(
            row["centreResidualMm"] for row in rigid["spine"] if not row["training"]),
        "labels": [], "comparisons": [],
        "limitations": [
            "The CT-to-HRA transform was fitted on thoracic bones only, never on these organs.",
            "A CT volume mask and an HRA surface group have different anatomical definitions; box centres are a screening metric only.",
            "A high model confidence or low box-centre residual would not validate topology, surface fit, connected ducts/vessels, or HRA pose.",
            "Brain atlas meshes may come from another donor; brain is listed but deliberately not treated as a same-donor HRA comparison.",
        ],
    }
    for name, value in sorted(labels.items(), key=lambda item: int(item[1])):
        label_id = int(value)
        if not label_id:
            continue
        bounds = objects[label_id - 1]
        if bounds is None:
            report["labels"].append({"name": name, "label": label_id, "voxels": 0})
            continue
        roi = seg[bounds] == label_id
        voxels = int(np.count_nonzero(roi))
        local = np.nonzero(roi)
        center_index = np.asarray([axis.mean() + bounds[d].start for d, axis in enumerate(local)])
        source_boxes = [[s.start, s.stop] for s in bounds]
        components, count = ndimage.label(roi)
        sizes = np.bincount(components.ravel())[1:]
        component_slices = ndimage.find_objects(components)
        largest = sorted(range(1, count + 1), key=lambda component: sizes[component - 1], reverse=True)[:3]
        top_components = []
        for component in largest:
            crop = component_slices[component - 1]
            top_components.append({
                "voxels": int(sizes[component - 1]),
                "voxelBoundsHalfOpen": [[bounds[d].start + s.start, bounds[d].start + s.stop]
                                        for d, s in enumerate(crop)],
            })
        row = {
            "name": name, "label": label_id, "voxels": voxels,
            "maskVolumeMl": voxels * voxel_volume_mm3 / 1000,
            "voxelBoundsHalfOpen": source_boxes,
            "componentCount": int(count),
            "largestComponentVoxelFraction": float(sizes.max() / voxels),
            "topComponents": top_components,
            "registeredVoxelCentroidMetres": world_from_index(center_index, segmented.affine, matrix).tolist(),
            "registeredBoundingBoxMetres": candidate_bounds(source_boxes, segmented.affine, matrix),
        }
        report["labels"].append(row)
        del components
    lookup = {row["name"]: row for row in report["labels"]}
    for name, ids in targets.items():
        ct_names = ("lung_lower_lobe_left", "lung_upper_lobe_left") if name == "lung_left" else (
            ("lung_lower_lobe_right", "lung_middle_lobe_right", "lung_upper_lobe_right")
            if name == "lung_right" else (name,))
        ct_rows = [lookup[label_name] for label_name in ct_names]
        if any(not row["voxels"] for row in ct_rows):
            report["comparisons"].append({"name": name, "ctLabels": list(ct_names),
                                          "hraPartIds": ids, "status": "missing CT label"})
            continue
        ct_bounds = np.asarray([row["registeredBoundingBoxMetres"] for row in ct_rows])
        ct_box = [ct_bounds[:, 0].min(axis=0).tolist(), ct_bounds[:, 1].max(axis=0).tolist()]
        target_box = group_bbox(parts, ids)
        ct_centre = np.mean(ct_box, axis=0)
        target_centre = np.mean(target_box, axis=0)
        report["comparisons"].append({
            "name": name, "ctLabels": list(ct_names), "hraPartIds": ids,
            "ctFragmentedAtSixConnectivity": any(
                row["largestComponentVoxelFraction"] < .95 for row in ct_rows),
            "interpretation": ("whole-mask box unreliable: at least one CT label is fragmented"
                               if any(row["largestComponentVoxelFraction"] < .95 for row in ct_rows)
                               else "coarse held-out box-centre screen only"),
            "ctRegisteredBoundingBoxMetres": ct_box,
            "hraBoundingBoxMetres": target_box,
            "bboxCentreDistanceMm": float(np.linalg.norm((ct_centre - target_centre) * 1000)),
            "bboxCentreDeltaMm": ((ct_centre - target_centre) * 1000).tolist(),
        })
    report["scriptSha256"] = sha256(Path(__file__))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print({"nonempty": sum(row["voxels"] > 0 for row in report["labels"]),
           "labels": len(report["labels"]),
           "comparisons": [(row["name"], round(row.get("bboxCentreDistanceMm", float("nan")), 2))
                           for row in report["comparisons"]]})


if __name__ == "__main__":
    main()
