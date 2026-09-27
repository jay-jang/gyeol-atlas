// Bounded rigid refinement of whole-foot candidates. No runtime export.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
const out='.cache/donor-foot-pose',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const full=process.argv.includes('--all-vertices');
const hard=process.argv.includes('--hard-clearance');assert.ok(!hard||full,'Hard clearance requires full-vertex skin objective');
for(const arg of process.argv.slice(2))assert.ok(['--all-vertices','--hard-clearance'].includes(arg));
const suffix=hard?'refined-hard':full?'refined-full':'refined';
const prior=JSON.parse(fs.readFileSync(`${out}/report.json`));for(const f of prior.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(fs.readFileSync(`${out}/parts.json`));
const geometry=p=>{const g=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3));g.setIndex(new BufferAttribute(new Uint32Array(p.indices),1));g.computeBoundingBox();return g;};
const skin=geometry(rows.find(p=>p.kind==='skin')),probe=surfaceProbe(skin,.002);
const report={createdAt:new Date().toISOString(),status:'BOUNDED RIGID REFINEMENT ONLY; no runtime export or anatomical approval',
  bounds:{translationNormMm:12,pitchYawRollDegrees:8},sampling:full?'all referenced foot and talus vertices':'deterministic index samples',sampleCountPerPart:full?null:200,ankleSampleCount:full?null:1200,hardSurfaceClearance:hard,sides:[],
  objective:hard?'Reject foot-to-tibia/fibula surface intersections, then sum squared skin excess beyond 2mm + 100 times squared talus penetration beyond 0.25mm + 0.002 times squared translation(mm)/rotation(deg)':'sum squared skin excess beyond 2mm + 100 times squared sampled bone penetration beyond 0.25mm + 0.002 times squared translation(mm)/rotation(deg)',
  limitations:['The rotation pivots and angle limits remain numerical, not validated anatomical axes or ranges.',
    'Pattern search is local and cannot prove that no acceptable global rigid alignment exists.',
    'Bone volume classification requires a closed single-component target, but does not validate anatomy or articular contact.',
    'Only talus vertices influence the bone penalty; full finalist foot-to-tibia/fibula surface tests are recorded separately.',
    'Skin fitting uses the already modified HRA outer surface, not a clinical target or independent source scan.',
    'Muscle attachments, nerves, vessels, cartilage and other whole-body tissues remain unvalidated.']};
