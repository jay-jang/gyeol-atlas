All six Korean texts match the standard locations. I judge **SP3, SP4, SP8 and LR13 wrong**, and **SP21 and BL20 acceptable**.

Sources: [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf), [KMCRIC LR13](https://www.kmcric.com/database/acupoint/LR/LR13). WHO’s full PDF returned HTTP 403; its indexed location passages were available. Suggested positions are approximate right-side targets, checked against the supplied landmarks and matching GLB geometry. No files were edited.

```json
{
  "zangfu": "SP",
  "points": [
    {
      "id": "SP3",
      "whoLocation": "WHO p.71: Medial foot, in the depression immediately proximal to the first metatarsophalangeal joint, at the red–white skin boundary.",
      "textMatches": true,
      "textNote": "The Korean text specifies the correct joint, proximal side and skin boundary.",
      "verdict": "wrong",
      "error": "Approximately 45 mm too distal, toward the great toe. The marker is distal to the entire first metatarsal rather than proximal to its head.",
      "suggested": [-0.05, 0.022, 0.07],
      "basis": "Current right marker [-0.0653,0.0181,0.1151]. FMA24507 first metatarsal has anterior extreme [-0.0706,0.0244,0.0830] and medial head-region extreme [-0.0629,0.0204,0.0753]. Thus even the bone's most distal point is 32.1 mm proximal to the marker. The skin/muscle/bone images place the dot beside the great-toe region. Proposed z=0.070 puts it just proximal to the metatarsal head; the matching skin GLB intersects the medial surface near x=-0.0529 at y=0.022,z=0.070, allowing approximately 3 mm marker clearance."
    },
    {
      "id": "SP4",
      "whoLocation": "WHO p.71: Medial foot, anteroinferior to the first metatarsal base, at the red–white skin boundary.",
      "textMatches": true,
      "textNote": "The Korean text agrees on the base, anteroinferior direction and skin boundary.",
      "verdict": "wrong",
      "error": "Approximately 60 mm too distal. It lies beyond the first metatarsal head instead of beside the base.",
      "suggested": [-0.0455, 0.032, 0.035],
      "basis": "Current right marker [-0.0698,0.0316,0.0948]. FMA24507 proximal/base region includes posterior extreme [-0.0807,0.0397,0.0215] and dorsal extreme [-0.0789,0.0579,0.0331]; its distal extreme is z=0.0830. Current z=0.0948 is therefore distal even to the head. Proposed y=0.032,z=0.035 is anterior and inferior to the base. The matching skin GLB gives medial surface x approximately -0.0485 there, with approximately 3 mm medial marker clearance."
    },
    {
      "id": "SP8",
      "whoLocation": "WHO p.73: Tibial side of the leg, behind the medial tibial border, 3 B-cun inferior to SP9.",
      "textMatches": true,
      "textNote": "The Korean text agrees on the posterior side of the medial tibial border and the 3-cun distance below SP9.",
      "verdict": "wrong",
      "error": "The height is approximately correct, but the marker is anterior to the required border. Relative to the proposed surface target, it is about 33 mm too anterior and 40 mm too lateral; combined displacement is approximately 52 mm, or about 2 lower-leg B-cun.",
      "suggested": [-0.0326, 0.317, -0.032],
      "basis": "Current right marker [-0.0721,0.3170,0.0010]; SP9 y=0.3920 gives a 75 mm separation, consistent with approximately 3 B-cun. FMA24477 has proximal medial extreme [-0.0390,0.4043,-0.0357] and distal inferior extreme [-0.0562,0.0733,-0.0322], supporting a lower-leg scale around 24–25 mm per cun. Its matching GLB cross-section at y=0.317 has medial extreme [-0.0687,0.317,-0.0222] and posterior extreme [-0.0816,0.317,-0.0338]. Current z=+0.001 is anterior to that medial border. Proposed z=-0.032 is behind it; the medial skin surface there is x approximately -0.0356, with 3 mm medial marker clearance."
    },
    {
      "id": "SP21",
      "whoLocation": "WHO p.80: Lateral thorax, at the sixth intercostal space on the midaxillary line.",
      "textMatches": true,
      "textNote": "The Korean text specifies the correct intercostal space and axillary line.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Current right marker [-0.1569,1.1880,0.0118], with supplied skin surface [-0.1539,1.1880,0.0118], is on the lateral thoracic surface. FMA8175 rib 6 lateral extreme is [-0.1350,1.2162,0.0038]; FMA8229 rib 7 lateral extreme is [-0.1377,1.1785,0.0150]. Their lateral levels bracket an approximate sixth-space target around y=1.197–1.200. The marker is near its inferior margin, approximately 9–12 mm below the estimated centre, within about 0.5 trunk B-cun. The anterior arcs at x=-0.13 have different heights and z values and should not be substituted directly for the midaxillary level."
    },
    {
      "id": "BL20",
      "whoLocation": "WHO p.109: Upper back, level with the inferior border of the T11 spinous process, 1.5 B-cun lateral to the posterior midline.",
      "textMatches": true,
      "textNote": "The Korean text agrees on T11, the spinous inferior border and the 1.5-cun lateral distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Current right marker [-0.0378,1.1058,-0.1060]. FMA10059 T11 spinousLowerBorderY=1.1059, a height difference of only -0.0001 m. Adjacent lower borders are T10=1.1313 and T12=1.0769, confirming the correct vertebral level. Supplemental read-only GLB inspection gives right scapular medial border approximately [-0.0741,1.2409,-0.1063] near its inferior region: half this midline distance is approximately 0.0371 m, consistent with the marker's 0.0378 m lateral distance. Nearby BL49 [-0.0750,1.1060,-0.1068] corroborates the first/second-line spacing but was not used as independent anatomical proof."
    },
    {
      "id": "LR13",
      "whoLocation": "WHO p.202: Lateral abdomen, immediately inferior to the free end of the eleventh rib.",
      "textMatches": true,
      "textNote": "The Korean text identifies the correct rib and the inferior side of its free end.",
      "verdict": "wrong",
      "error": "Approximately 53 mm superior to the inferior edge of the eleventh-rib free end. It needs approximately 58 mm downward movement to sit just below that end, about 2.4 anterior-trunk B-cun.",
      "suggested": [-0.1456, 1.021, 0.004],
      "basis": "Current right marker [-0.1474,1.0790,0.0060]. FMA8531 rib 11 anterior/free-end region includes [-0.1119,1.0305,0.0042] and inferior extreme [-0.1099,1.0258,-0.0009]. The marker is 0.0532 m above the latter, rather than below it. Rib 12, FMA8533, is distinct and ends posteriorly around [-0.0794,1.0234,-0.0357]. Proposed y=1.021 is about 5 mm below the eleventh-rib end; its z follows that end. Matching skin GLB surface at y=1.021,z=0.004 is x approximately -0.1426, giving marker x=-0.1456 with 3 mm lateral clearance. Trunk scale from sternal-body inferior y=1.2006 to CV8 y=1.0050 is 0.1956/8=0.02445 m per B-cun."
    }
  ]
}
```