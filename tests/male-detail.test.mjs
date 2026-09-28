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
  assert.equal(atlas.parts.length, 754);
  assert.equal(new Set(atlas.parts.map(p => p.id)).size, 754);
  for (const part of atlas.parts) {
    const item = catalog.find(s => s.id === part.id);
    assert.equal(item.sex, "male"); assert.equal(item.detailOnly, true);
    assert.match(item.id, /^BP4_/);
    assert.ok(groups.find(g => g.id === item.group).ids.includes(item.id));
    for (let i = 0; i < part.vertexCount * 3; i++) assert.ok(Number.isFinite(bytes.readFloatLE(part.positions + i * 4)));
    for (let i = 0; i < part.indexCount; i++) assert.ok(bytes.readUInt32LE(part.indices + i * 4) < part.vertexCount);
  }
  assert.deepEqual(groups.map(g => [g.id, g.ids.length]), [["heart",83],["liver",60],["kidney",35],["stomach",9],["pancreas",2],["pancreas-parenchyma",2],["lung",285],["lung-branches",278]]);
});

test('male kidney detail keeps both organs, ureters and named renal arteries in one selectable source frame',()=>{
  const audit=read('docs/anatomy-alignment/male-kidney-detail-audit.json');
  const official=read('docs/anatomy-alignment/male-kidney-official-v40.json');
  const source=read('data/catalog/male-detail-source.json');
  const catalog=read('data/male-detail-structures.json');
  assert.deepEqual(audit.concepts,['FMA7203','FMA9704','FMA14751','FMA70494','FMA70485','FMA70488','FMA14334']);
  assert.deepEqual(official.rows.map(row=>row.id),audit.concepts);
  assert.match(official.listingSha256,/^[a-f0-9]{64}$/);
  for(const row of official.rows){
    assert.equal(row.official.length,1);
    assert.equal(row.official[0].relation,'is_a');
    assert.deepEqual([...row.official[0].members].sort(),[...row.sourceMembers].sort());
  }
  assert.equal(audit.rows.length,35);
  assert.equal(audit.rows.filter(row=>row.system==='urinary').length,4);
  assert.equal(audit.rows.filter(row=>row.system==='arterial').length,27);
  assert.equal(audit.rows.filter(row=>row.system==='venous').length,4);
  assert.equal(source.structures,754);
  assert.deepEqual(new Set(audit.ids),new Set(audit.rows.map(row=>row.id)));
  for(const row of audit.rows){
    const item=catalog.find(item=>item.id===row.id);
    assert.equal(item.name,row.name);
    assert.equal(item.fmaId,row.conceptId);
    assert.equal(item.group,'kidney');
    assert.match(item.label,/콩팥|요관|신장동맥|신정맥/);
    assert.match(item.description,/연결.*검증한 것은 아닙니다/);
    for(const digest of Object.values(row.fieldSha256))assert.match(digest,/^[a-f0-9]{64}$/);
  }
  const left=audit.rows.filter(row=>(row.name.startsWith('Left ')||row.name.includes('of left renal artery'))&&!row.name.includes('ureter'));
  const right=audit.rows.filter(row=>(row.name.startsWith('Right ')||row.name.includes('of right renal artery'))&&!row.name.includes('ureter'));
  assert.deepEqual([left.length,right.length],[17,16]);
  assert.deepEqual(new Set([...left,...right].map(row=>row.id)),
    new Set(audit.ids.filter(id=>!['BP4_FJ3144','BP4_FJ3146'].includes(id))));
});
