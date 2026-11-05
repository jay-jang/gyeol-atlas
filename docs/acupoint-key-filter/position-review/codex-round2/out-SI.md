Standard locations checked against [WHO 2008, pp. 89 and 91](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1). Both corrected markers are acceptable; the unmoved SI3 remains questionable.

```json
{
  "zangfu": "SI",
  "points": [
    {
      "id": "SI4",
      "whoLocation": "WHO 2008, p.89: Posteromedial wrist, at the dorsal–palmar skin boundary, in the depression separating the fifth metacarpal base from the triquetrum.",
      "textMatches": true,
      "textNote": "The Korean text specifies the same bones, wrist surface and red–white skin boundary.",
      "verdict": "ok",
      "error": null,
      "suggested": null,
      "basis": "New right marker [-0.2215, 0.8120, 0.0270]; actual surfacePoint [-0.2245, 0.8120, 0.0270]. Fifth metacarpal FMA24472 proximal extreme is [-0.2371, 0.8109, 0.0256]; triquetrum FMA24439 distal extreme is [-0.2374, 0.8126, 0.0238]. Marker y=0.8120 lies between those levels. Its surface position is 12.6 mm toward the ulnar/medial skin edge from the metacarpal-base landmark, a plausible surface offset. All three images place it at the ulnar wrist margin beside the appropriate bone interval. The precise red–white skin boundary is not rendered, but no displacement beyond educational-marker tolerance is evident.",
      "neighbours": "SI3–SI4–SI5 remain in proximal order: y=0.7388, 0.8120, 0.8368; centre distances SI3–SI4=77.9 mm and SI4–SI5=46.4 mm, without overlap. Separate unmoved-neighbour concern: SI3 [-0.2481, 0.7388, 0.0296] is 16.9 mm below the entire fifth metacarpal's distal y extreme (0.7557). Using its head-region landmark [-0.2258, 0.7608, 0.0415] and base to estimate the longitudinal axis, SI3 projects about 12.3 mm distal to the head, although it should be proximal to the fifth MCP joint. SI2 and SI3 differ by only 1.5 mm along that axis, despite 19.9 mm centre separation. This existing neighbour problem was not caused by the SI4 move."
    },
    {
      "id": "SI7",
      "whoLocation": "WHO 2008, p.91: Posteromedial forearm, in the interval separating the ulna's medial edge from flexor carpi ulnaris, five proportional cun toward the elbow from the dorsal wrist fold. The alternative construction places it one cun wristward of the SI5–SI8 midpoint.",
      "textMatches": true,
      "textNote": "The Korean text matches the named bone–muscle interval, posteromedial surface and 5-cun distance. The missing whoStandardPage should be 91.",
      "verdict": "ok",
      "error": null,
      "suggested": null,
      "basis": "New right marker [-0.2120, 0.9370, -0.0339]; surfacePoint [-0.2120, 0.9370, -0.0309]. SI5 y=0.8368 and SI8 y=1.0800 give an approximate vertical scale of 0.02027 m/cun across the 12-cun forearm. The expected five-cun level is y=0.93813; the marker is only 1.13 mm distal, approximately 0.056 cun. Independent bone bounds support the wrist/elbow region: ulna FMA23467 distal extreme [-0.2368, 0.8288, 0.0126], proximal extreme [-0.2067, 1.0764, -0.0433]. The skin, muscle and bone views place the dot along the medial/ulnar forearm margin rather than the central dorsal extensor surface. Exact groove confirmation is limited by the absence of a labelled FCU cross-section, but the visible placement is consistent with the standard.",
      "neighbours": "In order: SI5 y=0.8368, SI6=0.8548, SI7=0.9370, SI8=1.0800. SI7 is approximately 4.06 cun proximal to SI6 and 7.06 cun distal to SI8 on the same vertical scale, consistent with the expected approximately 4- and 7-cun intervals. Centre distances are 90.0 mm to SI6 and 149.6 mm to SI8; no overlap."
    }
  ]
}
```