Locations below paraphrase the [WHO 2008 standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1). Coordinates are metres; placement judgments use the supplied images and landmarks, supplemented by matching bone-mesh measurements.

```json
{
  "zangfu": "SP",
  "points": [
    {
      "id": "SP3",
      "whoLocation": "Medial foot: the depression proximal to the first metatarsophalangeal joint, at the red–white skin boundary (p. 71).",
      "textMatches": true,
      "textNote": "Same landmark, proximal side of the joint, and skin boundary.",
      "verdict": "ok",
      "error": "No definite error beyond educational surface-marker precision.",
      "suggested": null,
      "basis": "Right marker [-0.0484, 0.0185, 0.064]; skin contact [-0.0514, 0.0185, 0.064]. FMA24507 first metatarsal extends anteriorly to [-0.0706, 0.0244, 0.0830]. The marker is 19 mm posterior/proximal to that distal extreme, beside the proximal margin of the metatarsal head rather than the toe tip. Skin and peeled views support the medial plantar–dorsal boundary. The medial offset from bone represents intervening surface tissue.",
      "neighbours": "SP2–SP3–SP4 are in distal-to-proximal order: z = 0.1425, 0.0640, 0.0395. However, unmoved SP2 is excessively distal: 59.5 mm anterior to the first metatarsal's distal extreme, 85.6 mm from SP3, and 6.1 mm anterior to SP1. SP2 appears near the toe tip rather than immediately distal to the first MTP joint. No marker overlap with SP3."
    },
    {
      "id": "SP4",
      "whoLocation": "Medial foot: anteroinferior to the first metatarsal base, at the red–white skin boundary; the depression is distal to the base (p. 71).",
      "textMatches": true,
      "textNote": "The Korean text specifies the same base, anteroinferior relationship, and skin boundary.",
      "verdict": "ok",
      "error": "No definite landmark or directional error.",
      "suggested": null,
      "basis": "Right marker [-0.0460, 0.0275, 0.0395]; skin contact [-0.0490, 0.0275, 0.0395]. FMA24507 proximal extreme is [-0.0807, 0.0397, 0.0215], and its proximal dorsal extreme is [-0.0789, 0.0579, 0.0331]. The marker is anterior/distal and inferior to the base, consistent with the named depression. The three views place it on the medial foot border.",
      "neighbours": "In order. SP3 is 24.5 mm farther anterior/distal and 9.0 mm lower; SP3–SP4 distance is 26.2 mm. Unmoved SP5 [-0.0608, 0.0760, 0.0130] is 26.5 mm posterior/proximal and 48.5 mm superior to SP4. No overlap."
    },
    {
      "id": "SP8",
      "whoLocation": "Tibial aspect of the leg: posterior to the tibia's medial border, 3 B-cun inferior to SP9 (p. 73).",
      "textMatches": true,
      "textNote": "Same tibial border and 3-cun distance below SP9; the added 13-cun proportional reference is compatible.",
      "verdict": "minor",
      "error": "Borderline minor inferior displacement: approximately 12–13 mm, or 0.5–0.55 B-cun, using the explicit 3-B-cun-below-SP9 rule. No clear wrong-side-of-bone error.",
      "suggested": [-0.0411, 0.321, -0.0205],
      "basis": "Right marker [-0.0411, 0.3080, -0.0205]; SP9 y = 0.3920. FMA24477 medial condylar extreme is [-0.0390, 0.4043, -0.0357], with the inferior medial region around y = 0.390. Matching bone.glb sampling places the medial malleolar prominence near [-0.04871, 0.08438, -0.03679]; the supplied minY = 0.0733 is its inferior tip, not the prominence. Thus (0.3920 - 0.08438)/13 = 0.02366 m per cun; the present 84 mm gap equals 3.55 cun, and the 3-cun target is y = 0.3210. The WHO supplementary patella-to-malleolus one-third construction gives approximately y = 0.3019 from patellar apex y = 0.4106, so this model's two constructions disagree; the minor verdict follows the principal SP9-based definition. Suggested x and z retain the current medial surface approximation.",
      "neighbours": "In order without overlap: SP7 y = 0.2380 < SP8 y = 0.3080 < SP9 y = 0.3920. The SP8–SP9 vertical spacing is approximately 3.55 cun rather than 3. Unmoved SP9 also lies 35.5 mm anterior to SP8; their y-spacing can be checked, but this does not validate SP9's own tibial-border placement."
    },
    {
      "id": "SP21",
      "whoLocation": "Lateral thorax: the sixth intercostal space on the midaxillary line (p. 80).",
      "textMatches": true,
      "textNote": "Same intercostal space and midaxillary line.",
      "verdict": "ok",
      "error": "No definite remaining intercostal-level error.",
      "suggested": null,
      "basis": "Right marker [-0.1571, 1.1995, 0.0120]; skin contact [-0.1541, 1.1995, 0.0120]. At the lateral rib extremes, FMA8175 rib 6 is [-0.1350, 1.2162, 0.0038] and FMA8229 rib 7 is [-0.1377, 1.1785, 0.0150], bracketing the marker's height. Matching mesh samples near z = 0.012 also place the marker between the inferior surface of rib 6 and superior surface of rib 7. Its lateral skin position is compatible with the midaxillary region.",
      "neighbours": "No overlap. Unmoved SP17 [-0.1444, 1.2020, 0.0472] is 35.2 mm anterior and 12.7 mm medial to SP21; centre separation is 37.5 mm. Their similar y values do not by themselves reverse intercostal order because the ribs change height around the thorax. SP18–SP20 remain progressively superior at y = 1.2368, 1.2620, 1.2901."
    },
    {
      "id": "LR13",
      "whoLocation": "Lateral abdomen: inferior to the free end of the eleventh rib (p. 202).",
      "textMatches": true,
      "textNote": "The Korean text names the same rib end and inferior relationship.",
      "verdict": "ok",
      "error": "No definite remaining rib-level error.",
      "suggested": null,
      "basis": "Right marker [-0.1459, 1.0200, 0.0030]; skin contact [-0.1429, 1.0200, 0.0030]. FMA8531 rib 11 has its anterior free-end region at [-0.1119, 1.0305, 0.0042] and inferior extreme at [-0.1099, 1.0258, -0.0009]. The marker is 5.8 mm below the inferior extreme and has a closely matching anteroposterior position. Its more lateral x follows the skin surface. Rib 12's free end is distinctly posterior, around [-0.0794, 1.0234, -0.0357], supporting identification with rib 11 rather than rib 12.",
      "neighbours": "In order without overlap. Unmoved LR12 y = 0.8551 is 164.9 mm inferior; LR14 y = 1.1690 is 149.0 mm superior and lies anterior/medial to LR13. These points use different anatomical landmarks, so equal spacing is not expected."
    }
  ]
}
```