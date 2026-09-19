import fs from "node:fs";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { KHRDracoMeshCompression } from "@gltf-transform/extensions";
import draco from "draco3dgltf";
const io = new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({ "draco3d.decoder": await draco.createDecoderModule() });
const assets = JSON.parse(fs.readFileSync("scripts/model-inputs.json")).assets;
const names = new Map(assets.map(a => [a.id, a.name.toLowerCase()]));
const center = b => b.min.map((v, i) => (v + b.max[i]) / 2);
const normalize = name => name.toLowerCase().replace(/ \(ii\)/, "").replace(/\.l$/, " left").replace(/\.r$/, " right").replace(/^left (.*)/, "$1 left").replace(/^right (.*)/, "$1 right").replace("arch of aorta", "aortic arch").replace("celiac artery", "celiac trunk");
async function entries(file, useIds = false) {
  const doc = await io.read(file);
  return new Map(doc.getRoot().listNodes().filter(n => n.getMesh()).map(n => [normalize(useIds ? names.get(n.getName()) || n.getName() : n.getName()), { id: n.getName(), center: center(getBounds(n)) }]));
}
const target = await entries("public/models/vessel.glb", true);
const source = await entries("public/models/vessel-full.glb");
const pairs = [...target].filter(([name]) => source.has(name)).map(([name, entry]) => ({ name, source: source.get(name).center, target: entry.center }));
const nerveTarget = await entries("public/models/nerve.glb", true), nerveSource = await entries("public/models/nerve-full.glb");
const neural = ["optic nerve left", "optic nerve right"].map(name => ({ name, source: nerveSource.get(name).center, target: nerveTarget.get(name).center }));
for (const name of ["medulla oblongata", "pons"]) {
  const left = nerveSource.get(`${name} left`).center, right = nerveSource.get(`${name} right`).center;
  neural.push({ name, source: left.map((v, i) => (v + right[i]) / 2), target: nerveTarget.get(name).center });
}
// Matching vessel names may cover different lengths in these releases. Use the
// two bilateral optic nerves and brainstem structures to calibrate coordinates;
// retain ALL vascular pairs as independent residual measurements.
const training = neural, holdout = pairs;
const mean = (rows, key) => [0, 1, 2].map(axis => rows.reduce((sum, p) => sum + p[key][axis], 0) / rows.length);
const sm = mean(training, "source"), tm = mean(training, "target");
let numerator = 0, denominator = 0;
for (const p of training) for (let axis = 0; axis < 3; axis++) {
  numerator += (p.source[axis] - sm[axis]) * (p.target[axis] - tm[axis]);
  denominator += (p.source[axis] - sm[axis]) ** 2;
}
const scale = numerator / denominator, translation = tm.map((v, axis) => v - scale * sm[axis]);
const measure = p => ({ ...p,
  beforeMm: 1000 * Math.hypot(...p.source.map((v, axis) => v - p.target[axis])),
  afterMm: 1000 * Math.hypot(...p.source.map((v, axis) => v * scale + translation[axis] - p.target[axis])),
});
const report = { method: "Uniform scale and translation fitted to four named neural centers; vascular pairs held out and may have differing source extents", scale, translation, training: training.map(measure), holdout: holdout.map(measure), neural: neural.map(measure) };
if (process.argv.includes("--write")) fs.writeFileSync("data/catalog/male-registration.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({scale, translation, training: training.length, holdout: report.holdout, neural: report.neural}, null, 2));
