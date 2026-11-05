LU1 appears slightly low and lateral. LU6 and BL13 are acceptable at educational precision. LU7 and LU9 have plausible levels, but the supplied views cannot establish their required tendon relationships.

All five Korean location texts match the [WHO standard, printed pp. 26, 28–30 and 106](https://www.medbox.org/index.php/dl/627a4de115110145a1723f64). No files were edited. The suggested coordinate is approximate; its z value needs skin reprojection.

```json
{
  "zangfu": "LU",
  "points": [
    {
      "id": "LU1",
      "whoLocation": "Anterior chest, level with the first intercostal space, lateral to the infraclavicular fossa, 6 B-cun from the anterior midline.",
      "textMatches": true,
      "textNote": "The landmarks, intercostal level and distance agree with WHO.",
      "verdict": "minor",
      "error": "Approximately 12.1 mm too lateral (0.54 transverse B-cun), and probably 10–20 mm too inferior (about 0.4–0.8 trunk B-cun). The lateral chest position remains recognisable; the evidence does not securely establish a whole-space error.",
      "suggested": [-0.135, 1.33, 0.04],
      "basis": "Right marker [-0.1471,1.3151,0.0416]. ST17 x=-0.090 represents 4 B-cun, giving 22.5 mm/B-cun and a 6-cun target x=-0.135. Rib 1 FMA7857 and rib 2 FMA7882 have anterior-arc y values 1.3462/1.3051 at x=-0.050 and 1.3545/1.3154 at x=-0.070: approximate first-space centre levels are 1.32565 and 1.33495. These support a provisional target y around 1.330, although neither rib extends to the marker's lateral x. Sternal-body inferior y=1.2006 and CV8 y=1.005 give 24.45 mm per vertical trunk B-cun. ST14 y=1.3149 agrees with the current marker but is another authored marker, not independent rib evidence."
    },
    {
      "id": "LU6",
      "whoLocation": "Anterolateral forearm, along LU5–LU9, 7 B-cun proximal to the palmar wrist crease.",
      "textMatches": true,
      "textNote": "The line and 7-cun measurement agree with WHO.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "LU5 [-0.233,1.075,0.0002] and LU9 [-0.2772,0.8276,0.0461] give a 12-cun y span of 0.2474 m, or 20.62 mm/B-cun. The 7/12 interpolation is [-0.25142,0.97192,0.01932]; actual LU6 is [-0.255,0.970,0.0194], only 3.6 mm lateral and 1.9 mm distal to that line position. Its y-based distance above the wrist is 6.91 cun. Skin and peeled views place it on the anterolateral forearm."
    },
    {
      "id": "LU7",
      "whoLocation": "Radial forearm, between APL and EPB tendons, at the APL tendon groove, 1.5 B-cun proximal to the palmar wrist crease.",
      "textMatches": true,
      "textNote": "Both tendons, their groove relationship and the 1.5-cun distance agree with WHO.",
      "verdict": "unclear",
      "error": "The longitudinal level is acceptable; the APL–EPB tendon relationship cannot be resolved.",
      "suggested": null,
      "basis": "Actual [-0.2739,0.862,0.0288]. Using wrist y=0.8276 and cubital y=1.075, the expected 1.5-cun level is y=0.858525; actual is 3.5 mm proximal, about 0.17 cun. Radius FMA23464 has radial extreme [-0.2801,0.8338,0.0178] and distal extreme [-0.2773,0.8296,0.0178], supporting the general radial distal-forearm region. However, landmarks.json contains no APL/EPB tendon coordinates, and the frontal peeled images do not distinguish their groove securely. A labelled radial or oblique tendon view is needed."
    },
    {
      "id": "LU9",
      "whoLocation": "Anterolateral wrist, between radial styloid and scaphoid, in the depression on the ulnar side of the APL tendon.",
      "textMatches": true,
      "textNote": "The bony interval and ulnar side of the named tendon agree with WHO.",
      "verdict": "unclear",
      "error": "The bony level is plausible; placement ulnar to the APL tendon cannot be confirmed.",
      "suggested": null,
      "basis": "Actual [-0.2772,0.8276,0.0461], with skin surface [-0.2772,0.8276,0.0431]. Radius FMA23464 distal extreme is [-0.2773,0.8296,0.0178]. Scaphoid FMA24435 spans y=0.8200–0.8357, with radial extreme [-0.2738,0.8290,0.0231] and anterior extreme [-0.2694,0.8277,0.0265]. Thus the marker fits the radial wrist joint level. PC7 y=0.8310 also supports the crease region. These numbers cannot establish which side of APL the skin marker occupies; a labelled tendon view or tendon mesh coordinates are missing."
    },
    {
      "id": "BL13",
      "whoLocation": "Upper back, level with the inferior border of the T3 spinous process, 1.5 B-cun lateral to the posterior midline.",
      "textMatches": true,
      "textNote": "T3, its spinous lower border and the lateral distance agree with WHO.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0380,1.3351,-0.1221]. T3 FMA9209 spinousLowerBorderY=1.3349, a difference of only 0.2 mm; its spinous tip is [-0.0007,1.3375,-0.0958]. Adjacent T2/T4 lower borders are 1.3602/1.3112, confirming the correct vertebral level. The posterior images support a paraspinal position approximately halfway to the medial scapular border. BL42 [-0.0745,1.3343,-0.1254] corroborates the intended first/second-line spacing, although authored-marker spacing is not an independent skeletal calibration. No numeric scapular-border landmark was supplied, limiting lateral measurement precision."
    }
  ]
}
```