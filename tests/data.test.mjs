import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { NodeIO } from "@gltf-transform/core";
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const points = read("data/points.json"),
  meridians = read("data/meridians.json"),
  sources = read("data/sources.json"),
  docs = read("data/wiki.json"),
  manifest = read("public/models/manifest.json");
test("every point has valid source, atlas structure and a linked wiki article", () => {
  assert.equal(new Set(points.map((p) => p.id)).size, 409);
  assert.equal(new Set(points.map((p) => p.meridian)).size, 15);
  assert.equal(
    meridians.filter(m => m.id !== "EX").reduce((a, m) => a + m.total, 0),
    361,
  );
  const structures = new Set(manifest.assets.map((a) => a.id));
  const sourceIds = new Set(sources.map((s) => s.id));
  for (const p of points) {
    assert.ok(Array.isArray(p.structures));
    assert.ok(p.location.length > 5 && p.nameSource.startsWith("https://www.kmcric.com/"));
    for (const id of p.structures)
      assert.ok(structures.has(id), `${p.id} references missing ${id}`);
    for (const id of p.sourceIds) assert.ok(sourceIds.has(id));
    assert.ok(docs.some((d) => d.pointId === p.id));
    assert.ok(p.position.every(Number.isFinite));
    assert.equal(p.coordinateStatus, "illustrative");
    assert.ok(p.page === null || p.page > 0);
    if (p.catalogue === "extra") assert.equal(p.page, null);
    for (const id of p.related) assert.ok(points.some((p) => p.id === id));
  }
});
test("wiki exports match canonical data and all links resolve", () => {
  assert.deepEqual(read("public/wiki/index.json"), docs);
  for (const d of docs) {
    for (const id of d.sourceIds)
      assert.ok(
        sources.some((s) => s.id === id),
        `${d.id}: missing source ${id}`,
      );
    assert.equal(fs.readFileSync(`public/wiki/${d.id}.md`, "utf8"), d.body);
    for (const link of d.links) assert.ok(docs.some((x) => x.id === link));
    for (const backlink of d.backlinks)
      assert.ok(docs.find((x) => x.id === backlink).links.includes(d.id));
  }
});
test("bundled GLB files contain real named meshes and stay within the delivery budget", async () => {
  let bytes = 0;
  for (const layer of ["skin", "bone", "muscle", "organ", "vessel", "nerve"]) {
    const file = `public/models/${layer}.glb`;
    const data = fs.readFileSync(file);
    assert.equal(data.readUInt32LE(0), 0x46546c67);
    bytes += data.length;
    const doc = await new NodeIO().read(file);
    const meshes = doc.getRoot().listMeshes();
    assert.equal(
      meshes.length,
      manifest.assets.filter((a) => a.layer === layer).length,
    );
    for (const m of meshes) {
      assert.ok(manifest.assets.some((a) => a.id === m.getName()));
      const prim = m.listPrimitives()[0];
      assert.ok(prim.getAttribute("POSITION").getCount() > 20);
      assert.ok(prim.getIndices().getCount() > 50);
    }
  }
  assert.ok(bytes < 52_000_000, `Model payload ${bytes}`);
  assert.equal(manifest.assets.length, 1179);
  assert.equal(manifest.license, "CC-BY-SA-2.1-JP");
  for (const a of manifest.assets) {
    assert.match(a.sha256, /^[a-f0-9]{64}$/);
    assert.ok(a.sourceVersion === "4.3" ? a.sourceUrl === "https://lifesciencedb.jp/bp3d/download.cgi" : a.sourceUrl.includes(manifest.commit));
    assert.ok(a.triangles <= a.originalTriangles);
  }
  const fullSystems = read("data/catalog/full-system-supplement.json");
  for (const asset of fullSystems.assets) {
    const data = fs.readFileSync(asset.path);
    assert.equal(data.readUInt32LE(0), 0x46546c67);
    assert.equal(crypto.createHash("sha256").update(data).digest("hex"), asset.sha256);
  }
  assert.equal(fullSystems.assets.find((a) => a.path.includes("nerve"))?.structures, 525);
  assert.equal(fullSystems.assets.find((a) => a.path.includes("vessel"))?.structures, 640);
  const fullCatalog = read("data/full-system-structures.json");
  const fullNodes = read("data/full-system-nodes.json");
  assert.equal(fullCatalog.length, 1165);
  assert.equal(new Set(fullCatalog.map((item) => item.id)).size, 1165);
  assert.equal(fullCatalog.filter((item) => item.layer === "nerve").length, 525);
  assert.equal(fullCatalog.filter((item) => item.layer === "vessel").length, 640);
  for (const layer of ["nerve", "vessel"])
    assert.deepEqual(
      new Set(fullCatalog.filter((item) => item.layer === layer).map((item) => item.node)),
      new Set(fullNodes[layer]),
    );
  for (const item of fullCatalog) {
    assert.ok(item.name && item.label && item.node && item.description);
    assert.ok(item.hierarchy.length > 0);
    assert.match(item.id, /^ZA_(nerve|vessel)_/);
    assert.equal(item.source, "Z-Anatomy / Anatria-3D");
  }
  assert.equal(fullCatalog.find((item) => item.name === "Abdominal aorta")?.label, "복부대동맥");
  assert.equal(fullCatalog.find((item) => item.name === "Sciatic nerve (left)")?.label, "왼쪽 좌골신경");
});

