Checked against the [WHO standard](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf) and [KMCRIC’s BL58 entry](https://www.kmcric.com/database/acupoint/BL/BL58). Sacral foramen levels below include a supplementary, read-only measurement of the local bone mesh.

```json
{
  "zangfu": "BL",
  "points": [
    {
      "id": "BL28",
      "whoLocation": "Sacral region, level with the second posterior sacral foramen, 1.5 B-cun lateral to the median sacral crest; level with BL32. WHO printed p.113.",
      "textMatches": true,
      "textNote": "The Korean text specifies the same foramen, level and lateral distance.",
      "verdict": "ok",
      "error": null,
      "suggested": null,
      "basis": "New right marker [-0.038,0.900,-0.1198]. FMA16202 spans y=0.8042–0.9495, but its extrema alone cannot identify individual foramina. A supplementary posterior-surface mesh check locates the second foraminal depression around x=-0.016 to -0.020, y=0.898–0.902; the new marker matches that height. Its 38mm lateral offset agrees with the model's first bladder line and approximately half BL53's 75mm offset. The latter is a consistency check; an independent scapular-width calibration is absent from landmarks2.json.",
      "neighbours": "No reversal or overlap: BL27 y=0.913 > BL28 0.900 > BL29 0.8561. However, BL28 is 9mm above unmoved BL32 (0.891) and 16mm above BL53 (0.884), although WHO places all three at the same level. The BL28–BL29 vertical gap is 43.9mm; mesh evidence places the third foramen around y=0.878–0.882, suggesting BL29 remains too low."
    },
    {
      "id": "BL58",
      "whoLocation": "Posterolateral leg, between the inferior border of the lateral gastrocnemius head and the calcaneal tendon, 7 B-cun proximal to BL60. The note places it 1 B-cun lateral and distal to BL57. WHO printed p.128.",
      "textMatches": true,
      "textNote": "The Korean text matches the tissue interval and WHO's BL57-relative note. It omits the explicit BL60-plus-7-B-cun reference; the full KMCRIC entry includes it.",
      "verdict": "ok",
      "error": null,
      "suggested": null,
      "basis": "New right marker [-0.108,0.227,-0.0988] lies at the lower lateral calf beside the calcaneal tendon in the muscle image. BL40 y=0.429 and BL60 y=0.086 give 1 B-cun=0.02144m and a target y=0.23606: the marker is 9.1mm, approximately 0.42 cun, distal. Using the distal-fibular posterior landmark FMA24480 [-0.1004,0.0757,-0.0565] as an approximate ankle-height reference gives target y=0.23027, only 3.3mm proximal to the marker. Both estimates fall within the stated educational tolerance; the exact malleolar prominence is not separately labelled.",
      "neighbours": "In order, with no overlap: BL57 y=0.262 > BL58 0.227 > BL59 0.176 > BL60 0.086. BL58 is 28.9mm lateral and 35mm distal to BL57, approximately 1.3 and 1.6 cun respectively. Spacing remains inconsistent: BL58–BL59 is only 51mm vertically, approximately 2.38 cun instead of the nominal 4 cun. Unmoved BL59 is 90mm above BL60, approximately 4.20 cun rather than 3; it appears too proximal."
    },
    {
      "id": "BL63",
      "whoLocation": "Dorsum of the foot, distal to the anterior border of the lateral malleolus and posterior to the fifth-metatarsal tuberosity, in the depression below the cuboid. WHO printed p.131.",
      "textMatches": true,
      "textNote": "The Korean text matches all three anatomical relationships.",
      "verdict": "ok",
      "error": null,
      "suggested": null,
      "basis": "New right marker [-0.1247,0.028,-0.016]. FMA24528 cuboid inferior extreme is [-0.0976,0.0284,-0.0145]; the marker has essentially the same inferior level and lies lateral to the cuboid. FMA24515 fifth-metatarsal posterior extreme is [-0.1141,0.027,-0.0122]; the marker is 3.8mm posterior to that base/tuberosity extreme. The skin and bone images support the lateral depression behind the fifth-metatarsal base. Its floating appearance after peeling does not indicate incorrect depth.",
      "neighbours": "In order and separated: BL62 [-0.1105,0.0538,-0.025] to BL63 advances 9mm anteriorly and 25.8mm inferiorly; centre separation is 30.8mm. BL64 is another 30mm anterior, with 34.4mm centre separation from BL63. No BL62–BL64 reversal or marker overlap."
    },
    {
      "id": "BL64",
      "whoLocation": "Lateral foot, distal to the fifth-metatarsal tuberosity, at the junction of dorsal and plantar skin. WHO printed p.131.",
      "textMatches": true,
      "textNote": "The Korean location matches. The supplied whoStandardPage=132 differs from the verified printed page, 131; this is a page-reference issue.",
      "verdict": "ok",
      "error": null,
      "suggested": null,
      "basis": "New right marker [-0.1395,0.020,0.014] is on the low lateral foot, distal to the fifth-metatarsal base. FMA24515 posterior base extreme is [-0.1141,0.027,-0.0122], and its proximal dorsal extreme is [-0.1124,0.0403,0.0066]. The marker is anterior to both and well behind the distal head extreme [-0.1297,0.0167,0.0592]. The skin image supports the low lateral border; the exact dorsal–plantar skin colour junction is not delineated by this model.",
      "neighbours": "BL63–BL64–BL65 remain in anterior order: z=-0.016,0.014,0.0908, without overlap. However, unmoved BL65 is 76.8mm anterior to BL64 and 31.6mm anterior to the entire fifth metatarsal's anterior extreme z=0.0592. This places BL65 too far distally for a point proximal to the fifth metatarsophalangeal joint; its remaining position makes the BL64–BL65 spacing excessive."
    }
  ]
}
```