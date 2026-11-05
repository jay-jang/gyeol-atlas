All five Korean texts match the standard locations. **HT5 is a borderline `minor`; HT6, HT7, BL15 and CV14 are `ok` under your approximate 0.5-cun tolerance.**

WHO’s indexed text confirms HT5/HT6 (p.84), HT7 (p.85) and BL15 (p.107). Full PDF retrieval failed; CV14 was corroborated through KMCRIC and WHO’s adjacent ST19 description. [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1), [KMCRIC CV14](https://m.kmcric.com/knowledge/acupoint/CV/CV14).

The wrist estimates use the pisiform’s proximal boundary as the crease reference. Their shared approximately 10 mm proximal offset lies near the grading boundary, so the distinction between HT5 and HT6/HT7 has limited precision. No files were edited.

```json
{
  "zangfu": "HT",
  "points": [
    {
      "id": "HT5",
      "whoLocation": "WHO p.84: Anteromedial forearm, on the radial side of the flexor carpi ulnaris tendon, one B-cun proximal to the palmar wrist crease.",
      "textMatches": true,
      "textNote": "Same tendon side, wrist landmark and one-cun proximal distance.",
      "verdict": "minor",
      "error": "Borderline: approximately 10.8 mm too proximal, or 0.52 B-cun. No convincing wrong-side-of-tendon displacement.",
      "suggested": [-0.2462, 0.8461, 0.0384],
      "basis": "Right marker [-0.2452,0.8569,0.0368]. Pisiform FMA24441 proximal extreme is [-0.2357,0.8253,0.0318]; WHO's pisiform reference therefore gives an estimated wrist level y=0.8253. Cubital-crease markers HT3 and LU5 both have y=1.075. Vertical B-cun=(1.075-0.8253)/12=0.02081 m; target HT5 y=0.84611. Current level is 1.52 B-cun above that wrist reference. Images place the marker along the radial side of the ulnar wrist tendon region. Suggested x and z follow the nearby HT6 surface position at almost the target level; reproject onto skin before implementation. Tendon-border coordinates and an independently measured skin crease are unavailable."
    },
    {
      "id": "HT6",
      "whoLocation": "WHO p.84: Anteromedial forearm, on the radial side of the flexor carpi ulnaris tendon, half a B-cun proximal to the palmar wrist crease.",
      "textMatches": true,
      "textNote": "Same tendon side and half-cun proximal distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.2462,0.8459,0.0384]. Pisiform FMA24441 maxY=0.8253; cubital-crease markers HT3/LU5 y=1.075 give 0.02081 m per B-cun. Estimated target y=0.83570; residual is 10.2 mm proximal, approximately 0.49 B-cun, at the stated tolerance boundary. Skin, muscle and bone views retain the expected anteromedial/radial-to-FCU region. This acceptance depends on the approximate tolerance; it does not establish exact crease or tendon registration."
    },
    {
      "id": "HT7",
      "whoLocation": "WHO p.85: Anteromedial wrist at the palmar wrist crease, radial to the flexor carpi ulnaris tendon; the depression beside the proximal border of the pisiform.",
      "textMatches": true,
      "textNote": "The Korean phrase identifies the radial side of the tendon at the palmar wrist crease. Its repetitive wording does not change the location.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.247,0.835,0.0407]. Pisiform FMA24441 proximal extreme [-0.2357,0.8253,0.0318] places the marker 9.7 mm proximal to the bony reference, approximately 0.47 B-cun using the 0.02081 m forearm scale. Its more negative x is toward the radius/thumb on this right hand, consistent with placement radial to the pisiform/FCU region. The three views support the correct wrist region. Offset remains within the requested approximate tolerance; exact tendon-border and skin-crease coordinates are missing."
    },
    {
      "id": "BL15",
      "whoLocation": "WHO p.107: Upper back, 1.5 B-cun lateral to the posterior midline, aligned with the inferior edge of the T5 spinous process.",
      "textMatches": true,
      "textNote": "Same vertebra, inferior spinous-process border and lateral distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.038,1.279,-0.1291]. T5 FMA9922 spinousLowerBorderY=1.2789: vertical discrepancy is only +0.0001 m. T5 spinousTip=[0.0001,1.2879,-0.0954]; the marker correctly follows the lower border rather than the tip. Neighboring T4/T6 lower borders are 1.3112/1.2428, excluding a vertebral-level error. Images support the medial bladder line. BL44 [-0.075,1.2789,-0.132] provides a consistent approximately 1:2 first/second-line spacing, but is not independent anatomical calibration. The landmark file lacks scapular medial-border coordinates, limiting precise verification of the lateral B-cun distance."
    },
    {
      "id": "CV14",
      "whoLocation": "WHO p.226: Upper abdominal midline, six B-cun superior to the centre of the umbilicus.",
      "textMatches": true,
      "textNote": "Same anterior midline and six-cun distance above the umbilicus.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Marker [-0.0001,1.1601,0.1268]; umbilicus CV8=[0,1.005,0.1159]. Sternal body FMA7487 inferior extreme=[-0.0109,1.2006,0.0998] approximates the xiphisternal level; xiphoid FMA7488 maxY=1.2046 corroborates the junction region. Using y=1.2006 gives one B-cun=(1.2006-1.005)/8=0.02445 m and target y=1.1517. Current position is 8.4 mm superior, approximately 0.34 B-cun, within tolerance. Using the xiphoid proximal extent gives a similarly acceptable residual of approximately 0.22 B-cun. Midline alignment and epigastric placement agree across all three images."
    }
  ]
}
```