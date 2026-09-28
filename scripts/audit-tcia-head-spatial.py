"""Audit one TCIA female brain/skull pair in its own segmentation frame.

Only the public automatic segmentation is read. No controlled CT, HRA fit,
mesh replacement, or clinical accuracy claim is made here.
"""

import argparse
import gzip
import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from scipy.spatial import cKDTree
from skimage.measure import marching_cubes


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_head(archive, member, source_case):
    bounds = source_case["focusBoundsGridInclusive"]
    head_bounds = [bounds[key] for key in ["4", "26"]]
    shape_xyz = source_case["shapeXyz"]
    low = [max(0, min(box[0][axis] for box in head_bounds) - 12) for axis in range(3)]
    high = [min(shape_xyz[axis], max(box[1][axis] for box in head_bounds) + 13) for axis in range(3)]
    assert all(high[axis] > low[axis] for axis in range(3))
    # Cropped array order is Z,Y,X; the published affine is in X,Y,Z order.
    volume = np.empty((high[2]-low[2], high[1]-low[1], high[0]-low[0]), dtype=np.uint8)
    with archive.open(member) as compressed, gzip.GzipFile(fileobj=compressed) as source:
        header = source.read(352)
        assert len(header) == 352 and struct.unpack_from("<i", header)[0] == 348
        dims = struct.unpack_from("<8h", header, 40)[1:4]
        datatype, bitpix = struct.unpack_from("<hh", header, 70)
        spacing = struct.unpack_from("<8f", header, 76)[1:4]
        offset = int(struct.unpack_from("<f", header, 108)[0])
        assert list(dims) == shape_xyz and (datatype, bitpix) == (16, 32)
        np.testing.assert_allclose(spacing, source_case["spacingMmXyz"], atol=1e-6, rtol=0)
        assert offset >= 352 and offset < 4096
        assert len(source.read(offset-352)) == offset-352
        plane_bytes = dims[0]*dims[1]*4
        for z in range(dims[2]):
            raw = source.read(plane_bytes)
            assert len(raw) == plane_bytes, z
            if low[2] <= z < high[2]:
                plane = np.frombuffer(raw, dtype="<f4").reshape(dims[1], dims[0])
                section = plane[low[1]:high[1], low[0]:high[0]]
                assert np.all(np.isfinite(section)) and np.all(section == np.floor(section))
                assert np.all((section >= 0) & (section <= 36))
                volume[z-low[2]] = section.astype(np.uint8)
        assert source.read(1) == b""
    for label in [4, 26]:
        assert int(np.count_nonzero(volume == label)) == source_case["positiveLabelCounts"][str(label)]
    return volume, low, high


def surface_stats(mask, spacing_zyx):
    assert mask.any() and not any(np.any(face) for axis in range(3) for face in
                                  [np.take(mask, 0, axis=axis), np.take(mask, -1, axis=axis)])
    vertices, faces, _, _ = marching_cubes(np.pad(mask, 1), .5, spacing=spacing_zyx,
                                            allow_degenerate=False)
    # Padding does not create caps here: neither label touches the crop edge.
    edges = np.sort(np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]]), axis=1)
    _, frequency = np.unique(edges, axis=0, return_counts=True)
    return {
        "vertices": int(len(vertices)), "triangles": int(len(faces)),
        "boundaryEdges": int(np.count_nonzero(frequency == 1)),
        "nonManifoldEdges": int(np.count_nonzero(frequency > 2)),
        "sourceCropTouchesBoundary": False,
    }


def spatial_metrics(volume, spacing_zyx):
    brain, skull = volume == 4, volume == 26
    structure = ndi.generate_binary_structure(3, 1)
    counts = {}
    for name, mask in [("brain", brain), ("skull", skull)]:
        labeled, components = ndi.label(mask, structure=structure)
        component_counts = np.bincount(labeled[mask], minlength=components+1)[1:]
        counts[name] = {"voxels": int(mask.sum()), "components6": int(components),
                        "componentVoxelCountsDescending": sorted((int(n) for n in component_counts), reverse=True),
                        "surface": surface_stats(mask, spacing_zyx)}
    brain_surface = brain & ~ndi.binary_erosion(brain, structure=structure)
    skull_distance = ndi.distance_transform_edt(~skull, sampling=spacing_zyx)
    distance = skull_distance[brain_surface]
    assert len(distance) and np.all(distance > 0)
    brain_points = np.argwhere(brain_surface).astype(np.float64)*spacing_zyx
    skull_points = np.argwhere(skull).astype(np.float64)*spacing_zyx
    independent_distance = cKDTree(skull_points).query(brain_points, workers=-1)[0]
    difference = float(np.max(np.abs(distance-independent_distance)))
    assert difference < 1e-9, difference
    exterior_seed = np.zeros_like(skull)
    for axis in range(3):
        for index in [0, -1]:
            face = [slice(None)]*3
            face[axis] = index
            exterior_seed[tuple(face)] = ~skull[tuple(face)]
    exterior = ndi.binary_propagation(exterior_seed, structure=structure, mask=~skull)
    reachable_brain = int(np.count_nonzero(brain & exterior))
    face_contacts = {}
    for axis, name in enumerate(["z", "y", "x"]):
        lower = [slice(None)]*3
        upper = [slice(None)]*3
        lower[axis], upper[axis] = slice(None, -1), slice(1, None)
        lower, upper = tuple(lower), tuple(upper)
        face_contacts[name] = int(np.count_nonzero(brain[lower] & skull[upper])
                                  + np.count_nonzero(skull[lower] & brain[upper]))
    counts["brainSkull"] = {
        "sharedLabeledVoxels": int(np.count_nonzero(brain & skull)),
        "sharedVoxelFaceContactsByAxis": face_contacts,
        "brainSurfaceVoxels": int(len(distance)),
        "distanceTransformVsKdTreeMaxDifferenceMm": difference,
        "brainVoxelsConnectedToCropExteriorThroughNonSkull": reachable_brain,
        "brainFractionConnectedToCropExteriorThroughNonSkull": reachable_brain/int(brain.sum()),
        "brainSurfaceToSkullCenterDistanceMm": {
            "min": float(distance.min()),
            "p5": float(np.percentile(distance, 5)),
            "median": float(np.median(distance)),
            "p95": float(np.percentile(distance, 95)),
            "max": float(distance.max()),
        },
    }
    # These are label-centre distances, not triangle clearance or cavity fit.
    return counts


