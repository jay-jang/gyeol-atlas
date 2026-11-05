All six new placements are `ok`. Neighbour spacing issues remain at TE8 and SP18–20. Locations were checked against [WHO 2008](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf), printed pp. 78, 130, 160–161 and 189–191.

Independent mesh measurements: navel pit ≈ `[0, 0.9904, 0.1065]`; xiphisternal junction y ≈ `1.203`; pubic symphysis upper border y ≈ `0.827`. These give upper/lower abdominal scales of approximately `0.0266`/`0.0327` m per cun.

Read-only review; no files edited. Worktree: `/Users/nuinuri/workspace/anatomy-worktrees/acupoint-key-filter`; branch: `feat/acupoint-key-filter`.

```json
{
  "group": "neighbours",
  "points": [
    {
      "id": "GB35",
      "whoLocation": "WHO p.189: Fibular aspect of the leg, posterior to the fibula, 7 B-cun proximal to the lateral malleolar prominence.",
      "textMatches": true,
      "textNote": "Landmark, posterior relationship and distance agree.",
      "verdict": "ok",
      "error": "No material error; approximately 0.05 cun proximal to the calculated level.",
      "suggested": null,
      "basis": "FMA24480 lateral malleolar prominence is approximately [-0.1124,0.0659,-0.0476], distinct from its inferior tip at [-0.1057,0.0539,-0.0491]. Using popliteal level y=0.429 as a crease-level proxy gives (0.429-0.0659)/16=0.02269 m/cun and a 7-cun target y=0.2248. New marker [-0.137,0.226,-0.057] agrees. Nearby fibular posterior vertices include [-0.1127,0.2267,-0.0506]; the marker is posterior to the shaft, with its lateral displacement following the skin.",
      "neighbours": "In order. GB36 shares y=0.226 but has z=-0.030, placing GB35 0.027 m posterior to it. Their centres are 0.0271 m apart, without overlap. GB37 y=0.181 is 0.045 m, approximately 1.98 cun, distal to GB35/36."
    },
    {
      "id": "GB38",
      "whoLocation": "WHO p.190: Fibular aspect of the leg, anterior to the fibula, 4 B-cun proximal to the lateral malleolar prominence.",
      "textMatches": true,
      "textNote": "The added 16-cun measurement explanation is consistent with WHO.",
      "verdict": "ok",
      "error": "Approximately 0.15 cun proximal to the calculated level, within tolerance.",
      "suggested": null,
      "basis": "With lateral malleolar prominence y=0.0659 and 0.02269 m/cun, the 4-cun target is y=0.1567. New marker [-0.1211,0.160,-0.031] is approximately 4.15 cun proximal. FMA24480 anterior vertices near this level include [-0.1039,0.1599,-0.0399] and [-0.1084,0.1567,-0.0401]. Marker z=-0.031 is anterior to the fibula, as required.",
      "neighbours": "In order. GB37 y=0.181 is 0.021 m, approximately 0.93 cun, proximal. GB39 y=0.1375 is 0.0225 m, approximately 0.99 cun, distal. No reversal or centre overlap."
    },
    {
      "id": "GB39",
      "whoLocation": "WHO p.191: Fibular aspect of the leg, anterior to the fibula, 3 B-cun proximal to the lateral malleolar prominence.",
      "textMatches": true,
      "textNote": "Anterior placement and 3-cun distance agree with WHO.",
      "verdict": "ok",
      "error": "Approximately 0.16 cun proximal to the calculated level, within tolerance.",
      "suggested": null,
      "basis": "The independently identified FMA24480 prominence y=0.0659 gives a 3-cun target y=0.1340. New marker [-0.1168,0.1375,-0.031] is approximately 3.16 cun proximal. Nearby anterior fibular vertices include [-0.1001,0.1344,-0.0429] and [-0.1075,0.1412,-0.0394]; marker z=-0.031 is on their anterior side.",
      "neighbours": "In order. GB38 is 0.0225 m, approximately 0.99 cun, proximal. GB40 [-0.1103,0.055,-0.027] remains distal and slightly anterior, with a y separation of 0.0825 m. No overlap."
    },
    {
      "id": "TE6",
      "whoLocation": "WHO p.160: Posterior forearm, midway across the radius-ulna interosseous space, 3 B-cun proximal to the dorsal wrist crease.",
      "textMatches": true,
      "textNote": "Surface, interosseous midpoint and distance agree.",
      "verdict": "ok",
      "error": "No material error.",
      "suggested": null,
      "basis": "Dorsal wrist reference TE4 y=0.827 and cubital crease proxies y≈1.075–1.077 give approximately 0.0207–0.0208 m/cun and a 3-cun level y≈0.889–0.8895. New marker [-0.242,0.889,-0.0251] agrees. At this level, the radial medial edge includes [-0.2487,0.8872,0.0017] and the ulnar radial edge approximately [-0.2347,0.8908,0.0029], giving an interosseous midpoint x≈-0.2417. The marker lies posterior to this gap.",
      "neighbours": "TE5 y=0.868 is approximately 1 cun distal. TE7 [-0.237,0.889,-0.0242] is correctly at the same level and ulnar to TE6; centre separation is only 0.0051 m, explaining the crowded labels. TE8 y=0.932 is a spacing problem: it is approximately 5.0–5.1 cun above the wrist rather than 4, leaving about 2.1 cun between TE6 and TE8 instead of 1. This does not invalidate TE6."
    },
    {
      "id": "BL62",
      "whoLocation": "WHO p.130: Lateral foot, directly below the lateral malleolar prominence, in the depression between its inferior border and the calcaneus.",
      "textMatches": true,
      "textNote": "The described depression and corresponding medial point agree.",
      "verdict": "ok",
      "error": "No material error at educational surface-marker precision.",
      "suggested": null,
      "basis": "New marker [-0.1111,0.045,-0.049] lies almost directly below the FMA24480 lateral prominence [-0.1124,0.0659,-0.0476]: x difference 0.0013 m and z difference -0.0014 m. It is 0.0089 m below the fibular inferior tip [-0.1057,0.0539,-0.0491], on the lateral skin over the malleolus-calcaneus interval. FMA24497 occupies the adjacent heel region, with superior extent y=0.061 and lateral extent x=-0.1034.",
      "neighbours": "In order. BL61 [-0.1109,0.0529,-0.0601] is posterior to BL62 by 0.0111 m; their centres are 0.0136 m apart. BL63 [-0.1247,0.028,-0.016], BL64 [-0.1395,0.020,0.014] and BL65 [-0.1342,0.0236,0.0908] progress anteriorly along the lateral foot. No new reversal or centre overlap."
    },
    {
      "id": "SP17",
      "whoLocation": "WHO p.78: Anterior thorax, fifth intercostal space, 6 B-cun lateral to the anterior median line.",
      "textMatches": true,
      "textNote": "Intercostal space and lateral distance agree.",
      "verdict": "ok",
      "error": "No material error.",
      "suggested": null,
      "basis": "ST17 x=-0.090 gives 0.0225 m per transverse cun; SP17 x=-0.135 is exactly 6 cun lateral. New marker y=1.2075 lies in the fifth intercostal interval. To account for the curved lateral skin, horizontal inward rays from its skin position [-0.135,1.2075,0.0772] were directed medially and posteriorly. Scanning this corridor intersects rib 6 FMA8175 through approximately y=1.1975 and rib 5 FMA8066 from approximately y=1.2175, leaving SP17 between them. Representative intersections are [-0.1117,1.1975,0.0686] on rib 6 and [-0.1083,1.2175,0.0673] on rib 5.",
      "neighbours": "Vertical order is preserved: SP18 y=1.2368, SP19 y=1.2620 and SP20 y=1.2901 lie successively superior, with gaps of 0.0293, 0.0252 and 0.0281 m. The shared lateral line remains inconsistent: their |x| values 0.1508, 0.1490 and 0.1506 correspond to approximately 6.70, 6.62 and 6.69 cun, respectively, versus SP17 at 6.00 cun. These unmoved neighbours remain approximately 0.6–0.7 cun too lateral under the supplied transverse scale. No centre overlap; the SP17/SP21 label crowding does not indicate coincident markers."
    }
  ]
}
```