const output=[];
for(const side of prior.sides){
  const chosen=side.finalists.map((f,i)=>({f,i})).filter(({i})=>i>0).sort((a,b)=>a.f.parts.reduce((n,p)=>n+p.sumSquaredExcessMm,0)-b.f.parts.reduce((n,p)=>n+p.sumSquaredExcessMm,0))[0];
  const feet=rows.filter(p=>p.side===side.side&&p.kind==='donor'&&p.variant===chosen.i).map(p=>({...p,g:geometry(p)}));assert.equal(feet.length,8);
  if(hard)for(const f of feet){f.collisionGeometry=f.g.clone();f.tree=new MeshBVH(f.collisionGeometry);}
  const bones=rows.filter(p=>p.side===side.side&&p.kind==='target').map(p=>({...p,g:geometry(p)}));assert.equal(bones.length,2);
  for(const bone of bones){bone.topology=surfaceTopology(bone.g);assert.equal(bone.topology.connectedComponents,1);assert.equal(bone.topology.boundaryEdges,0);assert.equal(bone.topology.nonManifoldEdges,0);bone.probe=surfaceProbe(bone.g,.00025);}
  const talus=feet.find(p=>p.structure==='Talus'),pivot=talus.g.boundingBox.getCenter(new Vector3());
  const samples=feet.flatMap(f=>referencedVertices(f.g,full?Infinity:200).map(i=>new Vector3().fromBufferAttribute(f.g.attributes.position,i)));
  const ankle=referencedVertices(talus.g,full?Infinity:1200).map(i=>new Vector3().fromBufferAttribute(talus.g.attributes.position,i));
  const makeMatrix=v=>new Matrix4().makeTranslation(pivot.x+v[0]/1000,pivot.y+v[1]/1000,pivot.z+v[2]/1000)
    .multiply(new Matrix4().makeRotationY(v[4]*Math.PI/180)).multiply(new Matrix4().makeRotationZ(v[5]*Math.PI/180))
    .multiply(new Matrix4().makeRotationX(v[3]*Math.PI/180)).multiply(new Matrix4().makeTranslation(...pivot.clone().negate().toArray()));
  const move=(p,m)=>{const q=p.clone().applyMatrix4(m);return q.set(Math.fround(q.x),Math.fround(q.y),Math.fround(q.z));};
  const cache=new Map(),trials=[];
  function evaluate(v){
    const key=v.join('/');if(cache.has(key))return cache.get(key);
    if(Math.hypot(...v.slice(0,3))>12+1e-10||v.slice(3).some(x=>Math.abs(x)>8+1e-10))return {cost:Infinity};
    const matrix=makeMatrix(v);let skinExcess=0,boneExcess=0,outside=0,insideBone=0,ambiguous=0;
    if(hard){
      // Query fixed target surfaces in the rotating foot's original frame.
      // Finalists are separately rechecked in serialized Float32 world space.
      const inverse=matrix.clone().invert();
      if(feet.some(f=>bones.some(b=>f.tree.intersectsGeometry(b.g,inverse)))){
        const trial={parameters:v,rejected:'foot-target surface intersection',cost:Infinity};trials.push(trial);cache.set(key,trial);return trial;
      }
    }
    for(const p of samples){const c=probe.classify(move(p,matrix));ambiguous+=c.kind==='ambiguous';if(c.kind==='outside'){outside++;skinExcess+=((c.distance-.002)*1000)**2;}}
    for(const p of ankle){const q=move(p,matrix);for(const b of bones){if(!b.g.boundingBox.containsPoint(q))continue;const c=b.probe.classify(q);ambiguous+=c.kind==='ambiguous';if(c.kind==='inside'){insideBone++;boneExcess+=((c.distance-.00025)*1000)**2;}}}
    const cost=ambiguous?Infinity:skinExcess+100*boneExcess+.002*v.reduce((n,x)=>n+x*x,0);
    const trial={parameters:v,skinExcess,boneExcess,outside,insideBone,ambiguous,cost};trials.push(trial);cache.set(key,trial);return trial;
  }
  let best=evaluate([0,0,0,0,0,0]);const initial=best;
  for(const step of [4,2,1,.5,.25]){
    let changed=true,iteration=0;
    while(changed&&iteration++<60){changed=false;const current=best;
      for(let axis=0;axis<6;axis++)for(const direction of [-1,1]){const v=[...current.parameters];v[axis]+=direction*step;const result=evaluate(v);if(result.cost<best.cost-1e-9){best=result;changed=true;}}
    }
    console.log(JSON.stringify({side:side.side,step,iterations:iteration,trials:trials.length,best}));
  }
  const matrix=makeMatrix(best.parameters),parts=[],collisions=[];assert.ok(Math.abs(matrix.determinant()-1)<1e-12);
  for(const f of feet){
    const after=f.g.clone().applyMatrix4(matrix),row={structure:f.structure,vertices:0,outside:0,ambiguous:0,maxOutsideMm:0,worst:null};
    for(const index of referencedVertices(after,Infinity)){const p=new Vector3().fromBufferAttribute(after.attributes.position,index),c=probe.classify(p);row.vertices++;row.ambiguous+=c.kind==='ambiguous';
      if(c.kind==='outside'){row.outside++;if(c.distance*1000>row.maxOutsideMm){row.maxOutsideMm=c.distance*1000;row.worst={index,pointMetres:p.toArray()};}}}
    for(const bone of bones){const crossing=triangleCrossings(after,bone.g);if(crossing.intersectingTrianglePairs)collisions.push({foot:f.structure,target:bone.structure,...crossing});}
    parts.push(row);output.push({side:side.side,variant:'refined',kind:'donor',structure:f.structure,positions:Array.from(after.attributes.position.array),indices:Array.from(after.index.array)});
    after.dispose();f.g.dispose();f.collisionGeometry?.dispose();
  }
  const summary={vertices:parts.reduce((n,p)=>n+p.vertices,0),outside:parts.reduce((n,p)=>n+p.outside,0),ambiguous:parts.reduce((n,p)=>n+p.ambiguous,0),maxOutsideMm:Math.max(...parts.map(p=>p.maxOutsideMm)),strictCrossingPairs:collisions.filter(c=>c.strictPlaneStraddlingPairs).length};
  report.sides.push({side:side.side,inputVariant:chosen.i,inputRotation:chosen.f.matrix,pivotMetres:pivot.toArray(),initial,best,rigidMatrix:matrix.toArray(),trials,parts,collisions,summary,targetTopology:bones.map(b=>({name:b.structure,topology:b.topology}))});
  console.log(JSON.stringify({side:side.side,summary}));
  for(const b of bones){output.push({...b,g:undefined,probe:undefined,variant:'all'});b.probe.dispose();b.g.dispose();}
}
output.push({...rows.find(p=>p.kind==='skin'),variant:'all'});
fs.writeFileSync(`${out}/${suffix}-parts.json`,JSON.stringify(output));
report.files=[`${out}/report.json`,`${out}/parts.json`,'scripts/refine-donor-foot-pose.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs',`${out}/${suffix}-parts.json`].map(file=>({file,sha256:hash(file)}));
fs.writeFileSync(`${out}/${suffix}.json`,JSON.stringify(report,null,2)+'\n');probe.dispose();skin.dispose();
