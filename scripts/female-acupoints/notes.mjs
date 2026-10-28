// Per-point summary of how the female approximate markers were placed, for the
// point card (the full marker file is fetched only when the markers are shown).
// Reads public/models/acupoint-anchors-female.json and
// data/female-acupoint-rules.json; writes data/female-acupoint-notes.json.
// Usage: node scripts/female-acupoints/notes.mjs
import fs from "node:fs";

const anchors = JSON.parse(fs.readFileSync("public/models/acupoint-anchors-female.json", "utf8"));
const rules = JSON.parse(fs.readFileSync("data/female-acupoint-rules.json", "utf8"));
const byPoint = new Map();
for (const marker of anchors) {
  const row = byPoint.get(marker.pointId) ?? { methods: new Set(), breastSurface: false, facingException: false };
  row.methods.add(marker.method);
  row.breastSurface ||= Boolean(marker.breastSurface);
  row.facingException ||= Boolean(marker.facingException);
  byPoint.set(marker.pointId, row);
}
const pick = (test) => [...byPoint].filter(([, row]) => test(row)).map(([id]) => id).sort();
const ruleMethods = ["female-landmark-cun", "female-landmark-level", "female-landmark"];
const methods = Object.fromEntries(ruleMethods.map((method) => [method, pick((row) => row.methods.has(method))]));
for (const [method, ids] of Object.entries(methods)) for (const id of ids)
  if (byPoint.get(id).methods.size !== 1) throw new Error(`${id}: markers of one point use different methods (${[...byPoint.get(id).methods]}) besides ${method}`);
const notes = {
  source: "public/models/acupoint-anchors-female.json (scripts/build-female-anchors.mjs); data/female-acupoint-rules.json",
  markers: anchors.length,
  methods,
  breastSurface: pick((row) => row.breastSurface),
  facingException: pick((row) => row.facingException),
  regionReference: pick((row) => row.methods.has("field-carried")),
  knownBoundaryFailures: rules.knownBoundaryFailures.map((failure) => failure.pair),
};
fs.writeFileSync("data/female-acupoint-notes.json", JSON.stringify(notes, null, 2) + "\n");
console.log(Object.entries(methods).map(([m, ids]) => `${m} ${ids.length}`).join(", "), "· breast", notes.breastSurface.length, "· facing", notes.facingException.join(","));
