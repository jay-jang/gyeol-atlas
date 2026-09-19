import fs from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import assert from "node:assert/strict";
const read = file => JSON.parse(fs.readFileSync(file));

test("male organ detail buffers are pinned, indexed correctly and mapped to separate source IDs", () => {
  const source = read("data/catalog/male-detail-source.json");
  for (const file of source.files) assert.equal(createHash("sha256").update(fs.readFileSync(file.path)).digest("hex"), file.sha256);
  const atlas = read("public/models/male-detail/atlas.json");
  const catalog = read("data/male-detail-structures.json");
  const groups = read("data/male-detail-groups.json");
  const bytes = gunzipSync(fs.readFileSync("public/models/male-detail/organs.bin.gz"));
  assert.equal(bytes.length, atlas.chunks[0].bytes);
  assert.equal(atlas.parts.length, 423);
  assert.equal(new Set(atlas.parts.map(p => p.id)).size, 423);
  for (const part of atlas.parts) {
    const item = catalog.find(s => s.id === part.id);
    assert.equal(item.sex, "male"); assert.equal(item.detailOnly, true);
    assert.match(item.id, /^BP4_/);
    assert.ok(groups.find(g => g.id === item.group).ids.includes(item.id));
    for (let i = 0; i < part.vertexCount * 3; i++) assert.ok(Number.isFinite(bytes.readFloatLE(part.positions + i * 4)));
    for (let i = 0; i < part.indexCount; i++) assert.ok(bytes.readUInt32LE(part.indices + i * 4) < part.vertexCount);
  }
  assert.deepEqual(groups.map(g => [g.id, g.ids.length]), [["heart",83],["liver",60],["lung",280]]);
});
