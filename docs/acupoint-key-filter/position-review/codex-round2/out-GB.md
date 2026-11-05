Locations checked against the [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1), printed pages 183, 189–191. Coordinates below are metres; suggested corrections are null where the new marker passes.

```json
{
  "zangfu": "GB",
  "points": [
    {
      "id": "GB24",
      "whoLocation": "Anterior thorax, seventh intercostal space, 4 B-cun lateral to the anterior midline, below the nipple.",
      "textMatches": true,
      "textNote": "The Korean text agrees with WHO on the intercostal space and lateral distance.",
      "verdict": "ok",
      "error": "No displacement exceeding the educational tolerance demonstrated.",
      "suggested": null,
      "basis": "New right marker [-0.09, 1.122, 0.1127] lies directly below ST17 [-0.09, 1.235, 0.124]. Thus its lateral distance is exactly 4 B-cun using the supplied nipple-line scale: 0.09/4 = 0.0225 m/cun. The bone image supports the seventh intercostal gap. Nearby anterior portions of rib 7 (FMA8229) have y=1.1347–1.1487, and rib 8 (FMA8283) y=1.0998–1.1136; y=1.122 is consistent with the intervening gap. These samples are near x=-0.11, so they support rather than precisely locate the gap at x=-0.09. The purported anteriorArc samples at x=-0.09 have negative z (-0.075 and -0.0702), identifying posterior rib portions; their heights must not be used as anterior chest levels.",
      "neighbours": "In order: GB23 y=1.221 > GB24 y=1.122 > GB25 y=1.020. No overlap with these unchanged neighbours."
    },
    {
      "id": "GB36",
      "whoLocation": "Fibular side of the leg, anterior to the fibula, 7 B-cun proximal to the lateral malleolar prominence; anterior to GB35 at the same level.",
      "textMatches": true,
      "textNote": "The Korean text agrees with WHO on the anterior side of the fibula and the 7-cun distance.",
      "verdict": "ok",
      "error": "Any residual height error is below approximately 0.5 cun.",
      "suggested": null,
      "basis": "New right marker [-0.1352, 0.226, -0.03] occupies the lateral surface anterior to the fibular shaft in the muscle/bone views. BL39 supplies the lateral popliteal-crease proxy at y=0.4313. FMA24480 has distal tip [-0.1057, 0.0539, -0.0491] and distal contour samples at y=0.0757 and 0.0793; the actual malleolar prominence is not separately labelled. Even bracketing the ankle reference broadly between y=0.0539 and 0.0793 gives a 7-cun target y=0.2190–0.2333. The marker y=0.226 falls inside that interval. GB36–GB37 vertical separation is 0.045 m, approximately the required 2 cun.",
      "neighbours": "Unchanged GB35 [-0.1382, 0.244, -0.029] is 18 mm proximal to GB36, approximately 0.8 cun, instead of sharing its level. GB35 is also 1 mm anterior in z rather than posterior, so the required anterior/posterior pair is not represented correctly. GB36 remains appropriately below GB34 y=0.390 and above GB37 y=0.181."
    },
    {
      "id": "GB37",
      "whoLocation": "Fibular side of the leg, anterior to the fibula, 5 B-cun proximal to the lateral malleolar prominence.",
      "textMatches": true,
      "textNote": "The Korean text agrees with WHO; its explicit 16-cun popliteal-crease-to-malleolus scale is consistent.",
      "verdict": "ok",
      "error": "Any residual height error is below approximately 0.5 cun.",
      "suggested": null,
      "basis": "New right marker [-0.1255, 0.181, -0.03] remains on the lateral surface anterior to the fibula in the depth views. Using BL39 y=0.4313 and the distal fibular reference bracket y=0.0539–0.0793 from FMA24480 gives a 5-cun target y=0.1718–0.1893. The marker y=0.181 lies within that interval. Using the distal contour level y=0.0757 yields 1 cun=0.022225 m and target y=0.186825, only 5.8 mm proximal to the marker, approximately 0.26 cun.",
      "neighbours": "Order problem: unchanged GB38 [-0.1156, 0.1904, -0.0134] is 9.4 mm proximal to GB37, although its 4-cun location should be approximately 22 mm distal. Unchanged GB39 [-0.11, 0.1658, -0.0161] is distal, but only 15.2 mm below GB37 rather than approximately 44 mm for their 2-cun difference. GB36 remains 45 mm proximal, giving appropriate GB36–GB37 spacing."
    },
    {
      "id": "GB40",
      "whoLocation": "Anterolateral ankle, in the depression lateral to the extensor digitorum longus tendon, anterior and distal to the lateral malleolus.",
      "textMatches": true,
      "textNote": "The Korean text agrees with WHO on the tendon side and anterior-distal relationship to the malleolus.",
      "verdict": "ok",
      "error": "No clear displacement beyond educational tolerance; the marker is appropriately anterior to the malleolus and lateral to the visible extensor tendons.",
      "suggested": null,
      "basis": "New right marker [-0.1103, 0.055, -0.027] lies in the anterolateral ankle hollow in the skin and muscle views. Relative to the FMA24480 distal tip [-0.1057, 0.0539, -0.0491], it is 22.1 mm anterior and 4.6 mm lateral. Its y=0.055 is below the distal malleolar contour samples y=0.0757–0.0793. The lowest fibular tip is not the prominence, so the marker being 1.1 mm above that tip does not contradict the required distal relationship. The muscle view places the marker lateral to the extensor tendon group.",
      "neighbours": "GB40 is proximal to unchanged GB41 [-0.1189, 0.0315, 0.0792], so their order is correct. Spacing remains suspect because GB41 lies near the metatarsal heads: its z=0.0792 is beyond the fourth/fifth metatarsal anterior extrema z=0.0713/0.0592, whereas their proximal landmarks are around z=0.0049/-0.0122. GB40–GB41 separation is 109.1 mm. Additional cross-channel overlap: unchanged BL62 [-0.1105, 0.0538, -0.025] is only 2.34 mm from GB40; these markers are effectively coincident."
    }
  ]
}
```