**I independently confirm the navel offset: CV8 is approximately 14.6 mm too high.** The other abdominal CV errors vary; they are not a uniform 15 mm translation. No files were modified.

1. **Umbilicus: approximately `[0.0003, 0.9904, 0.1063]` metres.**

   I inspected FMA7163’s triangle geometry and ray-cast from anterior (+z), taking the **first surface intersection**. The deepest vertex of the visible navel pit is:

   `[0.0002859, 0.9903745, 0.1063403]`

   Surrounding triangles form the depression around it. This distinguishes the visible pit from deeper intersections near z = 0.0951 and 0.0830. At x = 0, the skin at this height is z ≈ 0.1064; at the current CV8 height, y = 1.0050, it is z ≈ 0.1129.

   I use y = **0.9904** as the practical pit-centre estimate, with roughly 1 mm uncertainty in interpreting its centre.

2. **Bone landmarks:**

   | Landmark | Adopted y (m) | Geometry supporting it |
   |---|---:|---|
   | Xiphisternal junction | **1.2030** | Near-midline sternal-body inferior edge and xiphoid superior interface lie around 1.2025–1.2046 |
   | Pubic symphysis upper border | **0.8273** | Medial superior pubic edges reach approximately 0.8268 right and 0.8279 left; adopted value averages them |

   These are approximate landmark estimates, with about 1–2 mm uncertainty. The xiphoid **tip**, around y = 1.1825, is a different landmark.

3. Using those anchors, the vertical scales are:

   - Above the umbilicus: `(1.2030 − 0.9904) / 8` = **26.575 mm/B-cun**.
   - Below it: `(0.9904 − 0.8273) / 5` = **32.620 mm/B-cun**.

   These follow the requested [WHO 2008 proportions, printed p. 12](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1). Expected heights below are linear **y-coordinate** interpolations; their decimal precision represents arithmetic, not anatomical certainty.

   **Error = current − expected; positive means too high.**

   | Point | Current y (m) | Expected y (m) | Error (mm) | Error (B-cun) |
   |---|---:|---:|---:|---:|
   | CV2 | 0.8479 | 0.827300 | +20.6 | +0.632 |
   | CV3 | 0.8749 | 0.859920 | +15.0 | +0.459 |
   | CV4 | 0.9070 | 0.892540 | +14.5 | +0.443 |
   | CV5 | 0.9400 | 0.925160 | +14.8 | +0.455 |
   | CV6 | 0.9580 | 0.941470 | +16.5 | +0.507 |
   | CV7 | 0.9760 | 0.957780 | +18.2 | +0.559 |
   | CV8 | 1.0050 | 0.990400 | +14.6 | +0.549* |
   | CV9 | 1.0299 | 1.016975 | +12.9 | +0.486 |
   | CV10 | 1.0560 | 1.043550 | +12.5 | +0.468 |
   | CV11 | 1.0830 | 1.070125 | +12.9 | +0.484 |
   | CV12 | 1.1103 | 1.096700 | +13.6 | +0.512 |
   | CV13 | 1.1350 | 1.123275 | +11.7 | +0.441 |
   | CV14 | 1.1601 | 1.149850 | +10.3 | +0.386 |
   | CV15 | 1.1882 | 1.176425 | +11.8 | +0.443 |
   | CV16 | 1.2141 | 1.203000 | +11.1 | +0.418 |

   Cun errors use the corresponding upper/lower segment. *CV8 uses the upper scale; its error is **0.448 lower-abdominal B-cun**.*

4. **The three-landmark calibration is sensible, but blindly remapping the supplied current heights is not a sound complete correction.**

   It preserves existing spacing errors. For example:

   | Point | Proposed remap gives y | Required y | Remaining error |
   |---|---:|---:|---:|
   | CV3 | 0.855331 | 0.859920 | −4.6 mm |
   | KI17 | 1.050489 | 1.043550 | +6.9 mm |
   | ST25 | 0.973789 | 0.990400 | −16.6 mm |

   **ST25 is already at y = 0.9890 in the supplied JSON**, whereas CV8, KI16, SP15 and GB26 remain at 1.0050. That mixed state alone prevents applying one warp to every current marker.

   Recompute heights from each point’s prescribed cun offset using the corrected anchors: **CV2–CV16, KI11–KI21, ST19–ST30, SP13–SP16, GB26 and GB27**. Then reproject onto the appropriate skin surface and validate lateral landmark relationships.

   Two exceptions within the abdominal/groin group require independent landmark placement:

   - **SP12:** inguinal crease, lateral to the femoral artery. Its CV2-level note is a consistency check; locate the crease and artery independently. [SP12 definition](https://www.kmcric.com/database/acupoint/SP/SP12).
   - **GB28:** 0.5 B-cun medioinferior to the **ASIS**. Its relationship to GB27 does not justify moving an anatomically anchored point using the old CV heights. [WHO, printed p. 185](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf).

   GB26 retains an umbilicus-level height despite its rib reference; GB27 explicitly uses 3 B-cun below the umbilicus while also requiring the ASIS relationship. Keep rib/intercostal points outside this abdominal operation—such as ST18, KI22–KI27, SP17–SP21 and GB24–GB25. ST30’s height can follow the symphysis top, with its femoral-artery relationship checked separately. [ST30 definition](https://www.kmcric.com/database/acupoint/ST/ST30).

Read-only inspection used `/Users/nuinuri/workspace/anatomy-worktrees/acupoint-key-filter`, branch `feat/acupoint-key-filter`.

```json
{
  "umbilicus": [0.0003, 0.9904, 0.1063],
  "xiphisternal": 1.203,
  "symphysisTop": 0.8273,
  "expected": {
    "CV2": 0.8273,
    "CV3": 0.85992,
    "CV4": 0.89254,
    "CV5": 0.92516,
    "CV6": 0.94147,
    "CV7": 0.95778,
    "CV8": 0.9904,
    "CV9": 1.016975,
    "CV10": 1.04355,
    "CV11": 1.070125,
    "CV12": 1.0967,
    "CV13": 1.123275,
    "CV14": 1.14985,
    "CV15": 1.176425,
    "CV16": 1.203
  },
  "remapSound": false,
  "exclude": ["SP12", "GB28"],
  "notes": "False for a blanket warp of the supplied current heights: spacing is inconsistent and ST25 is already at y=0.9890. Recompute eligible abdominal points from prescribed cun offsets using the corrected anchors, then reproject onto skin. SP12 requires inguinal-crease/artery placement; GB28 requires ASIS placement. Thoracic and rib-based points outside the abdominal group must remain outside this operation. Bone anchors have approximately 1–2 mm uncertainty; tabulated precision is arithmetic. No files modified."
}
```