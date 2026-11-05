Checked against WHO pp. 159–161, including the required TE6–TE7 alignment. [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1)

```json
{
  "zangfu": "TE",
  "points": [
    {
      "id": "TE4",
      "whoLocation": "Posterior wrist: the depression immediately ulnar to the extensor digitorum tendon, at the dorsal wrist crease (WHO p.159).",
      "textMatches": true,
      "textNote": "The KMCRIC text agrees on the crease, tendon and ulnar side.",
      "verdict": "ok",
      "error": "No material displacement identified.",
      "suggested": null,
      "basis": "Right marker [-0.244, 0.827, -0.0031]. Distal bone extremes are radius FMA23464 minY [-0.2773, 0.8296, 0.0178] and ulna FMA23467 minY [-0.2368, 0.8288, 0.0126], supporting this wrist level. Additional read-only GLB sectioning at y=0.827 gives extensor digitorum FMA38501 x=-0.263817 to -0.245063: the marker is 1.1 mm ulnar to its ulnar edge, consistent with the required depression. Skin and peeled images support this location. LI5 y=0.828 differs by 1 mm; SI5 y=0.8368 differs by 9.8 mm, approximately 0.47 B-cun, within the stated tolerance.",
      "neighbours": "In order, with no overlap: unmoved TE3 y=0.7658 is 61.2 mm distal to TE4; new TE5 y=0.868 is 41 mm proximal, approximately 1.98 B-cun."
    },
    {
      "id": "TE5",
      "whoLocation": "Posterior forearm: halfway across the gap between radius and ulna, two B-cun proximal to the dorsal wrist crease (WHO p.160).",
      "textMatches": true,
      "textNote": "The KMCRIC text agrees on the interosseous midpoint and 2-cun distance.",
      "verdict": "ok",
      "error": "No material displacement identified.",
      "suggested": null,
      "basis": "Right marker [-0.2445, 0.868, -0.0177]. Using wrist y=0.827 and cubital-crease reference LU5 y=1.075 gives 1 B-cun=(1.075-0.827)/12=0.020667 m; TE5 is 1.98 B-cun proximal to the wrist. PC3 y=1.0771 gives a similar scale. Additional read-only sections of the matching GLB bones at y=0.868 put the radius's ulnar edge at x=-0.250461 and the ulna's radial edge at x=-0.238885; their midpoint is -0.244673, only 0.17 mm from the marker. The images show a posterior surface marker over this gap; its separation from peeled tissue is expected.",
      "neighbours": "Longitudinal order is preserved without overlap. Unmoved TE6 [-0.248, 0.9017, -0.029] is 33.7 mm proximal to TE5, approximately 1.63 B-cun instead of WHO's 1 B-cun. TE6 is approximately 0.6 B-cun too proximal on this independently derived scale."
    },
    {
      "id": "TE7",
      "whoLocation": "Posterior forearm: immediately radial to the ulna, three B-cun proximal to the dorsal wrist crease; ulnar to TE6 at the same level (WHO p.161).",
      "textMatches": true,
      "textNote": "The KMCRIC text agrees on the radial side of the ulna and 3-cun distance. Omitting the TE6 comparison note is not a location discrepancy.",
      "verdict": "ok",
      "error": "No material displacement identified in TE7 itself.",
      "suggested": null,
      "basis": "Right marker [-0.237, 0.889, -0.0242]. Wrist y=0.827 and LU5 cubital-crease reference y=1.075 give 0.020667 m/B-cun, so (0.889-0.827)/0.020667=3.00 B-cun. Additional read-only GLB sectioning at y=0.889 gives ulna FMA23467 radial edge x=-0.235337; TE7 is 1.66 mm radial to it. The radius's ulnar edge is x=-0.248695, confirming that TE7 occupies the ulnar portion of the interosseous gap. Skin, muscle and bone images are consistent with this surface placement.",
      "neighbours": "No overlap, and TE7 is ulnar to TE6, but the required equal level is broken: unmoved TE6 y=0.9017 is 12.7 mm, approximately 0.61 B-cun, proximal to TE7. Unmoved TE8 y=0.932 is approximately 5.08 B-cun from the wrist rather than 4; its 43 mm separation from TE7 is approximately 2.08 B-cun instead of 1. These are neighbour-placement problems, not reasons to move TE7."
    }
  ]
}
```