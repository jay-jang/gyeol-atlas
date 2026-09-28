"""Compare all 31 MOOSE peripheral-bone labels with same-CT BoneHub NRRDs.

Each reference uses the actual NRRD (layer, label value), including merged
hand/foot model classes. Two 2 mm samplers expose downsampling sensitivity:
one voxel-centre sample and an eight-subpoint >=50% occupancy vote. This is
an offline source agreement screen, not an atlas alignment approval.
"""

import argparse
import hashlib
import itertools
import json
from pathlib import Path

import nibabel as nib
import nrrd
import numpy as np
from scipy.ndimage import find_objects


CT_SHA256 = "638c569c9a702a6c7b3f50e36fe4be8ef7acc2ab0c53d960ad19418d7f00d979"
INPUT_SHA256 = "92996cd3b2e8169d2fcb5456b5a02e06c6269bdeb43b19de8eac1f3421f9edf9"
SEGMENTATION_SHA256 = "c9e3566b36443600051e1c7067a4cf306375fa836e863348d52a7d6918f6b150"
MODEL_DATASET_SHA256 = "f3d8e43a0f9dada1ec77f86fbedd6c06dc0605d2d5018ddb831c81fb382c1a6f"
SOURCE_SHAPE = (673, 670, 1727)
CARPALS = ("SCAPHOID", "LUNATE", "TRIQUETRUM", "PISIFORM", "TRAPEZIUM",
           "TRAPEZOID", "CAPITATE", "HAMATE")
TARSALS = ("TALUS", "CALCANEUS", "NAVICULAR", "CUBOID", "LATERAL_CUNEIFORM",
           "INTERMEDIATE_CUNEIFORM", "MEDIAL_CUNEIFORM")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def reference_for(model_name):
    if model_name == "skull":
        return "SKULL.seg.nrrd", ("SKULL_CRANIAL_MAXILLA", "SKULL_MANDIBLE")
    kind, side = model_name.rsplit("_", 1)
    suffix = "_" + side.upper()
    if kind in ("carpal", "fingers", "metacarpal"):
        filename = f"HAND_{side.upper()}.seg.nrrd"
        if kind == "carpal":
            names = tuple(bone + suffix for bone in CARPALS)
        elif kind == "fingers":
            names = tuple(f"PHALANGE_HAND_{i}{suffix}" for i in range(1, 6))
        else:
            names = tuple(f"METACARPAL_{i}{suffix}" for i in range(1, 6))
    elif kind in ("tarsal", "toes", "metatarsal"):
        filename = f"FOOT_{side.upper()}.seg.nrrd"
        if kind == "tarsal":
            names = tuple(bone + suffix for bone in TARSALS)
        elif kind == "toes":
            names = tuple(f"PHALANGE_FOOT_{i}{suffix}" for i in range(1, 6))
        else:
            names = tuple(f"METATARSAL_{i}{suffix}" for i in range(1, 6))
    elif kind in ("clavicle", "scapula", "humerus", "radius", "ulna"):
        filename = f"UPPER_EXTREMITY_{side.upper()}.seg.nrrd"
        names = (kind.upper() + suffix,)
    elif kind in ("femur", "fibula", "patella", "tibia"):
        filename = f"LOWER_EXTREMITY_{side.upper()}.seg.nrrd"
        names = (kind.upper() + suffix,)
    else:
        raise ValueError(f"Unexpected MOOSE peripheral-bone label: {model_name}")
    return filename, names


def source_segments(header):
    result = {}
    occupied = set()
    i = 0
    while f"Segment{i}_Name" in header:
        name = header[f"Segment{i}_Name"]
        pair = (int(header[f"Segment{i}_Layer"]), int(header[f"Segment{i}_LabelValue"]))
        if name in result or pair in occupied:
            raise ValueError(f"NRRD duplicates name or layer/value: {name}, {pair}")
        result[name] = pair
        occupied.add(pair)
        i += 1
    return result


def mask_summary(mask, affine, roi):
    points = np.nonzero(mask)
    count = len(points[0])
    if not count:
        return {"voxels": 0, "centroidMm": None}
    centre = np.array([axis.mean() + region.start for axis, region in zip(points, roi)])
    return {"voxels": count,
            "centroidMm": (affine[:3, :3] @ centre + affine[:3, 3]).tolist()}


