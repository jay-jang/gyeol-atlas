// Offline falsification of two simple scale hypotheses. Never writes app data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {surfaceProbe,referencedVertices,surfaceTopology} from './lib/surface-containment.mjs';
import {jointSurfaceRelation} from './lib/joint-geometry.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const baselinePath='.cache/foot-registration/baseline.json';
const baseline=JSON.parse(fs.readFileSync(baselinePath));
for(const f of baseline.files)assert.equal(hash(f.path),f.sha256,f.path);
const atlasPath='public/models/female/atlas-female.json';
const atlas=JSON.parse(fs.readFileSync(atlasPath)),buffers=new Map();
const registrationPath='data/catalog/female-arm-registration.json';
const registration=JSON.parse(fs.readFileSync(registrationPath));
const previousPath='docs/anatomy-alignment/body-containment-female-registered-all.json';
const previous=JSON.parse(fs.readFileSync(previousPath)).bodies[0].parts;
const footIds=new Set(baseline.feet.flatMap(f=>f.parts.map(p=>p.id)));
assert.equal(footIds.size,56);
assert.ok(registration.records.every(r=>!footIds.has(r.id)),'Foot has runtime registration; raw baseline is no longer sufficient');
function geometry(part){
  assert.ok(part);
  const chunk=atlas.chunks[part.chunk],path=`public/models/female/${chunk.gzip.split('/').pop()}`;
  if(!buffers.has(path)){
    const gzip=fs.readFileSync(path);assert.equal(gzip.length,chunk.gzipBytes);
    const bytes=gunzipSync(gzip);assert.equal(bytes.length,chunk.bytes);buffers.set(path,bytes);
  }
  const bytes=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>bytes.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>bytes.readUInt32LE(part.indices+4*i)),1));
  return g;
}
const skin=geometry(atlas.parts.find(p=>p.id==='HRAF0003')),probe=surfaceProbe(skin,.002);
const report={status:'OFFLINE DIAGNOSTIC: simple scale changes are not an approved registration',
  skinTopology:surfaceTopology(skin),feet:[],limitations:[
    'Neither source scale nor inverse reach is a known female anatomical target.',
    'Pivot is the talus referenced-vertex mean, not a validated ankle rotation centre.',
    'Containment covers indexed vertices with a 2 mm boundary band, not complete triangle interiors.',
    'Joint distances are unsigned vertex-to-triangle minima, not cartilage gaps or penetration depths.',
    'Only talus-to-tibia/fibula joints are screened; not all bone pairs or soft tissues.',
    'Donor skin can contain nested shells; its slice areas are not summed or used as a fit objective.'
  ]};
assert.equal(report.skinTopology.connectedComponents,1);
assert.equal(report.skinTopology.boundaryEdges,0);
assert.equal(report.skinTopology.nonManifoldEdges,0);
for(const foot of baseline.feet){
  const rows=foot.parts.map(p=>({part:atlas.parts.find(q=>q.id===p.id),g:geometry(atlas.parts.find(q=>q.id===p.id))}));
  assert.equal(rows.length,28);
  const talus=rows.find(r=>r.part.name.toLowerCase()===`${foot.side} talus`);
  const pivot=new Vector3(),indices=referencedVertices(talus.g,Infinity);
  for(const i of indices)pivot.add(new Vector3().fromBufferAttribute(talus.g.attributes.position,i));
  pivot.multiplyScalar(1/indices.length);
  const neighbours=['tibia','fibula'].map(name=>{
    const p=atlas.parts.find(p=>p.name.toLowerCase()===`${name} (${foot.side})`);
    return {part:p,g:geometry(p)};
  });
  const sv=foot.singularValues;assert.ok(Math.max(...sv)-Math.min(...sv)<1e-6);
  const recoveredScale=sv.reduce((s,n)=>s+n,0)/3;
  const reach=atlas.borrowed.posture[`foot-${foot.side}`]?.reach;
  // The manifest's posture shape is checked explicitly; never guess silently.
  assert.ok(Number.isFinite(reach)&&reach>1);
  const result={side:foot.side,pivot:pivot.toArray(),recoveredScale,reach,scenarios:[]};
  const baselineClasses=new Map();
  for(const [name,scale] of [['current',1],['source-size',1/recoveredScale],['undo-reach',1/reach]]){
    const scenario={name,scale,parts:[],joints:[],outside:0,newOutside:0,worsenedOutside:0,maxOutsideMm:0};
    for(const row of rows){
      const g=row.g.clone(),position=g.attributes.position;
      for(let i=0;i<position.count;i++){
        const p=new Vector3().fromBufferAttribute(position,i).sub(pivot).multiplyScalar(scale).add(pivot);
        position.setXYZ(i,p.x,p.y,p.z);
      }
      const stats={id:row.part.id,name:row.part.name,vertices:0,outside:0,newOutside:0,worsenedOutside:0,maxOutsideMm:0};
      for(const i of referencedVertices(g,Infinity)){
        const key=`${row.part.id}:${i}`,c=probe.classify(new Vector3().fromBufferAttribute(position,i));
        assert.notEqual(c.kind,'ambiguous',key);
        if(name==='current')baselineClasses.set(key,c);
        const before=baselineClasses.get(key);assert.ok(before);stats.vertices++;
        stats.outside+=c.kind==='outside';
        stats.newOutside+=before.kind!=='outside'&&c.kind==='outside';
        stats.worsenedOutside+=(c.kind==='outside'?c.distance:0)-(before.kind==='outside'?before.distance:0)>1e-6;
        if(c.kind==='outside')stats.maxOutsideMm=Math.max(stats.maxOutsideMm,c.distance*1000);
      }
      scenario.parts.push(stats);
      if(name==='current'){
        const old=previous.find(p=>p.id===stats.id);assert.ok(old);
        assert.equal(stats.vertices,old.samples,stats.id);
        assert.equal(stats.outside,old.outside,stats.id);
        assert.ok(Math.abs(stats.maxOutsideMm-old.maxOutsideMm)<1e-5,stats.id);
      }
      for(const key of ['outside','newOutside','worsenedOutside'])scenario[key]+=stats[key];
      scenario.maxOutsideMm=Math.max(scenario.maxOutsideMm,stats.maxOutsideMm);
      if(row===talus)for(const n of neighbours)scenario.joints.push({ids:[row.part.id,n.part.id],names:[row.part.name,n.part.name],
        forward:jointSurfaceRelation(g,n.g),reverse:jointSurfaceRelation(n.g,g),crossings:triangleCrossings(g,n.g)});
      g.dispose();
    }
    result.scenarios.push(scenario);
    console.log(JSON.stringify({side:foot.side,...scenario,parts:undefined}));
  }
  report.feet.push(result);rows.forEach(r=>r.g.dispose());neighbours.forEach(n=>n.g.dispose());
}
report.files=[baselinePath,atlasPath,registrationPath,previousPath,'scripts/audit-foot-scale.mjs','scripts/lib/surface-containment.mjs',
  'scripts/lib/joint-geometry.mjs','scripts/lib/triangle-crossings.mjs',...buffers.keys()].map(path=>({path,sha256:hash(path)}));
fs.writeFileSync('.cache/foot-registration/scale-audit.json',JSON.stringify(report,null,2)+'\n');
probe.dispose();skin.dispose();
