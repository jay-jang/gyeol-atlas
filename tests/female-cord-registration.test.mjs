import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferAttribute,BufferGeometry,Int16BufferAttribute} from 'three';
import {applyFemaleCordRegistration,femaleCordShift} from '../src/female-cord-registration.ts';
import {shearPoint} from '../scripts/lib/cord-shear.mjs';

const json=file=>JSON.parse(fs.readFileSync(file));
const atlas=json('public/models/female/atlas-female.json');
const calibration=json('data/catalog/female-cord-registration.json');
const candidate=json('docs/anatomy-alignment/cord-section-grid-shift.json');
const audit=json('docs/anatomy-alignment/cord-section-grid-audit.json');
const neighbors=json('docs/anatomy-alignment/cord-section-grid-neighbors.json');
const sectionGrid=json('docs/anatomy-alignment/cord-section-clearance.json');
const body=json('docs/anatomy-alignment/cord-grid-body-containment.json');
const records=new Map(calibration.records.map(record=>[record.id,record]));
const chunks=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
function geometry(part){
  const b=chunks[part.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  g.setAttribute('normal',new Int16BufferAttribute(Int16Array.from({length:part.vertexCount*3},(_,i)=>b.readInt16LE(part.normals+2*i)),3,true));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  return g;
}
test('female-only cord clearance is pinned to 15 original HRA meshes and exact offline field',()=>{
  assert.equal(createHash('sha256').update(fs.readFileSync('public/models/female/atlas-female.json')).digest('hex'),calibration.sourceManifestSha256);
  assert.equal(records.size,15);assert.equal(calibration.screening.anatomicallyValidated,false);
  assert.deepEqual(calibration.centres,candidate.field.centres);
  assert.equal(calibration.spacing,candidate.field.spacing);
  assert.ok(candidate.field.coefficients.every((v,i)=>v===(i%2?calibration.dzMetres:calibration.dxMetres)));
  const selected=atlas.parts.filter(p=>records.has(p.id));assert.equal(selected.length,15);
  for(const part of selected){
    const g=geometry(part),position=g.attributes.position,normal=g.attributes.normal;
    const before=position.array.slice(),beforeNormal=normal.array.slice(),index=g.index.array.slice();
    assert.equal(part.system,'nervous');
    assert.equal(applyFemaleCordRegistration(g,'female',part.id,part.system),true);
    assert.deepEqual(position.array,before);assert.deepEqual(normal.array,beforeNormal);assert.deepEqual(g.index.array,index);
    const actual=g.attributes.position.array;
    for(let i=0;i<position.count;i++){
      const expected=shearPoint([...before.slice(3*i,3*i+3)],candidate.field).map(Math.fround);
      for(let axis=0;axis<3;axis++)assert.equal(actual[3*i+axis],expected[axis],`${part.id}/${i}/${axis}`);
      const n=g.attributes.normal;
      assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    }
    const copy=actual.slice();assert.equal(applyFemaleCordRegistration(g,'female',part.id,part.system),false);
    assert.deepEqual(g.attributes.position.array,copy);g.dispose();
  }
  for(const mode of audit.modes){
    const [before,after]=mode.runs;
    assert.equal(before.summary.crossingPairs,7);assert.equal(after.summary.crossingPairs,0);
    assert.equal(after.newCrossingPairs.length,0);assert.equal(after.newInternalPairs.length,0);
  }
  assert.equal(sectionGrid.results.filter(r=>r.grid).length,11);
  assert.equal(sectionGrid.results.filter(r=>r.error==='empty cord section').length,3);
  assert.ok(sectionGrid.results.filter(r=>r.grid).every(r=>r.cordNonDegreeTwoNodes===0&&r.bones.every(b=>b.nonDegreeTwoNodes===0)));
  assert.deepEqual([neighbors.summary.candidateCordParts,neighbors.summary.fixedParts,neighbors.summary.evaluatedPairs,
    neighbors.summary.broadPhasePairs,neighbors.summary.beforeCrossingPairs,neighbors.summary.afterCrossingPairs,
    neighbors.summary.newCrossingPairs],[15,1191,17865,91,7,0,0]);
  assert.equal(body.bodies[0].summary.nerve.samples,369522);
  assert.equal(body.bodies[0].summary.nerve.outsideSamples,0);
});
test('cord shear has exact zero support, inverse, normal slope and source guards',()=>{
  for(const y of [1.1,1.32])assert.deepEqual(femaleCordShift(y),{dx:0,dz:0,dxdy:0,dzdy:0});
  for(const y of [1.12,1.135,1.205,1.295]){
    const s=femaleCordShift(y),delta=1e-6,p=femaleCordShift(y+delta),m=femaleCordShift(y-delta);
    assert.ok(Math.abs(s.dxdy-(p.dx-m.dx)/(2*delta))<1e-7);
    assert.ok(Math.abs(s.dzdy-(p.dz-m.dz)/(2*delta))<1e-7);
    const point=[.01,y,-.15],forward=[point[0]+s.dx,y,point[2]+s.dz];
    assert.ok(Math.abs(forward[0]-s.dx-point[0])<1e-15);
    assert.ok(Math.abs(forward[2]-s.dz-point[2])<1e-15);
  }
  const part=atlas.parts.find(p=>records.has(p.id));
  for(const dataset of ['male','female-detail','male-detail']){
    const g=geometry(part),position=g.attributes.position;
    assert.equal(applyFemaleCordRegistration(g,dataset,part.id,part.system),false);
    assert.equal(g.attributes.position,position);g.dispose();
  }
  const wrong=geometry(part);assert.throws(()=>applyFemaleCordRegistration(wrong,'female',part.id,'skeletal'),/출처/);
  wrong.setIndex([0,1,2]);assert.throws(()=>applyFemaleCordRegistration(wrong,'female',part.id,part.system),/버전/);wrong.dispose();
});
