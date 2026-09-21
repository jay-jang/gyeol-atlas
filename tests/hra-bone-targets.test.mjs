import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {gunzipSync} from 'node:zlib';
import {Vector3,Triangle} from 'three';
const read=p=>JSON.parse(fs.readFileSync(p));
const membership=read('docs/anatomy-alignment/hra-bone-targets.json');
const atlas=read('public/models/female/atlas-female.json');

test('source hierarchy retains each femur root and its 15 surface descendants',()=>{
  assert.equal(membership.targets.length,8);
  const ids=new Set();
  for(const target of membership.targets){
    assert.equal(target.members.length,target.bone==='Femur'?16:1);
    assert.equal(target.members[0].id,target.rootId);
    const nodes=new Set(target.members.map(m=>m.nodeIndex));
    for(const [i,m] of target.members.entries()){
      assert.ok(!ids.has(m.id));ids.add(m.id);
      const part=atlas.parts.find(p=>p.id===m.id);assert.equal(part.conceptId,m.conceptId);
      assert.equal(part.system,m.system);
      assert.equal(m.sourceNodeType,i?'surface':'mesh');
      if(i)assert.ok(nodes.has(m.parentIndex));else assert.equal(m.parentIndex,null);
    }
    if(target.bone==='Femur'){
      assert.ok(target.members.some(m=>m.system==='connective'&&m.name.startsWith('Articular cartilage')));
      assert.ok(target.topology.combinedExact.boundaryEdges>0,'Do not represent assembled simplified surfaces as a closed solid');
    }
  }
  assert.equal(ids.size,38);
});

test('unchanged problem points are closer to the composite, by exhaustive triangle search',()=>{
  const visual=read('docs/anatomy-alignment/femur-composite-visual.json');
  const chunks=new Map();
  function distance(point,ids){
    const triangle=new Triangle(),nearest=new Vector3();let minimum=Infinity;
    for(const id of ids){
      const p=atlas.parts.find(p=>p.id===id);
      if(!chunks.has(p.chunk))chunks.set(p.chunk,gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
      const b=chunks.get(p.chunk);
      for(let i=0;i<p.indexCount;i+=3){
        for(const [v,j] of [[triangle.a,0],[triangle.b,1],[triangle.c,2]]){
          const index=b.readUInt32LE(p.indices+4*(i+j));
          v.set(...[0,1,2].map(axis=>b.readFloatLE(p.positions+4*(index*3+axis))));
        }
        triangle.closestPointToPoint(point,nearest);minimum=Math.min(minimum,point.distanceTo(nearest)*1000);
      }
    }
    return minimum;
  }
  for(const row of visual.measurements){
    const w=row.previousWitnessWithSameCoordinates,point=new Vector3(...w.pointMetres);
    assert.ok(Math.abs(distance(point,[row.id])-w.distanceMm)<1e-8);
    assert.ok(Math.abs(distance(point,row.targetIds)-w.compositeDistanceMm)<1e-8);
    assert.ok(w.distanceMm>29&&w.compositeDistanceMm<6);
  }
});

test('hierarchical fits leave shank optimization unchanged but do not approve muscle export',()=>{
  const old=read('docs/anatomy-alignment/joint-bone-surface-fits.json');
  const next=read('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json');
  for(const side of ['left','right']){
    const find=(r,mode)=>r.fits.find(f=>f.side===side&&f.mode===mode);
    assert.deepEqual(find(old,'shank').sourceToAtlasMatrix,find(next,'shank').sourceToAtlasMatrix);
    const femur=find(next,'thigh').bones.find(b=>b.name==='Femur');
    assert.ok(femur.after.forward.p95Mm<5&&femur.after.forward.maximumMm>5);
  }
  const candidate=read('docs/anatomy-alignment/hierarchy-surface-whole-leg-candidate.json');
  assert.equal(candidate.comparisons.length,50);assert.equal(candidate.otherMeshesPerCandidate,1219);
  assert.equal(candidate.hierarchyTargets,true);
  const sum=f=>candidate.comparisons.reduce((s,r)=>s+f(r),0);
  assert.equal(sum(r=>r.skinBefore.outside),3846);assert.equal(sum(r=>r.skinAfter.outside),1566);
  assert.equal(sum(r=>r.skinPointwise.newOutside),873);
  assert.equal(sum(r=>r.skinPointwise.worsenedOutside),418);
  assert.ok(candidate.comparisons.some(r=>r.pairs.some(p=>!p.before&&p.after&&p.system==='skeletal')));
});
