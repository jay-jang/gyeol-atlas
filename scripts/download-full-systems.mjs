import fs from "node:fs/promises";
import { createHash } from "node:crypto";

const commit = "4211d717b0b624604a8bda174ffcae31a76f4581";
const root = `https://raw.githubusercontent.com/Nurkan1/Anatria-3D/${commit}/public/anatomy`;
const expected = {
  nervous_male: "e7a3a2de6c6f098152e3619dd75613531749235cfa9f687d971c8b334a08dcb8",
  cardiovascular_male: "05f373a294ab809b9a628bc1474a66028642997330fddc553a33d4ac6409b757",
};
await fs.mkdir("public/models", { recursive: true });
await fs.mkdir("public/draco", { recursive: true });
for (const [source, sha] of Object.entries(expected)) {
  const response = await fetch(`${root}/${source}.glb`);
  if (!response.ok) throw Error(`${source}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== sha)
    throw Error(`${source}: source hash changed`);
  await fs.writeFile(
    `public/models/${source === "nervous_male" ? "nerve" : "vessel"}-full.glb`,
    bytes,
  );
}
const manifestResponse = await fetch(`${root}/manifest.json`);
if (!manifestResponse.ok) throw Error(`manifest: ${manifestResponse.status}`);
const manifest = await manifestResponse.json();
const nodes = Object.fromEntries(
  ["nervous", "cardiovascular"].map((system) => [
    system === "nervous" ? "nerve" : "vessel",
    manifest.organs.filter((item) => item.system === system).map((item) => item.node),
  ]),
);
await fs.writeFile("data/full-system-nodes.json", JSON.stringify(nodes, null, 2) + "\n");
for (const name of ["draco_decoder.js", "draco_decoder.wasm", "draco_wasm_wrapper.js"])
  await fs.copyFile(`node_modules/three/examples/jsm/libs/draco/gltf/${name}`, `public/draco/${name}`);
console.log(`Downloaded whole-body supplements: nerve ${nodes.nerve.length}, vessel ${nodes.vessel.length}`);
