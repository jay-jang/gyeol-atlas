# Position cross-check: zang-fu special points (원·모·유·극·락혈) on the GYEOL male model

You are one of two independent reviewers (another model checks the same points separately). Judge each point on its own evidence; do not guess what the other reviewer says.

## What is being checked

GYEOL is an educational 3D acupoint atlas. Each point has a hand-authored marker on a single male BodyParts3D body ("학습용 근사", not a clinical location). For the points listed in your input file, check:

1. **Standard location.** State the WHO Standard Acupuncture Point Locations in the Western Pacific Region (2008) location for the point (the `whoStandardPage` field is the WHO book page). Use your knowledge and, if you have web access, check it.
2. **Text.** Does the Korean KMCRIC location text (`kmcricLocation`) say the same as WHO? Flag real differences (wrong landmark, wrong distance in cun, wrong side of a tendon), not wording.
3. **Marker placement.** Is the 3D marker where that standard location would be on this body? Use:
   - the three close-ups per point (`images`): skin, muscle (skin peeled) and bone depth. The selected point has the large gold dot and a gold-bordered name label; the other dots and labels are the same meridian. Markers stay on the skin surface at every depth, so on the muscle and bone images they float above the tissue where the skin was.
   - the numbers in `landmarks.json` (same coordinate frame as `markers`): bone extreme points, vertebral spinous tips and their lower borders, the anterior arc of each right rib, and every marker of the model (right side and midline).

Coordinate frame: metres, +y up, +z anterior (front), the body's right side is −x. The markers in the point file include both sides; landmark data is for the right side.

Proportional cun (B-cun) you may need on this body:
- Anterior trunk: xiphisternal junction (lower end of the sternal body) to the umbilicus = 8 cun; umbilicus to the upper border of the pubic symphysis = 5 cun. The model's umbilicus is the CV8 marker. The distance between the nipples (ST17) = 8 cun; the anterior midline to the nipple line = 4 cun.
- Back: posterior midline to the medial border of the scapula = 3 cun, so the first bladder line is 1.5 cun lateral and the second line 3 cun lateral to the posterior midline (spinous process level is read from the vertebra's spinous lower border).
- Upper limb: anterior axillary fold to the cubital crease = 9 cun; cubital crease to the wrist crease = 12 cun.
- Lower limb: lateral: popliteal crease to the prominence of the lateral malleolus = 16 cun; medial: lower border of the medial tibial condyle to the prominence of the medial malleolus = 13 cun; the patella base to the anterior superior iliac spine = 18 cun is not needed here.
- Rib counting: intercostal spaces lie between consecutive ribs' anterior arcs; the 11th and 12th ribs are floating ribs whose free ends are lateral/posterolateral.

## Verdict per point

- `ok`: the marker is at the standard location within about 0.5 cun or within the precision an educational surface marker can show, on the correct side of the named tendons/bones.
- `minor`: same anatomical spot but noticeably off (about 0.5–1 cun, or slightly mis-levelled), still recognisable as the point.
- `wrong`: the wrong landmark, level, intercostal space, vertebra or side of a tendon, or more than about 1 cun off.
- `unclear`: the evidence cannot decide; say what is missing.

For `minor` and `wrong`, give the direction and size of the error and a corrected right-side position `[x, y, z]` in the model frame with the landmarks you derived it from (the y-level and the distance from the midline matter most; z can follow the skin).

Do not edit any file. Do not treat traditional correspondences as anatomy. Be concrete: cite the landmark numbers you used.
