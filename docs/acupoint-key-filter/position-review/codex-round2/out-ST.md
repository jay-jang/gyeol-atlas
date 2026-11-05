Checked against WHO 2008, [ST34, p. 63](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?isAllowed=y&sequence=1#page=83) and [ST42–43, p. 67](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf#page=87). Coordinates below are metres.

```json
{
  "zangfu": "ST",
  "points": [
    {
      "id": "ST34",
      "whoLocation": "WHO 2008, p. 63: Anterolateral thigh, between vastus lateralis and the lateral border of the rectus femoris tendon, 2 B-cun above the patellar base; 1 B-cun directly below ST33.",
      "textMatches": true,
      "textNote": "The Korean text preserves the correct muscle–tendon interval, patellar landmark and 2-cun distance.",
      "verdict": "ok",
      "error": "No material placement error demonstrated.",
      "suggested": null,
      "basis": "Right marker [-0.104, 0.492, 0.0558]. Patella FMA24486 superior extreme is [-0.0882, 0.4503, 0.0092], giving 0.0417 m above the base. Using CV2 y=0.8479 as a provisional pubic-upper-border reference, the WHO pubis-to-patellar-base scale is (0.8479-0.4503)/18=0.02209 m/B-cun. The marker is therefore 1.89 B-cun above the base, only 0.0025 m below the estimated 2-cun level. CV2 is a marker reference, not an independently supplied pubic bone landmark. The muscle image supports placement along the lateral rectus-femoris/vastus-lateralis interval, and the bone image confirms the suprapatellar level.",
      "neighbours": "In order and not overlapping: ST33 y=0.550 > ST34 y=0.492 > ST35 y=0.432. However, unmoved ST33 [-0.105,0.550,0.0594] is 0.058 m above ST34, approximately 2.63 B-cun rather than WHO's 1 B-cun; its level is approximately 4.51 B-cun above the patellar base rather than 3. Unmoved ST35 is also suspiciously high: y=0.432 is 0.0214 m above the patellar inferior extreme y=0.4106, whereas its landmark is lateral to the infrapatellar ligament. These neighbour issues do not justify moving the corrected ST34."
    },
    {
      "id": "ST42",
      "whoLocation": "WHO 2008, p. 67: Dorsum of the foot, over the dorsalis pedis artery at the articulation between the second metatarsal base and intermediate cuneiform.",
      "textMatches": true,
      "textNote": "The Korean text identifies the same articulation and arterial landmark.",
      "verdict": "ok",
      "error": "No material placement error demonstrated at educational surface-marker precision.",
      "suggested": null,
      "basis": "Right marker [-0.086,0.0756,0.022], with skin surfacePoint [-0.086,0.0726,0.022]. Second metatarsal FMA24509 has its proximal/posterior extreme at [-0.0883,0.0448,0.0156] and superior extreme near its base at [-0.0879,0.0617,0.0236]. The marker's skin position is only 0.0019 m medial and 0.0016 m posterior to that superior-base reference in x/z, with 0.0109 m of dorsal soft-tissue separation in y. The three images support the proximal second-metatarsal region rather than its head or ankle joint. Intermediate-cuneiform coordinates and an arterial centreline are absent, so exact joint-line and artery registration remain unverified.",
      "neighbours": "In order and not overlapping: ST41 [-0.0896,0.0932,-0.0023] is proximal to ST42, which is proximal to ST43 [-0.0865,0.0283,0.1041]. ST41–ST42 separation is 0.0302 m. ST42–ST43 separation is 0.0948 m, and unmoved ST43 appears too distal: its z=0.1041 exceeds the entire second-metatarsal anterior bound z=0.0838 by 0.0203 m and the third-metatarsal bound z=0.0801 by 0.0240 m, despite WHO requiring a site proximal to the second MTP joint. Its x=-0.0865 is also medial to the second/third distal bone references x=-0.0962/-0.1059, rather than between them. Thus channel order is preserved, but ST43's position and the resulting spacing require separate review."
    }
  ]
}
```