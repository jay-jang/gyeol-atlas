import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const atlas = read("public/models/female/atlas-female.json");
const catalog = read("data/female-atlas-structures.json");
const groups = read("data/female-organ-groups.json");
const bounds = new Map();

test("female source hashes, every index and actual vertex bounds match the pinned source", () => {
  for (const file of read("data/catalog/female-atlas-source.json").files)
    assert.equal(createHash("sha256").update(fs.readFileSync(file.path)).digest("hex"), file.sha256);
  const buffers = atlas.chunks.map(chunk => {
    const result = gunzipSync(fs.readFileSync(`public/models/female/${chunk.gzip.split("/").pop()}`));
    assert.equal(result.length, chunk.bytes);
    return result;
  });
  for (const part of atlas.parts) {
    const bytes = buffers[part.chunk];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < part.vertexCount; i++) for (let axis = 0; axis < 3; axis++) {
      const value = bytes.readFloatLE(part.positions + (i * 3 + axis) * 4);
      assert.ok(Number.isFinite(value), part.id);
      min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
    }
    for (let i = 0; i < part.indexCount; i++) assert.ok(bytes.readUInt32LE(part.indices + i * 4) < part.vertexCount, part.id);
    for (let axis = 0; axis < 3; axis++) {
      // Source bounds predate simplification; five meshes lose an extremity
      // (largest 7.864mm). They must remain inside the authored envelope.
      assert.ok(min[axis] >= part.bounds[0][axis] - .000002, `${part.id} min axis ${axis}`);
      assert.ok(max[axis] <= part.bounds[1][axis] + .000002, `${part.id} max axis ${axis}`);
      assert.ok(max[axis] >= part.bounds[0][axis] && min[axis] <= part.bounds[1][axis], part.id);
    }
    bounds.set(part.id, [min, max]);
  }
  assert.equal(bounds.size, 1220);
});

test("female organ groups match source hierarchy and have no male organs", () => {
  assert.deepEqual(catalog.map(p => p.id).sort(), atlas.parts.map(p => p.id).sort());
  for (const group of groups) {
    const actual = [...new Set(group.sourceConcepts.flatMap(id => atlas.concepts.find(c => c.id === id).elements))].sort();
    assert.deepEqual([...group.ids].sort(), actual);
    for (const id of group.ids) assert.equal(catalog.find(p => p.id === id)?.sex, "female");
  }
  assert.equal(catalog.filter(p => /penis|prostate|testis|seminal vesicle/i.test(p.name)).length, 0);
  assert.equal(atlas.parts.filter(p => p.system === "borrowed" && !catalog.find(s => s.id === p.id)?.source.includes("남성 유래 보완 골격")).length, 0);
  // Do not relabel a gastric impression/surface as a missing stomach.
  assert.equal(groups.some(group => group.id === "stomach"), false);
});

test("brain is within the head, major organs are within the female body bounds", () => {
  const skin = atlas.parts.find(part => part.name === "Skin").bounds;
  for (const group of groups) for (const id of group.ids) {
    const b = bounds.get(id);
    assert.ok(b, `${id}: geometry not audited`);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(b[0][axis] >= skin[0][axis] - .025, `${group.id}/${id} outside body min`);
      assert.ok(b[1][axis] <= skin[1][axis] + .025, `${group.id}/${id} outside body max`);
    }
    if (group.id === "brain") assert.ok(b[0][1] > 1.45 && b[1][1] < 1.72, id);
    if (group.id === "uterus") assert.ok(b[0][1] > .65 && b[1][1] < 1, id);
  }
});
