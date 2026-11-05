**BL19: ok. GB24, GB36, GB37, GB40: wrong.** All five Korean descriptions match the [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1). I also inspected the matching local bone and skin meshes to resolve the cartilage boundaries and malleolar prominence. Suggested coordinates are approximate surface targets. No files were edited.

```json
{
  "zangfu": "GB",
  "points": [
    {
      "id": "BL19",
      "whoLocation": "Upper back: level with the inferior edge of the T10 spinous process, 1.5 B-cun from the posterior midline (p.109).",
      "textMatches": true,
      "textNote": "Same vertebra, spinous-process border and lateral distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.038,1.131,-0.115]. FMA10037/T10 spinousLowerBorderY=1.1313: vertical discrepancy only 0.0003 m. Adjacent lower borders are T9=1.1625 and T11=1.1059, confirming the correct vertebra. The local scapular mesh has medial-edge x approximately -0.060 to -0.070 across y=1.25–1.29; half this 3-cun width is approximately 0.030–0.035 m. Marker lateral distance 0.038 m is within the educational tolerance. BL48 [-0.075,1.1311,-0.1139] also shows the expected approximately doubled lateral spacing, as a consistency check."
    },
    {
      "id": "GB24",
      "whoLocation": "Anterior chest: seventh intercostal space on the line 4 B-cun from the anterior midline (p.183).",
      "textMatches": true,
      "textNote": "Same intercostal space and lateral distance.",
      "verdict": "wrong",
      "error": "Approximately 0.020 m superior, about 0.8 trunk B-cun: the marker overlies seventh costal cartilage rather than the space immediately below it.",
      "suggested": [-0.09, 1.122, 0.113],
      "basis": "Right marker [-0.0899,1.142,0.1154]; ST17 x=-0.090 establishes the correct 4-cun lateral line. Supplied anterior rib arcs near x=-0.11 are rib 7 [y=1.1487,z=0.0838] and rib 8 [y=1.1136,z=0.0662]. Their x=-0.09 samples have negative z and belong to posterior rib portions, so they cannot locate this anterior interval. Read-only inspection of the matching bone mesh resolves the missing cartilage: at x approximately -0.09, FMA8248/right seventh cartilage occupies y=1.13183–1.15175, enclosing the existing marker level; the next lower cartilage mesh BP28 reaches y=1.11224. The intervening space centres near y=1.122. Skin front there is z approximately 0.1097, giving marker z approximately 0.113. Sternum lower end y=1.2006 and CV8 y=1.005 give approximately 0.02445 m per trunk cun."
    },
    {
      "id": "GB36",
      "whoLocation": "Fibular side of the lower leg: immediately anterior to the fibula, 7 B-cun above the lateral malleolar prominence (p.189).",
      "textMatches": true,
      "textNote": "Same side of the fibula and proximal distance.",
      "verdict": "wrong",
      "error": "Approximately 0.043 m too proximal/superior, about 1.9 B-cun; it lies near the 8.9-cun level instead of 7 cun.",
      "suggested": [-0.133, 0.2258, -0.025],
      "basis": "Right marker [-0.1338,0.269,-0.012]. FMA24480 fibula spans y=0.0539–0.4047; its distal tip y=0.0539 is not the malleolar prominence. The matching bone mesh places the distal lateralmost prominence at [-0.112375,0.065883,-0.047612]. BL39 y=0.4313 supplies a lateral popliteal-crease proxy, supported by BL40 y=0.429 and the knee images. Thus 1 B-cun=(0.4313-0.065883)/16=0.022839 m, and the 7-cun target is y=0.225753. The existing marker is anterior to the fibula, but substantially too high. Suggested x/z follow an anterolateral skin projection at the corrected height."
    },
    {
      "id": "GB37",
      "whoLocation": "Fibular side of the lower leg: immediately anterior to the fibula, 5 B-cun above the lateral malleolar prominence (p.190).",
      "textMatches": true,
      "textNote": "The stated 16-cun reference segment and 5-cun distance agree.",
      "verdict": "wrong",
      "error": "Approximately 0.0335 m too proximal/superior, about 1.5 B-cun; it lies near the 6.5-cun level instead of 5 cun.",
      "suggested": [-0.1212, 0.1801, -0.025],
      "basis": "Right marker [-0.1203,0.2136,-0.0125]. Using the independently identified fibular malleolar prominence y=0.065883 and lateral crease proxy BL39 y=0.4313 gives 0.022839 m per B-cun. The 5-cun target is y=0.180076, whereas the marker is at y=0.2136. BL40 y=0.429 changes the target by less than 0.001 m. The muscle/bone images support the anterior-fibular side; the decisive error is height. Suggested x/z follow the local anterolateral skin surface at the corrected level."
    },
    {
      "id": "GB40",
      "whoLocation": "Anterolateral ankle: depression in front of and below the lateral malleolus, lateral to the extensor digitorum longus tendon (p.191).",
      "textMatches": true,
      "textNote": "Same depression and tendon-side relationship.",
      "verdict": "wrong",
      "error": "Over the malleolar surface rather than its anterodistal depression. Relative to the proposed target, approximately 0.025 m too posterior and 0.012 m too superior.",
      "suggested": [-0.113, 0.052, -0.015],
      "basis": "Right marker [-0.1137,0.0641,-0.0397], skin attachment [-0.1137,0.0641,-0.0427]. FMA24480 distal tip is [-0.1057,0.0539,-0.0491]; matching-mesh lateral prominence is [-0.112375,0.065883,-0.047612]. The marker is only 0.0018 m below and 0.0079 m anterior to that prominence, still over the malleolar outline. At y approximately 0.064 the fibular anterior edge reaches z approximately -0.0347, anterior to the marker attachment. The proposed target lies below the tip and anterior to this bone, on the lateral skin near x=-0.110 with a small marker offset. The matching EDL tendon mesh passes farther anterior at these distal ankle levels, supporting a target lateral to it."
    }
  ]
}
```