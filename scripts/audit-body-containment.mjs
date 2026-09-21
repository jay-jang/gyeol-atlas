import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {KHRDracoMeshCompression} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';

const read=file=>JSON.parse(fs.readFileSync(file));
const allFemale=process.argv.includes('--all-female-vertices');
const sourceFemale=process.argv.includes('--source-female');
const maxSamples=allFemale?Number.MAX_SAFE_INTEGER:Number(process.env.CONTAINMENT_SAMPLES||512);
if(!Number.isInteger(maxSamples)||maxSamples<32)throw new Error('CONTAINMENT_SAMPLES must be an integer >=32');
const hashes=new Map();
const hash=file=>{hashes.set(file,createHash('sha256').update(fs.readFileSync(file)).digest('hex'));return file;};
const registration=read(hash('data/catalog/male-registration.json'));
const catalog=read(hash('data/female-atlas-structures.json'));
const full=read(hash('data/full-system-structures.json'));
const lymph=read(hash('data/sex-lymph-structures.json')).filter(s=>s.sex==='male'&&s.layer==='lymph');
const base=read(hash('public/models/manifest.json')).assets;
const io=new NodeIO().registerExtensions([KHRDracoMeshCompression]).registerDependencies({'draco3d.decoder':await draco.createDecoderModule()});
async function glb(file,entries,registered=false) {
  const doc=await io.read(hash(file)),parts=[];
  for(const node of doc.getRoot().listNodes()){
    if(!node.getMesh())continue;
    const entry=entries.find(e=>(e.node||e.id)===node.getName());
    if(!entry)continue;
    const matrix=new Matrix4().fromArray(node.getWorldMatrix());
    for(const primitive of node.getMesh().listPrimitives()){
      const geometry=new BufferGeometry();
      geometry.setAttribute('position',new BufferAttribute(new Float32Array(primitive.getAttribute('POSITION').getArray()),3));
      if(primitive.getIndices())geometry.setIndex(new BufferAttribute(new Uint32Array(primitive.getIndices().getArray()),1));
      geometry.applyMatrix4(matrix);
      if(registered){geometry.scale(registration.scale,registration.scale,registration.scale);geometry.translate(...registration.translation);}
      parts.push({...entry,geometry,source:file});
    }
  }
  return parts;
}
function female() {
  const manifest=read(hash('public/models/female/atlas-female.json'));
  const buffers=manifest.chunks.map(c=>gunzipSync(fs.readFileSync(hash(`public/models/female/${c.gzip.split('/').pop()}`))));
  return manifest.parts.map(part=>{
    const bytes=buffers[part.chunk],geometry=new BufferGeometry();
    const positions=new Float32Array(part.vertexCount*3),indices=new Uint32Array(part.indexCount);
    for(let i=0;i<positions.length;i++)positions[i]=bytes.readFloatLE(part.positions+i*4);
    for(let i=0;i<indices.length;i++)indices[i]=bytes.readUInt32LE(part.indices+i*4);
    geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setIndex(new BufferAttribute(indices,1));
    if(!sourceFemale)applyFemaleArmRegistration(geometry,'female',part.id,part.system);
    if(!sourceFemale)applyFemaleFootRegistration(geometry,'female',part.id,part.system);
    const entry=catalog.find(c=>c.id===part.id);
    if(!entry)throw new Error(`Missing female catalog ${part.id}`);
    const defaultHidden=part.system==='pregnancy'||(part.system==='donor-muscle'&&/^Rectus femoris /.test(part.name));
    return {...entry,geometry,system:part.system,defaultHidden};
  });
}
for(const file of ['src/Atlas.tsx','src/PackedAtlas.tsx','src/anatomy.ts','scripts/audit-body-containment.mjs','scripts/lib/surface-containment.mjs'])hash(file);
if(!sourceFemale)for(const file of ['src/female-arm-registration.ts','data/catalog/female-arm-registration.json','src/female-foot-registration.ts','data/catalog/female-foot-registration.json'])hash(file);
const report={method:'Referenced vertex sampling, nearest skin-triangle distance and consensus of three oblique ray parities; not clinical validation',
  femaleGeometry:sourceFemale?'Unmodified source coordinates':'Runtime partial arm and toe registration applied; other source coordinates unchanged',
  sampling:allFemale?'Every triangle-referenced female vertex':'Deterministic subsample of triangle-referenced vertices',
  toleranceMm:2,maxSamplesPerMesh:allFemale?null:maxSamples,limitations:[allFemale?'All triangle-referenced vertices are checked; this does not test triangle interiors.':'Not every vertex/triangle is sampled.',
    'Fractions are vertex fractions, not tissue volumes or surface areas.',
    'Surface holes/self-intersections can invalidate parity; topology and ambiguous counts are recorded.',
    'Containment does not establish correct location, orientation, nerve course or source registration.',
    'Separate BP4/CT organ details have no matching whole-body skin in this app and are not merged into the audit.'],bodies:[]};
