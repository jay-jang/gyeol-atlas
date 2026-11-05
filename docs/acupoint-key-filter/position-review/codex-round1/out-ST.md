**ST42 is wrong; ST34, ST40, BL21 and CV12 are within the stated educational tolerance.** All five Korean location texts match WHO anatomically.

WHO locations were checked against printed pp. 63, 66, 67, 110 and 225 of the [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf?sequence=1), including the [complete mirrored edition](https://www.medbox.org/index.php/dl/627a4de115110145a1723f64). Coordinates below use the supplied landmarks; additional read-only GLB measurements are identified explicitly. No files were edited.

```json
{
  "zangfu": "ST",
  "points": [
    {
      "id": "ST34",
      "whoLocation": "Anterolateral thigh, in the interval between vastus lateralis and the lateral edge of the rectus femoris tendon, 2 B-cun above the patellar base.",
      "textMatches": true,
      "textNote": "The muscle interval, tendon side and 2-cun distance agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.1040,0.5050,0.0575]. Patella FMA24486 maxY=[-0.0882,0.4503,0.0092], giving 54.7 mm above its base. The anterior iliac extreme FMA16586=[-0.1145,0.9173,0.0555] provides an approximate proximal thigh reference: (0.9173-0.4503)/18=25.9 mm/cun, making the marker approximately 2.11 cun above the base. Muscle image is consistent with the lateral rectus femoris/vastus lateralis interval."
    },
    {
      "id": "ST40",
      "whoLocation": "Anterolateral lower leg, along the lateral edge of tibialis anterior, 8 B-cun above the lateral malleolar prominence.",
      "textMatches": true,
      "textNote": "The defining muscle border and 8-cun height agree. The additional ST35–ST41 measurement instruction does not change the stated target.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.1248,0.2391,-0.0104]; ST38=[-0.1092,0.2399,0.0023], so ST40 is 15.6 mm lateral and essentially level with ST38. The muscle image supports the lateral tibialis anterior border. Additional bone.glb inspection, matching FMA24480 landmark bounds, places the distal fibula's lateral prominence near [-0.1124,0.0659,-0.0476]. With the popliteal reference BL40 y=0.4290, the 16-cun segment gives a midpoint y=0.2474. ST40 is approximately 8.3 mm, or 0.37 cun, inferior to that estimate. The fibular minY=0.0539 is the distal tip, not the lateral prominence."
    },
    {
      "id": "ST42",
      "whoLocation": "Dorsum of the foot, over dorsalis pedis at the articulation between the second metatarsal base and intermediate cuneiform.",
      "textMatches": true,
      "textNote": "The named bones, articulation and arterial landmark agree.",
      "verdict": "wrong",
      "error": "Approximately 52 mm too distal toward the toes: marker z=0.0752 versus the dorsal basal articulation near z=0.023. It overlies the distal metatarsal region rather than the tarsometatarsal joint. Moving proximally also raises the surface-marker y by approximately 34 mm.",
      "suggested": [-0.088, 0.0745, 0.023],
      "basis": "Right marker [-0.0853,0.0408,0.0752]. Second metatarsal FMA24509 has proximal minZ=[-0.0883,0.0448,0.0156], dorsal basal maxY=[-0.0879,0.0617,0.0236], and distal maxZ=[-0.0962,0.0211,0.0838]. Thus the current z is near the head, approximately 52 mm beyond the dorsal base. Additional matching bone.glb inspection finds the intermediate cuneiform FMA24523 anterior extreme [-0.0856,0.0616,0.0234], corroborating the joint level. A downward skin.glb ray at x=-0.088,z=0.023 intersects the outer surface at y=0.0715; suggested y includes the existing 3 mm marker lift. The exact arterial centre is not independently resolved."
    },
    {
      "id": "BL21",
      "whoLocation": "Upper back, level with the lower edge of the T12 spinous process, 1.5 B-cun lateral to the posterior midline.",
      "textMatches": true,
      "textNote": "T12, its spinous lower border and the 1.5-cun lateral offset agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.0380,1.0770,-0.1002]. T12 FMA10081 spinousLowerBorderY=1.0769: only 0.1 mm vertical difference. Its spinous tip y=1.0857 should not replace the lower-border reference. Lateral distance is 38 mm; BL50 at x=-0.0752 corroborates the expected approximately 1:2 line spacing. Additional bone.glb inspection gives the right scapula's most medial extreme x=-0.05936; even that narrow 3-cun reference makes the offset approximately 1.92 cun, within the stated tolerance. The images support the first paraspinal line."
    },
    {
      "id": "CV12",
      "whoLocation": "Upper abdominal midline, 4 B-cun above the umbilical centre; halfway between the umbilicus and xiphisternal junction.",
      "textMatches": true,
      "textNote": "The midline and 4-cun supraumbilical distance agree.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Marker [-0.0001,1.1103,0.1311] is effectively midline. Umbilicus CV8 y=1.0050. Sternal body FMA7487 lower extreme y=1.2006 approximates the xiphisternal junction; xiphoid FMA7488 maxY=1.2046 corroborates this region. Using y=1.2006 gives 24.45 mm/cun and a midpoint target y=1.1028. The marker is 7.5 mm superior, approximately 0.31 cun, within tolerance. The xiphoid tip y=1.1825 is not the junction."
    }
  ]
}
```