"""Build an independent detail atlas from published female CT masks (no new segmentation).

Dependencies: numpy==1.26.4 nibabel==5.2.1 scikit-image==0.22.0.
The rejected HRA alignment is recorded, never applied to published geometry.
"""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np
import nibabel as nib
from skimage.measure import marching_cubes

import argparse
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--subject", default="s0255")
parser.add_argument("--input-root", default=".cache/female-ct")
args = parser.parse_args()
ROOT = Path(args.input_root) / args.subject
OUTPUT = Path(".cache/female-ct") / args.subject
OUTPUT.mkdir(parents=True, exist_ok=True)
ATLAS = Path("public/models/female/atlas-female.json")
source = json.loads((ROOT / "source.json").read_text())
assert source["subject"]["gender"] == "f"
assert source["subject"]["pathology"] == "no_pathology"
atlas = json.loads(ATLAS.read_text())
by_id = {p["id"]: p for p in atlas["parts"]}


def hra_center(concept):
    ids = next(c["elements"] for c in atlas["concepts"] if c["id"] == concept)
    bounds = np.array([by_id[i]["bounds"] for i in ids])
    return (bounds[:, 0].min(axis=0) + bounds[:, 1].max(axis=0)) / 2


meshes = {}
for file in source["files"]:
    path = ROOT / (file["mask"] + ".nii.gz")
    assert hashlib.sha256(path.read_bytes()).hexdigest() == file["sha256"]
    nii = nib.load(path)
    mask = np.asarray(nii.dataobj)
    assert np.isin(mask, [0, 1]).all(), "Must use the published binary mask unchanged"
    if not mask.any():
        raise ValueError(f"Empty source mask: {file['mask']}; select another case, do not synthesize it")
    # Padding closes the mesh at scan boundaries; those boundaries are recorded,
    # never represented as natural anatomical endings.
    boundary = [bool(np.take(mask, i, axis=a).any()) for a in range(3) for i in [0, -1]]
    vertices, faces, _, _ = marching_cubes(np.pad(mask, 1), level=.5, allow_degenerate=False)
    ras = nib.affines.apply_affine(nii.affine, vertices - 1)
    # NIfTI RAS mm -> atlas: left +X, superior +Y, anterior +Z, meters.
    points = ras[:, [0, 2, 1]] * np.array([-1, 1, 1]) / 1000
    meshes[file["mask"]] = {"vertices": points, "faces": faces, "scanBoundary": boundary,
        "voxelSpacingMm": list(map(float, nii.header.get_zooms())), "voxels": int(mask.sum()),
        "sourceBounds": [points.min(axis=0).tolist(), points.max(axis=0).tolist()]}

anchors = {"liver": "HRA:liver", "spleen": "HRA:spleen", "kidney_left": "HRA:left_kidney", "kidney_right": "HRA:right_kidney"}
x = np.array([np.mean(meshes[name]["sourceBounds"], axis=0) for name in anchors])
y = np.array([hra_center(concept) for concept in anchors.values()])
xc, yc = x - x.mean(axis=0), y - y.mean(axis=0)
u, singular, vt = np.linalg.svd(xc.T @ yc)
correction = np.diag([1, 1, np.linalg.det(u @ vt)])
rotation = u @ correction @ vt
scale = np.sum(singular * np.diag(correction)) / np.sum(xc * xc)
translation = y.mean(axis=0) - scale * x.mean(axis=0) @ rotation


def transform(points):
    return (scale * points @ rotation + translation).astype("<f4")


