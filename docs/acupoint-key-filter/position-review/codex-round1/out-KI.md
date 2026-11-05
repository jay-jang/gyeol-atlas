BL23, KI3, KI4 and KI5 are acceptable at educational-marker precision. GB25 needs correction. All five Korean descriptions agree with the [WHO standard, pp. 111, 137–138 and 184](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf).

GB25’s suggested position is an approximate skin projection below the rib tip. I additionally inspected the local skin mesh to estimate its surface depth; the supplied anterior views do not directly expose that posterior landmark. No files were edited.

```json
{
  "zangfu": "KI",
  "points": [
    {
      "id": "BL23",
      "whoLocation": "Lumbar region: 1.5 B-cun lateral to the posterior midline, aligned horizontally with the inferior border of the L2 spinous process (p.111).",
      "textMatches": true,
      "textNote": "The vertebral level, inferior-border landmark and lateral distance agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0380,1.0170,-0.0917]. L2, FMA13073, has spinousLowerBorderY=1.0170: no vertical error. Its spinous tip is [-0.0002,1.0224,-0.0625]; the inferior border, rather than tip height, is correctly used. The 38mm lateral offset is plausible for 1.5 B-cun. BL52 [-0.0746,1.0171,-0.0858] supports consistent first/second bladder-row spacing, although scapular-border coordinates are absent for independent calibration. Images show bilateral lumbar placement."
    },
    {
      "id": "KI3",
      "whoLocation": "Posteromedial ankle: the hollow separating the medial malleolar prominence from the Achilles tendon (p.137).",
      "textMatches": true,
      "textNote": "The same ankle surface, bony prominence and tendon interval are specified.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0405,0.0871,-0.0471]. The distal tibial inferior extreme, FMA24477, is [-0.0562,0.0733,-0.0322]. The marker is 13.8mm above that inferior tip and 14.9mm posterior to it, compatible with the hollow behind the malleolar prominence; the inferior tip itself is not the prominence's height. Skin and peeled views support medial placement between malleolus and heel tendon. Exact tendon-edge coordinates are unavailable, but no wrong-side relationship is apparent."
    },
    {
      "id": "KI4",
      "whoLocation": "Medial foot: behind and below the medial malleolus, above the calcaneus, immediately anterior to the Achilles tendon's medial attachment (p.137).",
      "textMatches": true,
      "textNote": "All named bone and tendon relationships agree; WHO specifies no fixed cun distance here.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0443,0.0659,-0.0648] is 21.2mm below and 17.7mm posterior to KI3. Calcaneus FMA24497 reaches y=0.0610 at [-0.0834,0.0610,-0.0577]; the marker sits 4.9mm higher. Its z is 22.5mm anterior to the calcaneus's posterior extreme [-0.0814,0.0344,-0.0873]. Together with the images, this supports the hollow above the heel bone and anterior to the tendon attachment. Tendon attachment coordinates are not supplied."
    },
    {
      "id": "KI5",
      "whoLocation": "Medial foot: one B-cun below KI3, in the hollow in front of the calcaneal tuberosity (p.138).",
      "textMatches": true,
      "textNote": "The distance and tuberosity relationship agree. The KI3-to-ground three-cun convention is an additional measurement explanation, not a conflicting location.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0395,0.0580,-0.0400]; KI3 [-0.0405,0.0871,-0.0471]. Vertical separation is 29.1mm, matching 0.0871/3=29.0mm under the supplied KI3-to-ground convention. The 7.1mm anterior difference is small for a surface marker. Calcaneus FMA24497 spans y=0.0113–0.0610, with posterior extreme z=-0.0873; KI5 lies at upper-heel height and anterior to the posterior tuberosity region. Images support this relationship."
    },
    {
      "id": "GB25",
      "whoLocation": "Lateral abdomen: immediately below the free tip of rib 12; the locating note places that tip behind the posterior axillary line (p.184).",
      "textMatches": true,
      "textNote": "The Korean description correctly identifies the inferior aspect of the twelfth rib's free end.",
      "verdict": "wrong",
      "error": "Too superior: y=1.0460 is 22.6mm above the distal inferior rib-12 landmark, instead of below it. The proposed target requires 26mm inferior movement, approximately one cun, together with about 26.5mm medial and 33.2mm posterior movement toward the posterolateral skin over the tip. The horizontal/depth correction is approximate.",
      "suggested": [-0.1000, 1.0200, -0.0760],
      "basis": "Right marker [-0.1265,1.0460,-0.0428]. Rib 12, FMA8533, has distal inferior extreme [-0.0794,1.0234,-0.0357], lateral extreme [-0.0833,1.0349,-0.0370], and distal anterior-arc sample [-0.0700,1.0332,-0.0444]. Thus the marker is above the distal rib region. Suggested y=1.0200 is 3.4mm below its inferior extreme. Local skin.glb inspection gives posterior skin z approximately -0.0728 at x=-0.1000,y=1.0200; suggested z=-0.0760 includes approximately 3mm marker clearance. Bone-to-skin depth is accounted for rather than treating the rib's x coordinate as a surface coordinate."
    }
  ]
}
```