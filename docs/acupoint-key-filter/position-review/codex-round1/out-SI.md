All five Korean descriptions match WHO. Marker verdicts: **SI4 and SI7 wrong; SI6, BL27 and CV4 ok**.

Standards were checked against [WHO’s indexed 2008 text](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?isAllowed=y&sequence=1) and the [WHO scan for CV4, p.221](https://www.medbox.org/index.php/dl/627a4de115110145a1723f64). I also inspected the matching local bone, muscle and skin meshes, read-only, to resolve the ulnar borders. Suggested coordinates are approximate educational surface positions.

```json
{
  "zangfu": "SI",
  "points": [
    {
      "id": "SI4",
      "whoLocation": "WHO 2008 p.89: Posteromedial wrist, in the hollow separating the fifth metacarpal base from the triquetrum, at the red–white skin boundary.",
      "textMatches": true,
      "textNote": "The landmarks and skin boundary agree with WHO.",
      "verdict": "wrong",
      "error": "The marker occupies the dorsal surface near the fifth metacarpal base rather than its ulnar skin border. Relative to the proposed position, it is approximately 26 mm too radial, 9 mm too distal and 24 mm too posterior. The radial displacement alone is about 1.3 forearm B-cun.",
      "suggested": [-0.2213, 0.812, 0.028],
      "basis": "Current right marker [-0.247,0.8029,0.0038]. FMA24472 fifth metacarpal proximal extreme [-0.2371,0.8109,0.0256]; FMA24439 triquetrum distal extreme [-0.2374,0.8126,0.0238]. These place the intervening hollow near y=0.812. The matching skin mesh at that level has its ulnar edge approximately [-0.2243,0.812,0.0280]; the suggestion includes 3 mm outward marker clearance. The supplied images show the existing dot over the dorsal base region."
    },
    {
      "id": "SI6",
      "whoLocation": "WHO 2008 p.90: Posteromedial forearm, in the hollow on the radial side of the ulnar head, one B-cun proximal to the dorsal wrist crease.",
      "textMatches": true,
      "textNote": "Both the radial side of the ulnar head and the one-cun distance agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Current right marker [-0.2419,0.8548,-0.0125]. SI5 wrist reference y=0.8368 and SI8 elbow reference y=1.0800 give one projected B-cun of 0.02027 m and an expected y near 0.8571: a 2.3 mm difference. FMA23467 identifies the distal ulnar head region with its radial extreme [-0.2481,0.8415,0.0156]. Additional mesh vertices within 4 mm of y=0.855 span x=-0.2428 to -0.2295, placing the marker near the radial margin at its own level. The images support the distal dorsal-ulnar region; any small radial adjustment is within educational tolerance."
    },
    {
      "id": "SI7",
      "whoLocation": "WHO 2008 p.91: Posteromedial forearm, in the interval between the ulna's medial edge and flexor carpi ulnaris, five B-cun proximal to the dorsal wrist crease.",
      "textMatches": true,
      "textNote": "The named muscle, medial ulnar border and five-cun distance agree.",
      "verdict": "wrong",
      "error": "The height is acceptable, but the marker is on the dorsal-radial side of the ulna, over the extensor carpi ulnaris region, rather than the medial interval adjoining flexor carpi ulnaris. Move approximately 16 mm ulnarly toward the body midline and 6 mm distally, following the skin. The transverse error is about 0.8 B-cun; the wrong named side determines the verdict.",
      "suggested": [-0.22, 0.9381, -0.04],
      "basis": "Current right marker [-0.236,0.944,-0.0468]. SI5–SI8 interpolation gives y=0.8368+(1.0800-0.8368)*5/12=0.93813. Additional FMA23467 mesh vertices within 4 mm of y=0.944 span x=-0.2330 to -0.2208: the existing marker is radial to that section. Right flexor carpi ulnaris ulnar-head mesh FMA38619 near this level spans x=-0.2229 to -0.1996, whereas right extensor carpi ulnaris meshes BP45/BP47 extend to x approximately -0.2372/-0.2353. A target near x=-0.220 approaches the medial ulnar–flexor interval. At x=-0.220,y=0.9381, dorsal skin z is approximately -0.0370; the suggestion adds 3 mm outward clearance."
    },
    {
      "id": "BL27",
      "whoLocation": "WHO 2008 p.113: Sacral region, level with the first posterior sacral foramen, 1.5 B-cun lateral to the median sacral crest.",
      "textMatches": true,
      "textNote": "The foramen level and lateral distance agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Current right marker [-0.038,0.913,-0.1105]. BL31 is [-0.022,0.9179,-0.1057], so BL27 is 4.9 mm lower and 16 mm farther lateral; this small level difference is within tolerance. The bone image places it lateral to the upper posterior sacral-foramen region. FMA16202 sacrum spans y=0.8042–0.9495, and the right posterior iliac extreme is [-0.0454,0.9294,-0.0827]. Supplemental right scapular mesh sections give medial-border offsets around 0.060–0.070 m, implying a half-distance near 0.030–0.035 m; x=-0.038 is within approximately 0.5 B-cun. Limitation: BL31 is another authored marker, and the supplied bone landmarks do not independently specify the first foramen centre; the level assessment also relies on the image."
    },
    {
      "id": "CV4",
      "whoLocation": "WHO 2008 p.221: Lower abdominal anterior midline, three B-cun inferior to the umbilical centre.",
      "textMatches": true,
      "textNote": "The midline and three-cun inferior distance agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "CV8 umbilicus [0,1.005,0.1159]; CV4 [0,0.907,0.1129]. Using CV2 [0,0.8479,0.0916] as the pubic-upper-border surface proxy gives one B-cun=(1.005-0.8479)/5=0.03142 m. Expected CV4 y=0.91074; actual y is 3.74 mm lower, approximately 0.12 B-cun. The marker is exactly on x=0, and all three images support the lower abdominal midline. Limitation: CV2 is a marker proxy, not an independently measured symphyseal upper-border landmark."
    }
  ]
}
```