def montage(volume, spacing_zyx, destination):
    brain = volume == 4
    coords = np.array(np.where(brain))
    center = np.rint(coords.mean(axis=1)).astype(int)
    sections = [
        ("AXIAL Z", volume[center[0]], spacing_zyx[1], spacing_zyx[2]),
        ("CORONAL Y", volume[:, center[1]], spacing_zyx[0], spacing_zyx[2]),
        ("SAGITTAL X", volume[:, :, center[2]], spacing_zyx[0], spacing_zyx[1]),
    ]
    nearest = Image.Resampling.NEAREST
    tiles = []
    for title, plane, row_mm, col_mm in sections:
        rgb = np.zeros((*plane.shape, 3), dtype=np.uint8)
        rgb[plane == 26] = [219, 184, 108]
        rgb[plane == 4] = [111, 184, 232]
        tile = Image.fromarray(rgb).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
        scale = min(400/(plane.shape[1]*col_mm), 390/(plane.shape[0]*row_mm))
        tile = tile.resize((max(1, round(plane.shape[1]*col_mm*scale)),
                            max(1, round(plane.shape[0]*row_mm*scale))), nearest)
        canvas = Image.new("RGB", (450, 450), "#101c25")
        canvas.paste(tile, ((450-tile.width)//2, 45+(390-tile.height)//2))
        ImageDraw.Draw(canvas).text((12, 10), title + "  brain=blue skull=ochre", fill="white")
        tiles.append(canvas)
    output = Image.new("RGB", (sum(tile.width for tile in tiles), max(tile.height for tile in tiles)), "#101c25")
    x = 0
    for tile in tiles:
        output.paste(tile, (x, 0))
        x += tile.width
    destination.parent.mkdir(parents=True, exist_ok=True)
    output.save(destination)
    return {"gridCenterZyx": center.tolist(), "sha256": sha256(destination)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("segmentation_zip", type=Path)
    parser.add_argument("--case", default="003")
    parser.add_argument("--manifest", type=Path, default=Path("docs/anatomy-alignment/tcia-v3-female-source.json"))
    parser.add_argument("--output", type=Path, default=Path("docs/anatomy-alignment/tcia-head-spatial.json"))
    parser.add_argument("--image", type=Path, default=Path("docs/anatomy-alignment/tcia-head-spatial.png"))
    args = parser.parse_args()
    manifest = json.loads(args.manifest.read_text())
    assert sha256(args.segmentation_zip) == manifest["archiveSha256"]
    assert args.case in manifest["availableFemaleCaseIds"]
    assert args.case == manifest["focusCaseId"], "Only the audited focus case has saved full head bounds"
    source_case = next(case for case in manifest["cases"] if case["caseId"] == args.case)
    with zipfile.ZipFile(args.segmentation_zip) as archive:
        member = next(name for name in archive.namelist() if re.search(
            rf"(?:^|/)Healthy-Total-Body-CTs-{args.case}\.nii\.gz$", name) and not name.startswith("__MACOSX/"))
        member_sha = hashlib.sha256(archive.read(member)).hexdigest()
        if args.case == manifest["focusCaseId"]:
            assert member_sha == manifest["focusCompressedNiftiSha256"]
        volume, low, high = read_head(archive, member, source_case)
    spacing = [source_case["spacingMmXyz"][axis] for axis in [2, 1, 0]]
    report = {
        "caseId": args.case, "sourceArchiveSha256": manifest["archiveSha256"],
        "sourceMember": member, "sourceMemberSha256": member_sha,
        "cropGridLowXyz": low, "cropGridHighExclusiveXyz": high,
        "spacingMmZyx": spacing, "sourceAffineRasMm": source_case["bestAffineRasMm"],
        "metrics": spatial_metrics(volume, spacing),
        "montage": montage(volume, spacing, args.image),
        "scope": "Same-case automatic segmentation only. Closed binary isosurfaces are a raster construction, not a sealed anatomical cranial cavity. Center distances are not triangle clearance. No controlled CT, HRA overlay, anatomy approval, or clinical clearance measurement.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"case": args.case, "crop": [low, high], "metrics": report["metrics"]}, indent=2))


if __name__ == "__main__":
    main()
