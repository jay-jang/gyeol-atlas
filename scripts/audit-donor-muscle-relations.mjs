// Audit current donor muscle/bone surfaces. No fitting or runtime output.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const out='.cache/donor-muscle';fs.mkdirSync(out,{recursive:true});
const files=new Map(),hash=path=>{const bytes=fs.readFileSync(path);files.set(path,createHash('sha256').update(bytes).digest('hex'));return bytes;};
const source=JSON.parse(hash('data/catalog/female-atlas-source.json'));
for(const f of source.files)assert.equal(createHash('sha256').update(hash(f.path)).digest('hex'),f.sha256,f.path);
const atlas=JSON.parse(hash('public/models/female/atlas-female.json')),buffers=new Map();
function geometry(part){
  const c=atlas.chunks[part.chunk],path=`public/models/female/${c.gzip.split('/').pop()}`;
  if(!buffers.has(path)){
    const zipped=fs.readFileSync(path);assert.equal(zipped.length,c.gzipBytes);
    const bytes=gunzipSync(zipped);assert.equal(bytes.length,c.bytes);buffers.set(path,bytes);
  }
  const b=buffers.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+4*i)),1));
  applyFemaleArmRegistration(g,'female',part.id,part.system);applyFemaleFootRegistration(g,'female',part.id,part.system);
  g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;
}
const byId=new Map(atlas.parts.map(p=>[p.id,p]));
const groupById=new Map();
for(const group of atlas.concepts.filter(c=>c.id.startsWith('VHF:group-')))for(const id of group.elements){
  assert.ok(!groupById.has(id));groupById.set(id,group.id);
}
const muscles=atlas.parts.filter(p=>p.system==='donor-muscle').map(p=>({p,g:geometry(p)}));
const bones=atlas.parts.filter(p=>['skeletal','connective','borrowed'].includes(p.system)).map(p=>({p,g:geometry(p)}));
assert.equal(muscles.length,76);assert.equal(bones.length,321);assert.equal(groupById.size,76);
const skin=geometry(byId.get('HRAF0003')),probe=surfaceProbe(skin);
const report={status:'GEOMETRY DIAGNOSTIC ONLY; no anatomy correction or clinical approval',
  createdAt:new Date().toISOString(),source:source.repository,sourceCommit:source.commit,
  sourceFit:atlas.donorMuscle,scope:{donorMuscles:76,boneLayerParts:321,evaluatedPairs:0,broadPhasePairs:0},
  limitations:[
    'All 76 donor meshes include two rectus femoris meshes hidden by default; results separate these cases.',
    'Bone-layer parts include cartilage/connective meshes, not 321 distinct bones.',
    'Triangle intersection and plane-straddle extent are not penetration depth, volume, or an attachment diagnosis.',
    'No surface intersection does not exclude solid containment or prove anatomical alignment.',
    'Skin classification covers indexed vertices, not triangle interiors. The 2 mm band is numerical, not tissue thickness.',
    'The imported group names describe fitting groups chosen by nearest bone-box centre, not validated anatomical compartments.',
    'Unsigned nearest distances do not identify tendon attachment sites; meshes may not include full tendons.',
  ],muscles:[],pairs:[],calfRelations:[]};
const point=new Vector3();
for(const m of muscles){
  const vertices=referencedVertices(m.g,Infinity),row={id:m.p.id,name:m.p.name,fitGroup:groupById.get(m.p.id),
    defaultHidden:/^Rectus femoris /.test(m.p.name),referencedVertices:vertices.length,
    skin:{inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0},intersectingBoneIds:[]};
  for(const i of vertices){
    const c=probe.classify(point.fromBufferAttribute(m.g.attributes.position,i));row.skin[c.kind]++;
    if(c.kind==='outside')row.skin.maxOutsideMm=Math.max(row.skin.maxOutsideMm,c.distance*1000);
  }
  for(const b of bones){
    report.scope.evaluatedPairs++;
    if(!m.g.boundingBox.intersectsBox(b.g.boundingBox))continue;
    report.scope.broadPhasePairs++;
    if(!m.g.boundsTree.intersectsGeometry(b.g,new Matrix4()))continue;
    const crossings=triangleCrossings(m.g,b.g);
    row.intersectingBoneIds.push(b.p.id);
    report.pairs.push({muscleId:m.p.id,muscleName:m.p.name,defaultHidden:row.defaultHidden,boneId:b.p.id,boneName:b.p.name,boneSystem:b.p.system,...crossings});
  }
  report.muscles.push(row);
  console.log(JSON.stringify({id:row.id,fitGroup:row.fitGroup,skinOutside:row.skin.outside,boneIntersections:row.intersectingBoneIds.length}));
}
assert.equal(report.scope.evaluatedPairs,76*321);
// Spatial relationship baseline for the separately fitted calf heads, and the
// nearest femur/tibia/fibula surfaces. These are not assumed attachment points.
function relation(a,b){
  const nearest=(from,to)=>{
    let best={distance:Infinity};
    for(const i of referencedVertices(from,Infinity)){
      const p=point.fromBufferAttribute(from.attributes.position,i),r=to.boundsTree.closestPointToPoint(p);
      if(r.distance<best.distance)best={distance:r.distance,from:p.toArray(),onto:r.point.toArray(),vertex:i};
    }
    return {minimumMm:best.distance*1000,from:best.from,onto:best.onto,vertex:best.vertex};
  };
  return {forward:nearest(a.g,b.g),reverse:nearest(b.g,a.g),...triangleCrossings(a.g,b.g)};
}
for(const side of ['left','right']){
  const med=muscles.find(m=>m.p.name===`Gastrocnemius medial (${side})`),lat=muscles.find(m=>m.p.name===`Gastrocnemius lateral (${side})`),soleus=muscles.find(m=>m.p.name===`Soleus (${side})`);
  assert.ok(med&&lat&&soleus);
  for(const [a,b] of [[med,lat],[med,soleus],[lat,soleus],...[med,lat,soleus].flatMap(m=>['Femur','Tibia','Fibula'].map(n=>[m,bones.find(b=>b.p.name===`${n} (${side})`)]))]){
    assert.ok(b);report.calfRelations.push({ids:[a.p.id,b.p.id],names:[a.p.name,b.p.name],...relation(a,b)});
  }
}
const active=report.muscles.filter(m=>!m.defaultHidden),pairs=report.pairs.filter(p=>!p.defaultHidden);
report.summary={defaultMuscles:active.length,outsideSkinMeshes:active.filter(m=>m.skin.outside).length,
  outsideSkinVertices:active.reduce((n,m)=>n+m.skin.outside,0),maxOutsideSkinMm:Math.max(...active.map(m=>m.skin.maxOutsideMm)),
  intersectingMuscleMeshes:new Set(pairs.map(p=>p.muscleId)).size,intersectingPairs:pairs.length,
  strictPlaneStraddlingPairs:pairs.filter(p=>p.strictPlaneStraddlingPairs>0).length};
for(const path of ['scripts/audit-donor-muscle-relations.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs',
  'src/female-arm-registration.ts','src/female-foot-registration.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json'])hash(path);
report.files=[...files].map(([path,sha256])=>({path,sha256}));
fs.writeFileSync(`${out}/relations.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
probe.dispose();skin.dispose();[...muscles,...bones].forEach(m=>m.g.dispose());
