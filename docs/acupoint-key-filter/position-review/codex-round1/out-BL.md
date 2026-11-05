BL28, BL58 and CV3 are acceptable educational approximations. BL63 and BL64 need repositioning. All five Korean descriptions agree with WHO; BL58 omits supplementary measurements without contradicting them.

WHO printed pages are BL28 **113**, BL58 **128**, BL63/BL64 **131**, and CV3 **221**. Thus BL64’s input page 132 needs correction. Sources: [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf), [WHO text mirror, including CV3](https://www.medbox.org/index.php/dl/627a4de115110145a1723f64).

Suggested coordinates are approximate surface targets. Bone extrema identify regions; they are not separately annotated landmark centres.

```json
{
  "zangfu": "BL",
  "points": [
    {
      "id": "BL28",
      "whoLocation": "WHO p.113: Sacral region, level with the second posterior sacral foramen, 1.5 B-cun lateral to the median sacral crest.",
      "textMatches": true,
      "textNote": "The Korean text specifies the same sacral foramen, level and lateral distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.038,0.885,-0.1324] is in the appropriate posterior sacral region. BL32 is [-0.024,0.891,-0.1189], so BL28 is only 6 mm inferior to the model's second-foramen marker, within approximately 0.25 cun. Its 38 mm midline offset is approximately half BL53's 75 mm outer-row offset. Bone-depth appearance supports the sacral level. FMA16202 sacrum spans y=0.8042–0.9495. Confidence is moderate: actual foramen centres and the scapular medial border are not numerically annotated, so neighbouring markers provide supporting consistency rather than independent anatomical proof."
    },
    {
      "id": "BL58",
      "whoLocation": "WHO p.128: Posterolateral leg, between the inferior border of the lateral gastrocnemius head and the calcaneal tendon, level with 7 B-cun proximal to BL60.",
      "textMatches": true,
      "textNote": "The muscle–tendon interval and 1-cun distal relationship to BL57 agree. WHO additionally specifies the 7-B-cun level above BL60 and a lateral relationship to BL57; their omission is not a conflicting location.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Right marker [-0.108,0.239,-0.1012] is 23 mm distal and 28.9 mm lateral to BL57 [-0.0791,0.262,-0.1105], consistent with the posterolateral muscle–tendon transition visible in the muscle image. Using BL40 y=0.429 and FMA24480 lateralmost distal fibular point [-0.1004,0.0757,-0.0565] gives approximately 22.1 mm per leg B-cun. Applying 7 cun above BL60 y=0.086 predicts y=0.2406; actual y=0.239 differs by only 1.6 mm."
    },
    {
      "id": "BL63",
      "whoLocation": "WHO p.131: Foot dorsum, distal to the lateral malleolus's anterior border, posterior to the fifth-metatarsal tuberosity, in the depression inferior to the cuboid.",
      "textMatches": true,
      "textNote": "The Korean text preserves all three bony relationships.",
      "verdict": "wrong",
      "error": "The marker is too superior, approximately 15–20 mm, and too anterior, approximately 10–18 mm. It lies beside the cuboid's higher portion rather than in the inferior depression posterior to the fifth-metatarsal tuberosity.",
      "suggested": [-0.118, 0.027, -0.018],
      "basis": "Current right marker is [-0.1174,0.0468,0]. FMA24528 cuboid lateral extreme is [-0.1128,0.0355,-0.0014], inferior extreme [-0.0976,0.0284,-0.0145], and posterior extreme [-0.1025,0.0403,-0.0216]. The marker is 11.3 mm above even the lateral extreme and 18.4 mm above the inferior extreme. FMA24515 fifth metatarsal's posterior basal projection, used as a tuberosity proxy, is [-0.1141,0.027,-0.0122]; the marker is anterior to that projection. The suggested target lowers the marker to the lateral cuboid's inferior region and places it behind the basal projection. Exact tuberosity and skin coordinates remain approximate."
    },
    {
      "id": "BL64",
      "whoLocation": "WHO p.131: Lateral foot, immediately distal to the fifth-metatarsal tuberosity, at the red–white flesh border.",
      "textMatches": true,
      "textNote": "The Korean location matches. The input's whoStandardPage=132 should be 131.",
      "verdict": "wrong",
      "error": "Approximately 65–75 mm too distal toward the toes, with an additional medial/dorsal displacement. It is in the forefoot rather than immediately distal to the fifth-metatarsal base.",
      "suggested": [-0.124, 0.024, 0.004],
      "basis": "Current right marker [-0.1115,0.0302,0.0777] has z=0.0777, whereas the entire FMA24515 fifth metatarsal ends anteriorly at [-0.1297,0.0167,0.0592]. Thus the marker is already 18.5 mm anterior to that bone's distal extreme. Its posterior basal projection is [-0.1141,0.027,-0.0122], and its proximal dorsal extreme is [-0.1124,0.0403,0.0066]. A target near z=0.004 places BL64 just distal to the basal projection, on the lateral skin margin. The correction is approximately 74 mm posterior and 12.5 mm lateral; final skin contact and the flesh border require a surface check."
    },
    {
      "id": "CV3",
      "whoLocation": "WHO p.221: Lower abdomen on the anterior median line, 4 B-cun inferior to the umbilical centre.",
      "textMatches": true,
      "textNote": "The Korean text specifies the same midline and 4-cun distance.",
      "verdict": "ok",
      "error": "",
      "suggested": null,
      "basis": "Marker [0,0.8749,0.1019] is on the anterior midline. CV8 gives the supplied umbilical reference y=1.005. Using CV2 y=0.8479 as the model's pubic-upper-border proxy gives 1 B-cun=(1.005-0.8479)/5=0.03142 m and expected CV3 y=0.87932. Actual CV3 is 4.42 mm inferior, approximately 0.14 cun, comfortably within tolerance. Skin and muscle views agree with the lower abdominal midline. The pubic upper border is not independently annotated in the bone extrema, so the proportional calculation is conditional on CV2's reference placement."
    }
  ]
}
```