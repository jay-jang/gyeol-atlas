BL22 and CV5 are acceptable; TE5 and TE7 are slightly too proximal. TE4’s wrist level is appropriate, but its required tendon relationship remains unclear.

Locations follow [WHO (2008)](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf), printed pages 110, 159–161 and 222. Proposed coordinates are estimates; their z-values require fitting to the skin. TE5’s `minor` verdict is borderline because crease levels are inferred from nearby markers.

```json
{
  "zangfu": "TE",
  "points": [
    {
      "id": "BL22",
      "whoLocation": "Lumbar region: level with the inferior border of the L1 spinous process, 1.5 B-cun lateral to the posterior midline.",
      "textMatches": true,
      "textNote": "The vertebra, inferior-border reference and lateral distance agree with WHO.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0379,1.0400,-0.0934]. L1 FMA13072 spinousLowerBorderY=1.0405: only 0.5 mm inferior. The spinous tip is higher, at y=1.0539, and is correctly not used as the level. GV5=[0,1.0400,-0.0870] and BL51=[-0.0750,1.0400,-0.0899]; BL22 is approximately halfway between them laterally. Images support the first paraspinal line. The 37.9 mm lateral distance is internally consistent, although no scapular medial-border coordinate is supplied for independent width calibration."
    },
    {
      "id": "TE4",
      "whoLocation": "Dorsal wrist crease: the depression immediately ulnar to the extensor digitorum tendon.",
      "textMatches": true,
      "textNote": "The dorsal crease, ulnar side of the named tendon and LI5/SI5 level reference agree with WHO.",
      "verdict": "unclear",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.2540,0.8271,-0.0035]. Distal radius FMA23464 minY=[-0.2773,0.8296,0.0178], distal ulna FMA23467 minY=[-0.2368,0.8288,0.0126], and LI5 y=0.8280 support the wrist level. SI5 y=0.8368 is 9.7 mm higher. The muscle image shows the extensor retinaculum over this region, but does not resolve the extensor digitorum tendon border at the gold dot. Bone extrema cannot establish which side of that tendon the marker occupies. A labelled tendon view or tendon-border coordinates are needed."
    },
    {
      "id": "TE5",
      "whoLocation": "Posterior forearm: halfway across the radius–ulna interosseous interval, 2 B-cun proximal to the dorsal wrist crease.",
      "textMatches": true,
      "textNote": "The interosseous midpoint, 2-cun distance and anterior correspondence with PC6 agree with WHO.",
      "verdict": "minor",
      "error": "Approximately 10.8 mm too proximal, or 0.52 B-cun; current level is about 2.52 B-cun above the wrist.",
      "suggested": [-0.2517, 0.8685, -0.0175],
      "basis": "Right marker [-0.2511,0.8793,-0.0212]. Wrist reference TE4 y=0.8271 is supported by distal radius/ulna levels 0.8296/0.8288. Cubital-crease proxies LU5=1.0750, HT3=1.0750 and PC3=1.0771 give mean y=1.0757. Thus 12 B-cun=0.2486 m and 1 B-cun=0.02072 m; target y=0.8271+2*0.02072=0.86853. Images place the marker over the dorsal interosseous region without a clear transverse landmark error. Suggested x and z interpolate the existing TE4–TE5 surface-marker course. PC6 y=0.8799 corroborates the current paired level but does not independently validate its distance."
    },
    {
      "id": "TE7",
      "whoLocation": "Posterior forearm: immediately radial to the ulna, 3 B-cun proximal to the dorsal wrist crease; ulnar to TE6.",
      "textMatches": true,
      "textNote": "The supplied text correctly specifies the radial side of the ulna and 3-cun distance. Omitting WHO's TE6 note is not a disagreement.",
      "verdict": "minor",
      "error": "Approximately 12.8 mm too proximal, or 0.62 B-cun; current level is about 3.62 B-cun above the wrist.",
      "suggested": [-0.2405, 0.8893, -0.0250],
      "basis": "Right marker [-0.2390,0.9020,-0.0297]. Using wrist y=0.8271 and cubital-crease mean y=1.0757 gives target y=0.88925. TE6=[-0.2480,0.9017,-0.0290]; TE7 is 9 mm toward the ulnar side and essentially level with TE6, as required. Bone and muscle images support the intended ulnar-side interosseous position. Ulna FMA23467 distal minY=[-0.2368,0.8288,0.0126] and proximal maxY=[-0.2067,1.0764,-0.0433] indicate that moving distally also requires slightly more negative x; suggested x follows that approximate trend. Suggested z follows the neighbouring dorsal skin course."
    },
    {
      "id": "CV5",
      "whoLocation": "Lower abdomen: on the anterior midline, 2 B-cun inferior to the umbilical centre.",
      "textMatches": true,
      "textNote": "The midline and 2-cun inferior distance agree with WHO.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Marker [0,0.9400,0.1208] lies on the anterior midline. CV8=[0,1.0050,0.1159]. Using CV2 y=0.8479 as the pubic-upper-border proxy gives 5 B-cun=0.1571 m, 1 B-cun=0.03142 m and target y=0.94216. CV5 is only 2.16 mm inferior to that estimate, approximately 0.07 B-cun. Skin and deeper images show the appropriate lower-abdominal level. The pubic upper border itself is not explicitly identified among the pelvic extrema, so this proportional check uses CV2 as a proxy."
    }
  ]
}
```