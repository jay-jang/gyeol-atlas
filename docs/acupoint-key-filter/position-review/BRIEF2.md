# Round 2: verify the corrected markers

Round 1 found these markers away from the WHO 2008 location; their seeds were then re-measured and moved. Check the NEW markers independently with the same rules as round 1 (read BRIEF.md in the same folder first: verdicts ok/minor/wrong/unclear, cun scales, coordinate frame).

For every point in your file:
- `markers` are the new marker positions, `previousMarkers` the old ones (for orientation only; do not assume the new ones are right).
- The images (`images`) show the new markers at skin, muscle and bone depth; landmarks2.json has the bone landmarks and every marker after the change.
- Judge the new placement against the WHO location. Also check the order and spacing against the neighbouring points of the same channel that were NOT moved (for example SP2 must stay distal to SP3, SP5 proximal to SP4; GB40/GB41, LR2/LR3, ST41/ST42/ST43, BL62–BL65). Report any neighbour that is now out of order or overlapping, with numbers; you do not need to fix neighbours, only report them.

Return the same JSON as round 1 per point, plus `neighbours`: a short note on the relation to the unmoved neighbours ("in order" or the problem).
