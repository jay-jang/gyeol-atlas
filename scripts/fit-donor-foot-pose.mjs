// Offline rigid-foot pose search. Numerical pivots/axes are not validated
// anatomical joint landmarks. Original eight-part foot relationships stay fixed.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute,Box3,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const out='.cache/donor-foot-pose';fs.mkdirSync(out,{recursive:true});
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const input='.cache/donor-feet/audit.json',audit=JSON.parse(fs.readFileSync(input));
for(const f of audit.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(fs.readFileSync(audit.visual.file));
function geometry(p){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));g.computeBoundingBox();return g;}
const skin=geometry(rows.find(p=>p.kind==='skin')),probe=surfaceProbe(skin,.002);
const report={createdAt:new Date().toISOString(),status:'NUMERICAL FOOT POSE SEARCH ONLY; no runtime export or anatomical approval',
  limits:{pitchDegrees:[-55,5],yawDegrees:[-15,15],coarseStepDegrees:5,refinementStepDegrees:1,refinementRadiusDegrees:5},
  sampling:{perFootPart:200,fullReadback:'all referenced vertices of each tested finalist'},sides:[],
  limitations:['Only a common rigid rotation is added to the previous shank similarity; no bone reshaping, extra scale or arbitrary translation.',
    'Pivots are talus bounding-box centre and upper-quarter centre, not an anatomically identified ankle axis.',
    'Pitch uses atlas left/right axis; yaw uses atlas vertical. Search limits are numerical, not physiological ranges.',
    'Sampling finds candidates, not anatomical placement. All finalist foot vertices receive separate skin checks.',
    'Foot versus HRA tibia/fibula intersections are checked; vessels, nerves, muscles and cartilage contacts remain unvalidated.',
    'A zero triangle-crossing count cannot exclude solid containment or prove articular clearance.']};
const outputParts=[];
for(const side of ['left','right']){
  const feet=rows.filter(p=>p.side===side&&p.kind==='donor'&&p.mode==='surface-shank').map(p=>({...p,g:geometry(p)}));assert.equal(feet.length,8);
  const targets=rows.filter(p=>p.side===side&&p.kind==='target').map(p=>({...p,g:geometry(p)}));assert.equal(targets.length,2);
  const talus=feet.find(p=>p.structure==='Talus'),box=talus.g.boundingBox,center=box.getCenter(new Vector3());
  const pivots=[{name:'talus-centre',point:center},{name:'talus-upper-quarter',point:center.clone().setY((center.y+box.max.y)/2)}];
  const samples=feet.flatMap(f=>referencedVertices(f.g,200).map(i=>new Vector3().fromBufferAttribute(f.g.attributes.position,i)));
  const makeMatrix=(pivot,pitch,yaw)=>new Matrix4().makeTranslation(...pivot.toArray())
    .multiply(new Matrix4().makeRotationY(yaw*Math.PI/180)).multiply(new Matrix4().makeRotationX(pitch*Math.PI/180))
    .multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
  const measure=(points,matrix)=>{
    let outside=0,ambiguous=0,sumSquaredExcessMm=0,maxOutsideMm=0;
    for(const p of points){const q=p.clone().applyMatrix4(matrix);q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));const c=probe.classify(q);
      if(c.kind==='outside'){outside++;maxOutsideMm=Math.max(maxOutsideMm,c.distance*1000);sumSquaredExcessMm+=((c.distance-.002)*1000)**2;}
      if(c.kind==='ambiguous')ambiguous++;
    }
    return {vertices:points.length,outside,ambiguous,sumSquaredExcessMm,maxOutsideMm};
  };
  const trials=[],cache=new Map();
  const evaluate=(pivot,pitch,yaw)=>{
    const key=`${pivot.name}/${pitch}/${yaw}`;if(cache.has(key))return cache.get(key);
    const matrix=makeMatrix(pivot.point,pitch,yaw),sample=measure(samples,matrix);
    const row={pivotName:pivot.name,pivotMetres:pivot.point.toArray(),pitch,yaw,matrix:matrix.toArray(),sample};
    trials.push(row);cache.set(key,row);return row;
  };
  for(const pivot of pivots){
    const grid=[];
    for(let pitch=-55;pitch<=5;pitch+=5)for(let yaw=-15;yaw<=15;yaw+=5)grid.push(evaluate(pivot,pitch,yaw));
    const best=grid.sort((a,b)=>a.sample.sumSquaredExcessMm-b.sample.sumSquaredExcessMm)[0];
    for(let pitch=Math.max(-55,best.pitch-5);pitch<=Math.min(5,best.pitch+5);pitch++)
      for(let yaw=Math.max(-15,best.yaw-5);yaw<=Math.min(15,best.yaw+5);yaw++)evaluate(pivot,pitch,yaw);
  }
  // Audit skin-optimal choice per pivot plus the unrotated reference, even if it
  // fails. Do not silently discard a skin winner when its ankle check fails.
  const finalists=pivots.map(p=>trials.filter(t=>t.pivotName===p.name).sort((a,b)=>a.sample.sumSquaredExcessMm-b.sample.sumSquaredExcessMm)[0]);
  finalists.unshift(evaluate(pivots[0],0,0));
  const result={side,trials,finalists:[]};
  for(const [number,c] of finalists.entries()){
    const matrix=new Matrix4().fromArray(c.matrix),transformed=feet.map(f=>({...f,g:f.g.clone().applyMatrix4(matrix)}));
    assert.ok(Math.abs(matrix.determinant()-1)<1e-12);
    const parts=transformed.map(f=>({structure:f.structure,...measure(referencedVertices(f.g,Infinity).map(i=>new Vector3().fromBufferAttribute(f.g.attributes.position,i)),new Matrix4())}));
    const collisions=[];
    for(const f of transformed)for(const t of targets){
      const crossing=triangleCrossings(f.g,t.g);
      if(crossing.intersectingTrianglePairs){
        const a=f.g.clone(),b=t.g.clone();a.boundsTree=new MeshBVH(a);b.boundsTree=new MeshBVH(b);
        const witness=meshCrossingWitness(a,b);a.dispose();b.dispose();
        collisions.push({foot:f.structure,target:t.structure,...crossing,witness});
      }
    }
    const summary={vertices:parts.reduce((n,p)=>n+p.vertices,0),outside:parts.reduce((n,p)=>n+p.outside,0),ambiguous:parts.reduce((n,p)=>n+p.ambiguous,0),
      maxOutsideMm:Math.max(...parts.map(p=>p.maxOutsideMm)),crossingPairs:collisions.filter(c=>c.strictPlaneStraddlingPairs).length};
    result.finalists.push({...c,parts,collisions,summary});console.log(JSON.stringify({side,number,pivot:c.pivotName,pitch:c.pitch,yaw:c.yaw,...summary}));
    for(const f of transformed){outputParts.push({side,variant:number,kind:'donor',structure:f.structure,positions:Array.from(f.g.attributes.position.array),indices:Array.from(f.g.index.array)});f.g.dispose();}
  }
  report.sides.push(result);
  for(const t of targets){outputParts.push({side,variant:'all',kind:'target',structure:t.structure,positions:t.positions,indices:t.indices});t.g.dispose();}feet.forEach(f=>f.g.dispose());
}
outputParts.push({...rows.find(p=>p.kind==='skin'),variant:'all'});
fs.writeFileSync(`${out}/parts.json`,JSON.stringify(outputParts));
report.files=[input,audit.visual.file,'scripts/fit-donor-foot-pose.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs','scripts/lib/triangle-witness.mjs',`${out}/parts.json`].map(file=>({file,sha256:hash(file)}));
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();skin.dispose();