test("all 834 bilateral/multiple-location anchors are on the bundled skin surface before display offset", async () => {
  const { Vector3, Triangle } = await import("three");
  const anchors = read("data/anchors.json");
  assert.equal(anchors.length, 834);
  assert.deepEqual(read("public/models/acupoint-anchors.json"), anchors);
  const doc = await new NodeIO().read("public/models/skin.glb");
  const prim = doc.getRoot().listMeshes()[0].listPrimitives()[0];
  const positions = prim.getAttribute("POSITION").getArray(),
    indices = prim.getIndices().getArray();
  const triangle = new Triangle(),
    closest = new Vector3();
  for (const a of anchors) {
    const point = points.find((p) => p.id === a.pointId);
    assert.ok(point);
    assert.equal(
      anchors.filter((x) => x.pointId === a.pointId).length,
      point.markerCount,
    );
    const target = new Vector3(...a.surfacePoint);
    let distance = Infinity;
    for (let k = 0; k < indices.length; k += 3) {
      triangle.a.fromArray(positions, indices[k] * 3);
      triangle.b.fromArray(positions, indices[k + 1] * 3);
      triangle.c.fromArray(positions, indices[k + 2] * 3);
      triangle.closestPointToPoint(target, closest);
      distance = Math.min(distance, closest.distanceTo(target));
      if (distance < 1e-7) break;
    }
    assert.ok(
      distance < 1e-6,
      `${a.pointId} ${a.side} is off the skin by ${distance}`,
    );
    assert.ok(
      Math.abs(new Vector3(...a.position).distanceTo(target) - 0.003) < 1e-8,
    );
    assert.equal(a.status, "illustrative-unreviewed");
    if (a.side === "right") assert.ok(a.position[0] < 0);
    if (a.side === "left") assert.ok(a.position[0] > 0);
  }
});

test("complete Yuan and Mu sets are distinct from Shu and traditional organ mappings remain valid", () => {
  const map = read("data/point-concepts.json");
  const yuan = [
    "LU9",
    "LI4",
    "ST42",
    "SP3",
    "HT7",
    "SI4",
    "BL64",
    "KI3",
    "PC7",
    "TE4",
    "GB40",
    "LR3",
  ];
  const mu = [
    "LU1",
    "ST25",
    "CV12",
    "LR13",
    "CV14",
    "CV4",
    "CV3",
    "GB25",
    "CV17",
    "CV5",
    "GB24",
    "LR14",
  ];
  for (const [category, expected] of [
    ["yuan", yuan],
    ["mu", mu],
  ])
    assert.deepEqual(
      points
        .filter((p) => map[p.id].categories.includes(category))
        .map((p) => p.id)
        .sort(),
      expected.sort(),
    );
  assert.ok(map.SI3.categories.includes("five-shu"));
  assert.ok(!map.SI3.categories.includes("yuan"));
  assert.equal(map.ST25.traditionalChannel, "LI");
  assert.deepEqual(map.CV17.organIds, []);
  assert.deepEqual(map.CV5.organIds, []);
  for (const p of points) {
    assert.ok(map[p.id]);
    for (const id of map[p.id].organIds)
      assert.ok(
        manifest.assets.some((a) => a.id === id && a.layer === "organ"),
      );
  }
  const layers = Object.fromEntries(
    ["skin", "bone", "muscle", "organ", "vessel", "nerve"].map((l) => [
      l,
      manifest.assets.filter((a) => a.layer === l).length,
    ]),
  );
  assert.deepEqual(layers, {
    skin: 1,
    bone: 278,
    muscle: 437,
    organ: 67,
    vessel: 56,
    nerve: 340,
  });
});