for(const sex of allFemale?['female']:['male','female']){
  const parts=sex==='female'?female():[
    ...await glb('public/models/skin.glb',base),...await glb('public/models/muscle.glb',base),
    ...await glb('public/models/bone.glb',base),...await glb('public/models/organ.glb',base),
    ...await glb('public/models/nerve-full.glb',full.filter(s=>s.layer==='nerve'),true),
    ...await glb('public/models/vessel-full.glb',full.filter(s=>s.layer==='vessel'),true),
    ...await glb('public/models/reference/lymphatic_male.glb',lymph,true),
  ];
  assert.equal(parts.length,sex==='female'?1220:2090,'Audit must not silently omit overview source meshes');
  assert.equal(new Set(parts.map(p=>p.id)).size,parts.length,'One row per source mesh');
  const skin=parts.find(p=>p.name==='Skin');if(!skin)throw new Error(`Missing skin: ${sex}`);
  const topology=surfaceTopology(skin.geometry),probe=surfaceProbe(skin.geometry),rows=[];
  for(const part of parts.filter(p=>p.id!==skin.id)){
    const positions=part.geometry.getAttribute('position'),vertices=referencedVertices(part.geometry,maxSamples),samples=vertices.length;
    const counts={inside:0,outside:0,'surface-band':0,ambiguous:0};let maxOutsideMm=0,worstPoint=null;
    for(let i=0;i<samples;i++){
      const vertex=vertices[i];
      const point=new Vector3().fromBufferAttribute(positions,vertex),result=probe.classify(point);
      counts[result.kind]++;
      if(result.kind==='outside'&&result.distance*1000>maxOutsideMm){maxOutsideMm=result.distance*1000;worstPoint=point.toArray();}
    }
    rows.push({id:part.id,name:part.name,layer:part.layer,source:part.source,system:part.system,defaultHidden:Boolean(part.defaultHidden),
      vertices:positions.count,samples,...counts,maxOutsideMm,worstPoint});
  }
  const summary=Object.fromEntries(['skin','bone','muscle','organ','vessel','lymph','nerve'].map(layer=>{
    const active=rows.filter(r=>r.layer===layer&&!r.defaultHidden);
    return [layer,{meshes:active.length,samples:active.reduce((n,r)=>n+r.samples,0),outsideSamples:active.reduce((n,r)=>n+r.outside,0),
      ambiguousSamples:active.reduce((n,r)=>n+r.ambiguous,0),maxOutsideMm:Math.max(0,...active.map(r=>r.maxOutsideMm))}];
  }));
  const interpretable=topology.boundaryEdges===0&&topology.nonManifoldEdges===0&&topology.connectedComponents===1;
  report.bodies.push({sex,skinId:skin.id,topology,interpretation:interpretable?'Surface containment screen only; correct anatomy is NOT established':'UNSUPPORTED SKIN TOPOLOGY: ray outside values must NOT be interpreted as outside the body',summary,parts:rows});
  console.log(JSON.stringify({sex,topology,summary,worst:rows.filter(r=>!r.defaultHidden).sort((a,b)=>b.maxOutsideMm-a.maxOutsideMm).slice(0,12)},null,2));
  probe.dispose();parts.forEach(p=>p.geometry.dispose());
}
report.files=[...hashes].map(([path,sha256])=>({path,sha256}));
const outputPath=process.env.CONTAINMENT_OUTPUT||`docs/anatomy-alignment/body-containment${allFemale?'-female':''}-${sourceFemale?'source':'registered'}${allFemale?'-all':''}.json`;
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
