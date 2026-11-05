Both new markers meet the educational placement tolerance. Locations were checked against the [WHO publication, pp. 197–198 (mirrored copy)](https://www.medbox.org/index.php/dl/627a4de115110145a1723f64).

```json
{
  "zangfu": "LR",
  "points": [
    {
      "id": "LR3",
      "whoLocation": "WHO 2008, p. 197: On the foot dorsum, in the interval between metatarsals 1 and 2, immediately distal to their basal junction, at the depression over the dorsalis pedis artery.",
      "textMatches": true,
      "textNote": "The Korean text agrees on the bones, distal depression and arterial landmark.",
      "verdict": "ok",
      "error": "No demonstrable placement error beyond the educational tolerance. The images cannot establish an exact arterial pulse location.",
      "suggested": null,
      "basis": [
        "Right LR3 is [-0.0835, 0.0644, 0.0400]; its skin anchor is [-0.0835, 0.0614, 0.0400].",
        "First metatarsal FMA24507 has its dorsal maximum at [-0.0789, 0.0579, 0.0331] and proximal z extreme at [-0.0807, 0.0397, 0.0215]. Second metatarsal FMA24509 has corresponding points [-0.0879, 0.0617, 0.0236] and [-0.0883, 0.0448, 0.0156].",
        "The marker's x falls between the proximal first and second metatarsals, and z=0.0400 is distal to their basal region. Its higher y is consistent with the overlying dorsal skin.",
        "The skin, muscle and bone views support a proximal first intermetatarsal location. The bilateral markers appear anatomically comparable."
      ],
      "neighbours": "In order, with no marker overlap. Unmoved right LR2 [-0.0775, 0.0163, 0.1432] remains distal to LR3: delta z=+0.1032 m, centre separation 0.1140 m. Unmoved LR4 [-0.0647, 0.0749, 0.0214] remains proximal and medial to LR3, separated by 0.0284 m. These relations establish ordering; they do not independently validate LR2's web-margin placement."
    },
    {
      "id": "LR6",
      "whoLocation": "WHO 2008, p. 198: On the anteromedial lower leg, centred across the medial tibial surface, seven B-cun proximal to the medial malleolar prominence.",
      "textMatches": true,
      "textNote": "The Korean text agrees on the tibial surface and seven-cun distance. Its 13-cun malleolus-to-SP9 reference is consistent with the proportional scale specified in the brief.",
      "verdict": "ok",
      "error": "The available 13-cun proxy calculation places the marker approximately 0.0051 m proximal to the target, about 0.21 B-cun, within tolerance. The exact malleolar prominence and condylar lower border were not separately sampled.",
      "suggested": null,
      "basis": [
        "Right LR6 is [-0.0674, 0.2500, -0.0106]; its skin anchor is [-0.0704, 0.2500, -0.0106].",
        "Using distal tibial FMA24477 minY [-0.0562, 0.0733, -0.0322] as a distal bony proxy and SP9 y=0.3920 as the proximal reference gives (0.3920-0.0733)/13=0.02452 m per B-cun.",
        "That proxy yields a seven-cun target y=0.24491; LR6 y=0.2500 corresponds to 7.21 cun. The tibial distal tip is a proxy, not an exact measurement of the malleolar prominence.",
        "The three views place the marker over the anteromedial tibial region, consistent with the medial surface rather than the posterior calf. The left marker [0.0662, 0.2500, -0.0106] appears comparable."
      ],
      "neighbours": "In order, with no marker overlap. Unmoved right LR5 [-0.0725, 0.2039, -0.0135] is 0.0461 m inferior to LR6, approximately 1.88 B-cun against the expected two-cun interval. Unmoved LR7 [-0.0283, 0.4060, -0.0189] remains proximal near the knee, 0.1560 m higher."
    }
  ]
}
```