alignment = {
    "method": "Similarity fit of four shared abdominal organ bounding-box centers; no local warping",
    "clinicalRegistration": False,
    "scale": float(scale), "rowVectorRotation": rotation.tolist(), "translationMeters": translation.tolist(),
    "anchors": [{"mask": name, "concept": concept, "sourceCenter": x[i].tolist(), "targetCenter": y[i].tolist(),
                 "residualMm": float(np.linalg.norm(transform(x[i]) - y[i]) * 1000)} for i, (name, concept) in enumerate(anchors.items())],
    "heldOutPancreasCenterMm": float(np.linalg.norm(transform(np.mean(meshes["pancreas"]["sourceBounds"], axis=0)) - hra_center("HRA:pancreas")) * 1000),
}
# Cross-donor fitting does not preserve organ relationships to HRA. Publish only
# a source-isolated view, with one common translation and no scale/rotation fit.
alignment["acceptedForOverlay"] = False
alignment["reason"] = "Different donor organ layout; large rotation and 20–41 mm center discrepancies"
source_bounds = np.array([m["sourceBounds"] for m in meshes.values()])
source_center = (source_bounds[:, 0].min(axis=0) + source_bounds[:, 1].max(axis=0)) / 2
stage_translation = np.array([0, 1.05, 0]) - source_center
definitions = [
    ("stomach", "Stomach", "위", "digestive", "stomach"),
    ("esophagus", "Esophagus (CT field of view)", "식도 (CT 수록 구간)", "digestive", "esophagus-ct"),
    ("adrenal_gland_left", "Left adrenal gland", "왼쪽 부신", "urinary", "adrenal"),
    ("adrenal_gland_right", "Right adrenal gland", "오른쪽 부신", "urinary", "adrenal"),
    ("autochthon_left", "Left autochthonous back musculature (CT field of view)", "왼쪽 등 고유근육군 (CT 수록 구간)", "muscular", "back-muscles-ct"),
    ("autochthon_right", "Right autochthonous back musculature (CT field of view)", "오른쪽 등 고유근육군 (CT 수록 구간)", "muscular", "back-muscles-ct"),
    ("liver", "Liver", "간", "digestive", "abdomen-ct"),
    ("spleen", "Spleen", "비장", "lymphatic", "abdomen-ct"),
    ("kidney_left", "Left kidney", "왼쪽 콩팥", "urinary", "abdomen-ct"),
    ("kidney_right", "Right kidney", "오른쪽 콩팥", "urinary", "abdomen-ct"),
    ("pancreas", "Pancreas", "췌장", "digestive", "abdomen-ct"),
]
binary = bytearray()


def append(array):
    position = len(binary)
    binary.extend(array.tobytes())
    binary.extend(b"\0" * ((-len(binary)) % 4))
    return position


parts = []
for mask, name, label, system, group in definitions:
    mesh = meshes[mask]
    points = (mesh["vertices"] + stage_translation).astype("<f4")
    faces = mesh["faces"].astype("<u4")
    triangles = points[faces]
    # Enforce outward winding once; normals are calculated from final triangles.
    signed_volume = np.sum(triangles[:, 0] * np.cross(triangles[:, 1], triangles[:, 2])) / 6
    if signed_volume < 0:
        faces = faces[:, [0, 2, 1]].copy()
    triangles = points[faces]
    face_normals = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    normals = np.zeros_like(points)
    for corner in range(3):
        np.add.at(normals, faces[:, corner], face_normals)
    normals /= np.maximum(np.linalg.norm(normals, axis=1)[:, None], 1e-20)
    part = {"id": f"CTF_{mask}", "name": name, "label": label, "system": system, "group": group,
        "conceptId": f"CTF:{mask}", "sourceMask": mask, "chunk": 0, "vertexCount": len(points), "indexCount": faces.size,
        "positions": append(points), "normals": append(np.round(normals * 32767).astype("<i2")), "indices": append(faces),
        "bounds": [points.min(axis=0).tolist(), points.max(axis=0).tolist()],
        "scanBoundary": mesh["scanBoundary"], "voxelSpacingMm": mesh["voxelSpacingMm"], "voxels": mesh["voxels"]}
    parts.append(part)

compressed = gzip.compress(bytes(binary), compresslevel=9, mtime=0)
(OUTPUT / "ct-supplement.bin.gz").write_bytes(compressed)
candidate = {"parts": parts, "chunks": [{"url": "/models/female-detail/ct-supplement.bin", "gzip": "/models/female-detail/ct-supplement.bin.gz", "bytes": len(binary), "gzipBytes": len(compressed)}],
    "alignment": alignment, "source": source, "stageTranslationMeters": stage_translation.tolist(),
    "coordinatePolicy": "Independent female CT detail scene; RAS mm converted to left/superior/anterior meters, one common translation, no HRA registration"}
(OUTPUT / "candidate.json").write_text(json.dumps(candidate, indent=2) + "\n")
print(json.dumps({"alignment": alignment, "parts": [{k: p[k] for k in ["id", "vertexCount", "bounds", "scanBoundary"]} for p in parts], "gzipBytes": len(compressed)}, indent=2))
