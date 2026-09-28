"""Synthetic checks for the TCIA head-label spatial audit."""

import importlib.util
from pathlib import Path

import numpy as np


path = Path(__file__).resolve().parents[1] / "scripts/audit-tcia-head-spatial.py"
spec = importlib.util.spec_from_file_location("tcia_head_spatial", path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)

volume = np.zeros((11, 11, 11), dtype=np.uint8)
volume[3:8, 3:8, 3:8] = 26
volume[4:7, 4:7, 4:7] = 4
closed = audit.spatial_metrics(volume, [2.0, 1.0, 1.0])
assert closed["brain"]["voxels"] == 27
assert closed["brainSkull"]["sharedLabeledVoxels"] == 0
assert closed["brainSkull"]["sharedVoxelFaceContactsByAxis"] == {"z": 18, "y": 18, "x": 18}
assert closed["brainSkull"]["brainVoxelsConnectedToCropExteriorThroughNonSkull"] == 0
assert closed["brainSkull"]["brainSurfaceToSkullCenterDistanceMm"]["min"] == 1
assert closed["brainSkull"]["distanceTransformVsKdTreeMaxDifferenceMm"] == 0
assert closed["skull"]["surface"]["boundaryEdges"] == 0

volume[3, 5, 5] = 0
opened = audit.spatial_metrics(volume, [2.0, 1.0, 1.0])
assert opened["brainSkull"]["brainVoxelsConnectedToCropExteriorThroughNonSkull"] == 27
assert opened["brainSkull"]["brainFractionConnectedToCropExteriorThroughNonSkull"] == 1
assert opened["brainSkull"]["sharedVoxelFaceContactsByAxis"]["z"] == 17

print("TCIA head synthetic closed/open shell, face contact, and independent distance checks passed.")
