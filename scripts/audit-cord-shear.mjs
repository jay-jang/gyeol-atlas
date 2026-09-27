import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const files=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');
const read=f=>{const b=fs.readFileSync(f);files.set(f,hash(b));return b;},json=f=>JSON.parse(read(f));
const sourceReport=json('docs/anatomy-alignment/neural-component-source.json');
const baseline=JSON.parse(gunzipSync(read(sourceReport.geometryFile)));
const candidates=['cord-shear','cord-shear-seeded'].map(tag=>{
  const fit=json(`docs/anatomy-alignment/${tag}-fit.json`),parts=JSON.parse(gunzipSync(read(fit.geometryFile)));
  assert.equal(files.get(fit.geometryFile),fit.files.find(f=>f.file===fit.geometryFile).sha256);return {tag,fit,parts};
});
const states=[{tag:'baseline',parts:baseline},...candidates],modes=[];
function geometry(p){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from(p.positions),3));g.setIndex(p.indices);g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;}
for(const mode of ['source','runtime']){
  const bones=baseline.filter(p=>p.kind==='bone').map(p=>({id:p.id,geometry:geometry(p[mode])}));
  bones.forEach(p=>p.probe=surfaceProbe(p.geometry,1e-6));const runs=[];
  for(const state of states){
    for(const p of state.parts.filter(p=>p.kind==='bone'))assert.deepEqual(p[mode],baseline.find(q=>q.id===p.id)[mode]);
    const cords=state.parts.filter(p=>p.kind==='cord').map(p=>({id:p.id,geometry:geometry(p[mode])}));
    const rows=[],point=new Vector3();
    for(const c of cords){
      const positions=c.geometry.attributes.position,vertices=referencedVertices(c.geometry,Infinity);
      for(const b of bones){
        const counts={inside:0,outside:0,'surface-band':0,ambiguous:0};let maxInsideMm=0;
        for(const vertex of vertices){point.fromBufferAttribute(positions,vertex);if(!b.geometry.boundingBox.containsPoint(point)){counts.outside++;continue;}
          const r=b.probe.classify(point);counts[r.kind]++;if(r.kind==='inside')maxInsideMm=Math.max(maxInsideMm,r.distance*1000);
        }
        const witness=c.geometry.boundingBox.intersectsBox(b.geometry.boundingBox)?meshCrossingWitness(c.geometry,b.geometry):null;
        rows.push({cordId:c.id,boneId:b.id,vertices:vertices.length,...counts,maxInsideMm,witness});
      }
    }
    const internal=[];
    for(let i=0;i<cords.length;i++)for(let j=i+1;j<cords.length;j++){
      const a=cords[i],b=cords[j],witness=a.geometry.boundingBox.intersectsBox(b.geometry.boundingBox)?meshCrossingWitness(a.geometry,b.geometry):null;
      if(witness)internal.push({a:a.id,b:b.id,witness});
    }
    const summary={pairs:rows.length,inside:rows.reduce((n,r)=>n+r.inside,0),insidePairs:rows.filter(r=>r.inside).length,
      ambiguous:rows.reduce((n,r)=>n+r.ambiguous,0),maxInsideMm:Math.max(...rows.map(r=>r.maxInsideMm)),crossingPairs:rows.filter(r=>r.witness).length,
      cordPairs:cords.length*(cords.length-1)/2,internalCrossingPairs:internal.length};
    runs.push({tag:state.tag,summary,rows,internal});console.log(JSON.stringify({mode,tag:state.tag,...summary}));cords.forEach(c=>c.geometry.dispose());
  }
  const old=runs[0];
  const relation=(r)=>`${r.cordId}/${r.boneId}`,insideOld=new Set(old.rows.filter(r=>r.inside).map(relation)),crossingOld=new Set(old.rows.filter(r=>r.witness).map(relation));
  for(const run of runs.slice(1)){
    run.newInsidePairs=run.rows.filter(r=>r.inside&&!insideOld.has(relation(r))).map(relation);
    run.newCrossingPairs=run.rows.filter(r=>r.witness&&!crossingOld.has(relation(r))).map(relation);
    run.newInternalPairs=run.internal.filter(r=>!old.internal.some(p=>p.a===r.a&&p.b===r.b)).map(r=>[r.a,r.b]);
  }
  modes.push({mode,runs});bones.forEach(b=>{b.geometry.dispose();b.probe.dispose();});
}
for(const file of ['scripts/audit-cord-shear.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs'])read(file);
const report={status:'REJECTED: both linearized fits failed convergence; no public model changes',modes,
  scope:'Stored Float32 source/runtime cord vertices and all cord/bone plus cord/cord transverse witnesses. Other fixed tissues, complete surface containment, source gap attachment and clinical anatomy are NOT validated.',
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync('docs/anatomy-alignment/cord-shear-audit.json',JSON.stringify(report,null,2)+'\n');
