Checked against the [WHO standard, pp. 26 and 29](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf). Both corrected markers are acceptable at educational surface-marker precision.

```json
{
  "zangfu": "LU",
  "points": [
    {
      "id": "LU1",
      "whoLocation": "Anterior thoracic region, level with the first intercostal space, lateral to the infraclavicular fossa, 6 B-cun lateral to the anterior median line. WHO p. 26; supplementary landmark: 1 B-cun inferior to LU2.",
      "textMatches": true,
      "textNote": "The supplied Korean text agrees with WHO on the intercostal level, infraclavicular landmark and lateral distance.",
      "verdict": "ok",
      "error": "No material placement error identified.",
      "suggested": null,
      "basis": "Right LU1 is [-0.135, 1.327, 0.0442]. ST17 x=-0.090 represents 4 B-cun, giving 0.0225 m/B-cun; LU1 is exactly 6 B-cun lateral. At anterior-arc sample x=-0.050, rib 1 (FMA7857) has y=1.3462 and rib 2 (FMA7882) y=1.3051; their midpoint is y=1.32565, only 1.35 mm below LU1. This supports the first-intercostal-space height, projected laterally rather than implying that these ribs extend beneath LU1. All three images place the marker on the upper lateral chest below the infraclavicular region.",
      "neighbours": "LU2 remains superior and separate: [-0.150, 1.350, 0.0191], 23 mm above LU1. However, LU1 is now 15 mm medial to LU2 (0.67 horizontal B-cun). The unmoved LU2 is therefore not vertically aligned with the corrected 6-B-cun line; its x coordinate corresponds to 6.67 B-cun using ST17. No overlap or reversed order."
    },
    {
      "id": "LU7",
      "whoLocation": "Radial forearm, between the abductor pollicis longus and extensor pollicis brevis tendons, in the groove for the abductor pollicis longus tendon, 1.5 B-cun superior to the palmar wrist crease. WHO p. 29.",
      "textMatches": true,
      "textNote": "The supplied Korean text agrees with WHO, including both named tendons, the groove and the 1.5-cun distance.",
      "verdict": "ok",
      "error": "No material error identified at educational surface-marker precision; the longitudinal discrepancy is approximately 0.07 B-cun proximal.",
      "suggested": null,
      "basis": "Right LU7 is [-0.2757, 0.8600, -0.0010], with skin surfacePoint [-0.2727, 0.8600, -0.0010]. Using LU5 y=1.0750 and wrist-crease proxy LU9 y=0.8276, 12 B-cun spans 0.2474 m, or 0.02062 m/B-cun vertically. The expected 1.5-cun height is y=0.85853; LU7 is 1.48 mm higher. The radius distal extreme (FMA23464) is [-0.2773, 0.8296, 0.0178], placing LU7 30.4 mm proximal to that bony endpoint. Skin and peeled images show a radial-side placement consistent with the first extensor-compartment region rather than the anterior wrist line. The individual APL/EPB tendons are not labelled separately, limiting confirmation of the exact groove.",
      "neighbours": "In order, without overlap: LU6 y=0.9700 > LU7 y=0.8600 > LU8 y=0.8452 > LU9 y=0.8276. LU7 is 14.8 mm proximal to LU8, approximately 0.72 B-cun versus the nominal 0.5; the 0.22-cun difference is within tolerance. LU7 is 32.1 mm posterior to LU8, consistent with their radial versus anterolateral locations; their 3D separation is 35.5 mm."
    }
  ]
}
```