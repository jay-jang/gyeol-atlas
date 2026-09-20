import fs from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import assert from "node:assert/strict";
import test from "node:test";
import { referenceSourceFor, hasMixedReferenceFrames } from "../src/reference-source.ts";
import { initialView, viewReducer, restoreView } from "../src/view-state.ts";

const read = file => JSON.parse(fs.readFileSync(file, "utf8"));
const source = read("data/catalog/female-detail-source.json");
const atlas = read("public/models/female-detail/atlas.json");
const catalog = read("data/female-detail-structures.json");
const groups = read("data/female-detail-groups.json");

test("female CT masks and derived files have traceable licenses, sex and exact hashes", () => {
  assert.equal(source.license, "CC-BY-4.0"); assert.equal(source.subject.gender, "f");
  const record = read("data/catalog/female-ct-record.json");
  assert.equal(record.license.id, "cc-by-4.0"); assert.equal(record.doi, source.doi);
  assert.equal(record.files[0].size, source.archiveBytes);
  assert.equal(source.subject.image_id, "s0255");
  assert.equal(source.rejectedAlignment.acceptedForOverlay, false);
  assert.equal(source.archiveMd5Verified, false);
  assert.equal(catalog.length, 11);
  for (const file of [...source.files, ...source.outputFiles])
    assert.equal(createHash("sha256").update(fs.readFileSync(file.path)).digest("hex"), file.sha256);
  assert.deepEqual(catalog.map(p => p.id).sort(), atlas.parts.map(p => p.id).sort());
  for (const part of catalog) {
    assert.equal(part.sex, "female"); assert.equal(part.detailOnly, true);
    assert.match(part.source, /Wasserthal/);
  }
  for (const group of groups) {
    assert.ok(group.ids.every(id => catalog.some(p => p.id === id)));
    assert.ok(group.ids.every(id => id.startsWith("CTF_")));
    assert.ok(!hasMixedReferenceFrames("female", group.ids));
  }
});

test("every CT vertex remains on a mask crossing edge or in a mixed boundary cell in the unchanged source frame", () => {
  const binary = gunzipSync(fs.readFileSync("public/models/female-detail/ct-supplement.bin.gz"));
  assert.equal(binary.length, atlas.chunks[0].bytes);
  for (const part of atlas.parts) {
    const nifti = gunzipSync(fs.readFileSync(`data/female-ct/s0255/${part.sourceMask}.nii.gz`));
    assert.equal(nifti.readInt32LE(0), 348); assert.equal(nifti.readInt16LE(70), 2);
    assert.equal(nifti.readInt16LE(254), 2);
    const dims = [0,1,2].map(i => nifti.readInt16LE(42 + 2*i));
    const offset = nifti.readFloatLE(108);
    const matrix = [0,1,2].map(a => [0,1,2,3].map(i => nifti.readFloatLE(280 + a*16 + i*4)));
    for (let a=0;a<3;a++) for (let b=0;b<3;b++) if (a!==b) assert.equal(matrix[a][b], 0);
    const value = (x,y,z) => x<0||y<0||z<0||x>=dims[0]||y>=dims[1]||z>=dims[2] ? 0 : nifti[offset+x+dims[0]*(y+dims[1]*z)];
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    for (let i=0;i<part.vertexCount;i++) {
      const p = [0,1,2].map(a => binary.readFloatLE(part.positions + (3*i+a)*4));
      p.forEach((v,a) => { assert.ok(Number.isFinite(v)); min[a]=Math.min(min[a],v); max[a]=Math.max(max[a],v); });
      const q = p.map((v,a) => v-atlas.stageTranslationMeters[a]);
      const ras = [-q[0]*1000,q[2]*1000,q[1]*1000];
      const ijk = ras.map((v,a) => (v-matrix[a][3])/matrix[a][a]);
      const low = ijk.map(Math.floor), frac = ijk.map((v,a) => v-low[a]);
      let interpolated = 0;
      for (let dx=0;dx<2;dx++) for (let dy=0;dy<2;dy++) for (let dz=0;dz<2;dz++)
        interpolated += value(low[0]+dx,low[1]+dy,low[2]+dz)*(dx?frac[0]:1-frac[0])*(dy?frac[1]:1-frac[1])*(dz?frac[2]:1-frac[2]);
      // Lewiner marching cubes also inserts interior vertices in ambiguous
      // cells. Those are not necessarily exact trilinear 0.5 crossings.
      const onEdge = ijk.filter(v => Math.abs(v-Math.round(v))<.0002).length >= 2;
      if (onEdge) assert.ok(Math.abs(interpolated-.5)<.0002, `${part.id}/${i}: mask edge ${interpolated}`);
      else assert.ok(interpolated>0.001 && interpolated<0.999, `${part.id}/${i}: must remain inside a mixed boundary cell`);
    }
    assert.deepEqual([min,max],part.bounds);
    for (let i=0;i<part.indexCount;i++) assert.ok(binary.readUInt32LE(part.indices+4*i)<part.vertexCount);
    if (["stomach","adrenal_gland_left","adrenal_gland_right"].includes(part.sourceMask)) assert.ok(!part.scanBoundary.some(Boolean));
    if (part.scanBoundary.some(Boolean)) assert.match(catalog.find(p => p.id===part.id).label,/CT 수록 구간/);
  }
});

test("CT source transitions restore, reset to HRA and reject mixed stored coordinate frames", () => {
  const detail = { ...groups[0], layers: { ...initialView().layers, skin:false, organ:true } };
  let s = viewReducer(initialView(), {type:"sex",value:"female"});
  s = viewReducer(s,{type:"detail",detail});
  assert.equal(referenceSourceFor(s.sex,s.selection.ids),"female-detail");
  assert.equal(restoreView(JSON.stringify(s),[],catalog).detail.id,"stomach-ct");
  for (const action of [{type:"detail-close"},{type:"dissection",value:66.5},{type:"stage",index:1},{type:"target",value:"skin"}]) {
    const next = viewReducer(s,action);
    assert.equal(referenceSourceFor(next.sex,[...(next.selection?.ids||[]),...(next.detail?.ids||[])]),"female");
  }
  const native = {id:"HRAF_native",layer:"organ",sex:"female"};
  const mixed = {...s,selection:{...s.selection,ids:[...s.selection.ids,native.id]}};
  assert.equal(restoreView(JSON.stringify(mixed),[],[...catalog,native]).selection,null);
});
