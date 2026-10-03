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
// Matching vessel names may cover different lengths in these releases, so the
// vascular pairs are independent residual measurements, never fit targets.
// The registration itself is fitted on the shared skeleton
// (fit-male-skeleton-registration.mjs); the four neural centres that defined
// the earlier fit are held out here as well.
export function heldOutResiduals(scale, translation) {
  const measure = p => ({ ...p,
    beforeMm: 1000 * Math.hypot(...p.source.map((v, axis) => v - p.target[axis])),
    afterMm: 1000 * Math.hypot(...p.source.map((v, axis) => v * scale + translation[axis] - p.target[axis])),
  });
  return { neural: neural.map(measure), holdout: pairs.map(measure) };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const registration = JSON.parse(fs.readFileSync("data/catalog/male-registration.json"));
  const residuals = heldOutResiduals(registration.scale, registration.translation);
  if (process.argv.includes("--write")) fs.writeFileSync("data/catalog/male-registration.json", JSON.stringify({ ...registration, ...residuals }, null, 2) + "\n");
  const summary = rows => ({ count: rows.length, meanMm: rows.reduce((n, r) => n + r.afterMm, 0) / rows.length, maxMm: Math.max(...rows.map(r => r.afterMm)) });
  console.log(JSON.stringify({ scale: registration.scale, translation: registration.translation, neural: summary(residuals.neural), holdout: summary(residuals.holdout) }, null, 2));
}
