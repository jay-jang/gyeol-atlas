// Whole-foot rigid pose candidate only. Does not change intra-foot geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
const full=process.argv.includes('--all-vertices');for(const a of process.argv.slice(2))assert.equal(a,'--all-vertices');
const out='.cache/bonehub-foot',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const input=`${out}/initial.json`,initial=JSON.parse(fs.readFileSync(input));for(const f of initial.files)assert.equal(hash(f.file),f.sha256,f.file);
const prior=full?JSON.parse(fs.readFileSync(`${out}/pose-sampled.json`)):null;
if(prior)for(const f of prior.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(fs.readFileSync(initial.parts));
const geometry=p=>{const g=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(p.indices);g.computeBoundingBox();return g;};
const skin=geometry(rows.find(p=>p.kind==='skin')),topology=surfaceTopology(skin);assert.equal(topology.connectedComponents,1);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);
const probe=surfaceProbe(skin,.002),output=[],sides=[];
for(const side of ['left','right']){
  const feet=rows.filter(p=>p.side===side&&p.kind==='donor').map(p=>({...p,g:geometry(p)}));assert.equal(feet.length,17);
  for(const f of feet){f.copy=f.g.clone();f.tree=new MeshBVH(f.copy);}
  const bones=rows.filter(p=>p.side===side&&p.kind==='target').map(p=>({...p,g:geometry(p)}));assert.equal(bones.length,2);
  const talus=feet.find(p=>p.structure===`TALUS_${side.toUpperCase()}`),pivot=talus.g.boundingBox.getCenter(new Vector3());
  const points=feet.flatMap(f=>referencedVertices(f.g,full?Infinity:200).map(i=>new Vector3().fromBufferAttribute(f.g.attributes.position,i)));
  const matrix=v=>new Matrix4().makeTranslation(pivot.x+v[0]/1000,pivot.y+v[1]/1000,pivot.z+v[2]/1000)
    .multiply(new Matrix4().makeRotationY(v[4]*Math.PI/180)).multiply(new Matrix4().makeRotationZ(v[5]*Math.PI/180))
    .multiply(new Matrix4().makeRotationX(v[3]*Math.PI/180)).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
  const cache=new Map(),trials=[];
  function evaluate(v){
    const key=v.join('/');if(cache.has(key))return cache.get(key);
    if(Math.hypot(...v.slice(0,3))>15+1e-10||v[3]<-65||v[3]>10||Math.abs(v[4])>25||Math.abs(v[5])>12)return null;
    const m=matrix(v),inverse=m.clone().invert();
    // Hard surface-intersection rejection, before skin objective. Full saved
    // Float32 finalists receive a separate world-space triangle check below.
    const collision=feet.some(f=>bones.some(b=>f.tree.intersectsGeometry(b.g,inverse)));
    let outside=0,ambiguous=0,excess=0;
    for(const p of points){const q=p.clone().applyMatrix4(m);q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));const c=probe.classify(q);
      if(c.kind==='outside'){outside++;excess+=((c.distance-.002)*1000)**2;}if(c.kind==='ambiguous')ambiguous++;}
    const r={parameters:v,collision,outside,ambiguous,sumSquaredExcessMm:excess,regularizer:.002*v.reduce((n,x)=>n+x*x,0)};
    trials.push(r);cache.set(key,r);return r;
  }
  const better=(a,b)=>a && (!b || Number(a.collision)<Number(b.collision) ||
    (a.collision===b.collision && (a.ambiguous<b.ambiguous || (a.ambiguous===b.ambiguous && a.sumSquaredExcessMm+a.regularizer < b.sumSquaredExcessMm+b.regularizer-1e-9))));
  let best=full?evaluate(prior.sides.find(s=>s.side===side).best.parameters):evaluate([0,0,0,0,0,0]);
  if(!full)for(let pitch=-55;pitch<=5;pitch+=5)for(let yaw=-15;yaw<=15;yaw+=5){const candidate=evaluate([0,0,0,pitch,yaw,0]);if(better(candidate,best))best=candidate;}
  const seed=best;
  for(const step of full?[1,.5,.25]:[4,2,1,.5,.25]){
    let changed=true,iteration=0;
    while(changed&&iteration++<50){changed=false;const current=best;
      for(let axis=0;axis<6;axis++)for(const direction of [-1,1]){const v=[...current.parameters];v[axis]+=direction*step;const candidate=evaluate(v);if(better(candidate,best)){best=candidate;changed=true;}}
    }
    console.log(JSON.stringify({side,full,step,iterations:iteration,trials:trials.length,best}));
  }
  const snapshots=[];
  for(const [variant,parameters] of [['unrotated',[0,0,0,0,0,0]],['candidate',best.parameters]]){
    const m=matrix(parameters),parts=[],collisions=[];
    assert.ok(Math.abs(m.determinant()-1)<1e-12);
    for(const f of feet){
      const g=f.g.clone().applyMatrix4(m),r={structure:f.structure,vertices:g.attributes.position.count,outside:0,ambiguous:0,maxOutsideMm:0,witness:null};
      for(let i=0;i<g.attributes.position.count;i++){const p=new Vector3().fromBufferAttribute(g.attributes.position,i),c=probe.classify(p);
        if(c.kind==='outside'){r.outside++;if(c.distance*1000>r.maxOutsideMm){r.maxOutsideMm=c.distance*1000;r.witness={vertex:i,point:p.toArray()};}}if(c.kind==='ambiguous')r.ambiguous++;}
      for(const b of bones){const c=triangleCrossings(g,b.g);if(c.intersectingTrianglePairs)collisions.push({foot:f.structure,target:b.structure,...c});}
      parts.push(r);output.push({side,variant,kind:'donor',structure:f.structure,positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});g.dispose();
    }
    const summary={vertices:parts.reduce((n,p)=>n+p.vertices,0),outside:parts.reduce((n,p)=>n+p.outside,0),ambiguous:parts.reduce((n,p)=>n+p.ambiguous,0),
      maxOutsideMm:Math.max(...parts.map(p=>p.maxOutsideMm)),strictCrossingPairs:collisions.filter(c=>c.strictPlaneStraddlingPairs>0).length};
    snapshots.push({variant,parameters,rigidMatrix:m.toArray(),parts,collisions,summary});console.log(JSON.stringify({side,variant,...summary}));
  }
  sides.push({side,pivot:pivot.toArray(),sampleVertices:points.length,seed,best,trials,snapshots});
  for(const f of feet){f.g.dispose();f.copy.dispose();}for(const b of bones){output.push({...b,g:undefined,variant:'all'});b.g.dispose();}
}
output.push({...rows.find(p=>p.kind==='skin'),variant:'all'});
const mode=full?'full':'sampled',partFile=`${out}/pose-${mode}-parts.json`;fs.writeFileSync(partFile,JSON.stringify(output));
const inputs=[input,initial.parts,'scripts/fit-bonehub-foot-pose.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs',partFile];if(full)inputs.push(`${out}/pose-sampled.json`);
fs.writeFileSync(`${out}/pose-${mode}.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'Whole-foot pose candidate only; no runtime export or anatomical approval',
  fullVertexObjective:full,skinToleranceMm:2,limits:{translationNormMm:15,pitchDegrees:[-65,10],yawDegrees:[-25,25],rollDegrees:[-12,12]},sides,
  limitations:['Rigid motion preserves source foot relationships but does not establish their anatomical correctness.',
    'Pivot and limits are numerical, not measured joint landmarks or physiological ranges.',
    'Candidate ranking prefers no foot-to-tibia/fibula surface intersection, then fewer ambiguous skin classifications, then squared excess over 2mm plus parameter regularizer.',
    'Surface intersection absence does not prove solid separation, cartilage clearance, or muscle/nerve/vessel connections.',
    'Sampled objective is not full containment; all finalist referenced vertices and serialized world triangles are checked separately.'],
  files:inputs.map(file=>({file,sha256:hash(file)}))},null,2)+'\n');probe.dispose();skin.dispose();
