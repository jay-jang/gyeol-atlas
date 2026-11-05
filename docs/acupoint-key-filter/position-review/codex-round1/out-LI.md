All five Korean descriptions match WHO. I judge all five markers **ok** at the requested educational tolerance. BL25’s lateral spacing has weaker evidence because the supplied landmarks omit the scapular medial border.

WHO locations were checked against indexed book text: printed pages 35–37 and 112 in the [WHO publication](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf), and page 58 in a [copy of the WHO book](https://www.medbox.org/index.php/dl/627a4de115110145a1723f64). No files were edited.

```json
{
  "zangfu": "LI",
  "points": [
    {
      "id": "LI4",
      "whoLocation": "Dorsal hand, immediately radial to the halfway point of the second metacarpal (WHO p.35).",
      "textMatches": true,
      "textNote": "Matches the named bone, midpoint and radial side.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.2818,0.7782,0.0134]. Second metacarpal FMA24466 extends from y=0.7426 to 0.8108; its approximate longitudinal midpoint is y=0.7767, only 1.5 mm distal to the marker. The corresponding left bone FMA24467 has the same y-range; the left marker is y=0.7777. Across the skin, muscle and bone images, the selected dot is in the dorsal thumb-side region at mid-metacarpal height, rather than at the proximal metacarpal bases. The supplied extremes do not resolve the shaft's precise radial border, but reveal no displacement exceeding the educational tolerance."
    },
    {
      "id": "LI6",
      "whoLocation": "Posterolateral forearm, following LI5–LI11, three B-cun proximally from the dorsal wrist fold (WHO p.36).",
      "textMatches": true,
      "textNote": "Matches the forearm aspect, reference line and 3 B-cun distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "LI5=[-0.2803,0.8280,0.0051]; LI11=[-0.2448,1.0709,0.0001]. Their vertical span is 0.2429 m, or approximately 20.24 mm per B-cun. The 3/12 height is y=0.888725; the right marker y=0.8903 is 1.58 mm proximal, approximately 0.08 B-cun. Left y=0.8901 is similarly aligned. Radius FMA23464 has its distal extreme at y=0.8296, supporting the wrist reference. The three images place the marker on the radial/posterolateral forearm. Its x is about 5 mm radial to the endpoint chord; that small difference and the curved skin surface do not establish a meaningful placement error."
    },
    {
      "id": "LI7",
      "whoLocation": "Posterolateral forearm, following LI5–LI11, five B-cun proximally from the dorsal wrist fold (WHO p.37).",
      "textMatches": true,
      "textNote": "Matches the forearm aspect, reference line and 5 B-cun distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Using LI5 y=0.8280 and LI11 y=1.0709, the 5/12 height is y=0.929208. Both markers have y=0.9310: 1.79 mm proximal, approximately 0.09 B-cun. Right x=-0.2700 is about 4.5 mm radial to the endpoint chord at that fraction. Skin, muscle and bone views show the selected dot on the thumb-side/posterolateral forearm at the expected level. The right z=-0.0153 cannot be compared directly with the straight chord's z as a surface-location error: the chord does not follow the forearm contour. No wrong-side landmark relationship is demonstrated."
    },
    {
      "id": "ST25",
      "whoLocation": "Abdominal surface at umbilical height, two B-cun to either side of its centre (WHO p.58).",
      "textMatches": true,
      "textNote": "Matches WHO, including its upper-abdomen wording and 2 B-cun lateral distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "CV8=[0,1.0050,0.1159]; both ST25 markers have y=1.0050, exactly matching the supplied umbilical level. Right ST17 x=-0.0900 represents 4 B-cun, giving 22.5 mm per transverse B-cun and an expected ST25 x=-0.0450. Actual x=-0.0500 is 5 mm farther lateral, approximately 0.22 B-cun; the left marker is symmetrically placed. All three images show the pair flanking the umbilical region at the same height. This is within the stated tolerance."
    },
    {
      "id": "BL25",
      "whoLocation": "Lumbar back, level with the bottom edge of L4's spinous process, 1.5 B-cun lateral to the posterior midline (WHO p.112).",
      "textMatches": true,
      "textNote": "Matches L4, its spinous inferior border and the 1.5 B-cun lateral offset.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "L4 FMA13075 has spinousLowerBorderY=0.9656 and spinousTip=[-0.0008,0.9712,-0.0627]. Both BL25 markers have y=0.9630, only 2.6 mm below the required border, with x=±0.0380. This remains clearly distinct from L3's lower border y=0.9888 and L5's y=0.9442. GV3=[0.0008,0.9634,-0.0939] corroborates the displayed midline level. Nearby first-line BL23/BL24 use x=-0.0380; outer-line BL42/BL43 use approximately -0.0750, making the 38 mm offset internally consistent with half the nominal 3-cun line. The images support the lumbar paraspinal placement. Scapular medial-border coordinates are absent, so that lateral calibration is a consistency check rather than independent bone-based verification."
    }
  ]
}
```