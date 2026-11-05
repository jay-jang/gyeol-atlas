Reference: [WHO 2008, printed pp. 153–154](https://iris.who.int/bitstream/handle/10665/353407/9789290613831-eng.pdf).

```json
{
  "zangfu": "PC",
  "points": [
    {
      "id": "PC4",
      "whoLocation": "WHO 2008, p.153: Palm-facing forearm, between palmaris longus and flexor carpi radialis tendons, five B-cun wrist-to-elbow from the palmar wrist crease. The locating note places it one B-cun wristward of the PC3–PC7 midpoint.",
      "textMatches": true,
      "textNote": "The Korean text agrees on the surface, tendon interval, reference crease and five-cun distance.",
      "verdict": "ok",
      "error": "No displacement exceeding the educational tolerance is demonstrated. The marker is near the palmaris-longus edge of the tendon interval; its longitudinal level is correct.",
      "suggested": null,
      "basis": "Right PC4 is [-0.2225,0.934,0.0262], with skin surface [-0.2225,0.934,0.0232]. Using PC3 y=1.0771 and PC7 y=0.831 gives 0.02051 m per longitudinal B-cun: PC4 is 5.02 B-cun above the wrist, versus target y=0.93354. Distal radius FMA23464 minY=0.8296 and distal ulna FMA23467 minY=0.8288 corroborate the wrist level. The three images support an anterior forearm location. Additional read-only inspection of public/models/muscle.glb resolves the transverse position: at y=0.934, right palmaris longus FMA38463 spans x=-0.22262 to -0.21758, while right flexor carpi radialis FMA38460 spans x=-0.24354 to -0.22239. PC4 lies at their adjoining margins, within approximately 6 mm of the interval between their anterior prominences, below 0.5 B-cun. Straight interpolation between the hand-authored PC3 and PC7 markers instead predicts x=-0.24542, 22.9 mm radial to PC4; that line conflicts with the named muscle geometry and is not sufficient evidence to reject this placement.",
      "neighbours": "In proximal-to-distal order, without overlap: PC3 y=1.0771 > PC4 0.934 > PC5 0.899 > PC6 0.8799 > PC7 0.831. Longitudinal PC4–PC5 spacing is 35 mm (1.71 B-cun; standard 2), and PC4–PC6 is 54.1 mm (2.64 B-cun; standard 3). There is a transverse kink: unmoved PC5 x=-0.255 and PC6 x=-0.253 are respectively 32.5 and 30.5 mm radial to PC4. They also sit radial to the corresponding FCR mesh limits, x=-0.24841 and -0.25109. Their transverse alignment warrants separate review."
    }
  ]
}
```