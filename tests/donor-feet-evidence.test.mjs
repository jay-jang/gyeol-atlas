import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../docs/anatomy-alignment/${name}`,import.meta.url)));
test('female foot evidence preserves six rejected candidates and exact source-serialization scope',()=>{
  const a=read('donor-feet-audit.json'),r=read('donor-feet-readback.json'),v=read('donor-feet-visual.json');
  const sha=createHash('sha256').update(fs.readFileSync(new URL('../docs/anatomy-alignment/donor-feet-audit.json',import.meta.url))).digest('hex');
  assert.equal(r.files.find(f=>f.file.endsWith('/audit.json')).sha256,sha);
  assert.equal(v.files.find(f=>f.file.endsWith('/audit.json')).sha256,sha);
  assert.equal(a.inventory.length,20);assert.equal(a.baseline.length,56);assert.equal(a.candidates.length,6);
  assert.deepEqual(a.candidates.map(c=>c.summary.outside),[29948,19800,19374,24199,18944,19874]);
  for(const c of a.candidates){assert.equal(c.evaluatedFootPairs,28);assert.equal(c.summary.ambiguous,0);assert.ok(c.summary.maxOutsideMm>70);}
  assert.equal(r.totalTriangleCornerOccurrences,1489212);assert.equal(r.maximumResidualMetres,0);assert.equal(r.records.length,48);
  assert.equal(v.captures.length,4);assert.deepEqual(v.errors,[]);
  assert.deepEqual(a.inventory.filter(p=>p.structure==='Phalanges').map(p=>p.componentsMillimetres.length),[5,1]);
});
test('Original Phalanges remains an aggregate; fragments are not individually named toe bones',()=>{
  const a=read('donor-foot-originals.json');assert.equal(a.parts.length,2);
  assert.deepEqual(a.parts.map(p=>p.components.length),[6,1]);
  assert.deepEqual(a.parts.map(p=>p.ascii.triangles),[248168,255720]);
  assert.ok(a.parts.every(p=>p.float32ComponentCountsAgree));
  assert.equal(a.parts[0].components[0].triangles,248072);
  assert.equal(a.parts[1].components[0].triangles,255720);
  for(const p of a.parts)assert.equal(p.components.reduce((n,c)=>n+c.triangles,0),p.ascii.triangles);
});