def compare_mask(reference, candidate, affine, roi):
    ref = mask_summary(reference, affine, roi)
    pred = mask_summary(candidate, affine, roi)
    overlap = int(np.count_nonzero(reference & candidate))
    total = ref["voxels"] + pred["voxels"]
    distance = None
    if ref["centroidMm"] is not None and pred["centroidMm"] is not None:
        distance = float(np.linalg.norm(np.asarray(ref["centroidMm"]) -
                                        np.asarray(pred["centroidMm"])))
    return {"reference": ref, "candidate": pred, "intersectionVoxels": overlap,
            "dice": (2 * overlap / total) if total else None,
            "centroidDistanceMm": distance}


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
            raise ValueError(f"Unexpected pinned input: {path}")
    original = nib.load(args.ct)
    candidate = nib.load(args.candidate_input)
    segmented = nib.load(args.segmentation)
    if original.shape != SOURCE_SHAPE or candidate.shape != segmented.shape:
        raise ValueError("Unexpected CT/segmentation shape")
    if not np.allclose(candidate.affine, segmented.affine, atol=1e-4, rtol=0):
        raise ValueError("MOOSE output changed the candidate CT grid")
    result = np.asanyarray(segmented.dataobj)
    model_labels = json.loads(args.model_dataset_json.read_text(encoding="utf-8"))["labels"]
    if {int(v) for v in model_labels.values()} != set(range(32)):
        raise ValueError("MOOSE label IDs are not exactly 0..31")
    if set(np.unique(result)) != set(range(32)):
        raise ValueError("Segmentation does not contain all 31 labels")
    groups = {}
    for name, number in model_labels.items():
        if name == "background":
            continue
        filename, reference_names = reference_for(name)
        groups.setdefault(filename, []).append((int(number), name, reference_names))
    object_slices = find_objects(result)
    ratios = np.asarray(SOURCE_SHAPE) / np.asarray(result.shape)
    corners = np.stack(np.meshgrid(*([0, n - 1] for n in result.shape), indexing="ij"),
                       axis=-1).reshape(-1, 3)
    old_centres = (corners + .5) * ratios - .5
    old_world = (original.affine[:3, :3] @ old_centres.T).T + original.affine[:3, 3]
    new_world = (candidate.affine[:3, :3] @ corners.T).T + candidate.affine[:3, 3]
    corner_distance = np.linalg.norm(old_world - new_world, axis=1)
    if not np.allclose(old_world, new_world, atol=1e-3, rtol=0):
        raise ValueError("Original and candidate CT voxel centres do not align")
    report = {
        "status": "ALL 31 SAME-CT SOURCE AGREEMENT SCREEN; NOT ATLAS APPROVAL",
        "ctSha256": CT_SHA256, "candidateInputSha256": INPUT_SHA256,
        "segmentationSha256": SEGMENTATION_SHA256,
        "modelDatasetJsonSha256": MODEL_DATASET_SHA256,
        "comparisonGridShape": list(result.shape),
        "candidateCornerMaxDistanceMm": float(corner_distance.max()),
        "samplers": ["one nearest source voxel at output voxel centre",
                     "eight nearest source samples at +/-0.25 output voxels; >=4/8 foreground"],
        "comparisons": [], "sourceFiles": {}, "sourceAffineMaxAbsDifference": {},
        "limitations": [
            "Same-CT annotations are not an independent clinical gold standard.",
            "Eight subpoints are a sampling sensitivity test, not exact volume occupancy.",
            "2 mm Dice does not validate mesh surface, joints, skin or HRA-frame position.",
            "Hand/finger and foot/toe model labels are grouped, not individual bone anatomy.",
        ],
    }
    lps_to_ras = np.diag([-1, -1, 1, 1])
    for filename, comparisons in groups.items():
        path = args.source_labels / filename
        source, header = nrrd.read(path, index_order="F")
        if source.ndim == 3:
            spatial = source[None, ...]
            directions = np.asarray(header["space directions"])
        elif source.ndim == 4 and header["kinds"][0] == "list":
            spatial = source
            directions = np.asarray(header["space directions"])[1:]
        else:
            raise ValueError(f"Unexpected NRRD dimensions: {filename}")
        if tuple(spatial.shape[1:]) != SOURCE_SHAPE:
            raise ValueError(f"Unexpected source grid: {filename}")
        nrrd_affine = np.eye(4)
        nrrd_affine[:3, :3] = directions.T
        nrrd_affine[:3, 3] = header["space origin"]
        source_affine_delta = np.abs(original.affine - lps_to_ras @ nrrd_affine)
        if not np.allclose(original.affine, lps_to_ras @ nrrd_affine, atol=1e-6, rtol=0):
            raise ValueError(f"NRRD and CT affines do not match: {filename}")
        report["sourceAffineMaxAbsDifference"][filename] = float(source_affine_delta.max())
        segments = source_segments(header)
        objects = [find_objects(layer) for layer in spatial]
        report["sourceFiles"][filename] = sha256(path)
        for model_id, model_name, names in comparisons:
            pairs = [segments[name] for name in names]
            if any(layer >= len(objects) or value > len(objects[layer]) or
                   objects[layer][value - 1] is None for layer, value in pairs):
                raise ValueError(f"Empty or invalid source segment: {model_name}")
            candidate_slice = object_slices[model_id - 1]
            if candidate_slice is None:
                raise ValueError(f"Empty MOOSE label: {model_name}")
            starts = [s.start for s in candidate_slice]
            stops = [s.stop for s in candidate_slice]
            for layer, value in pairs:
                for dim, region in enumerate(objects[layer][value - 1]):
                    starts[dim] = min(starts[dim],
                                      int(np.floor((region.start + .5) / ratios[dim] - .5)) - 3)
                    stops[dim] = max(stops[dim],
                                     int(np.ceil((region.stop - .5) / ratios[dim] - .5)) + 4)
            roi = tuple(slice(max(0, start), min(result.shape[d], stop))
                        for d, (start, stop) in enumerate(zip(starts, stops)))
            expected = result[roi] == model_id
            occupancy = np.zeros(expected.shape, dtype=np.uint8)
            centre = None
            for shifts in ((0., 0., 0.), *itertools.product((-.25, .25), repeat=3)):
                axes = [np.clip(np.rint((np.arange(region.start, region.stop) + shift + .5) * ratio - .5)
                                .astype(np.intp), 0, SOURCE_SHAPE[d] - 1)
                        for d, (region, shift, ratio) in enumerate(zip(roi, shifts, ratios))]
                reference = np.zeros(expected.shape, dtype=bool)
                for layer, value in pairs:
                    reference |= spatial[layer][np.ix_(*axes)] == value
                if shifts == (0., 0., 0.):
                    centre = compare_mask(reference, expected, candidate.affine, roi)
                else:
                    occupancy += reference
            majority = compare_mask(occupancy >= 4, expected, candidate.affine, roi)
            highres_count = sum(int(np.count_nonzero(spatial[layer][objects[layer][value - 1]] == value))
                                for layer, value in pairs)
            report["comparisons"].append({
                "name": model_name, "mooseLabel": model_id, "sourceFile": filename,
                "sourceSegments": [{"name": name, "layer": layer, "value": value}
                                   for name, (layer, value) in zip(names, pairs)],
                "sourceHighResolutionVoxels": highres_count,
                "roi": [[s.start, s.stop] for s in roi],
                "nearest": centre, "eightSubpointMajority": majority,
            })
        del source, spatial
    report["comparisons"].sort(key=lambda entry: entry["mooseLabel"])
    if [entry["mooseLabel"] for entry in report["comparisons"]] != list(range(1, 32)):
        raise ValueError("Incomplete MOOSE peripheral-bone comparison")
    report["scriptSha256"] = sha256(Path(__file__))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    for row in report["comparisons"]:
        print(row["name"], "nearest", round(row["nearest"]["dice"], 4),
              "majority", round(row["eightSubpointMajority"]["dice"], 4))


if __name__ == "__main__":
    main()
