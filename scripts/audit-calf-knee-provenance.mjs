// Offline factorial check: source geometry versus packed geometry, and source
// frame versus candidate frames. This script has no runtime export path.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices,surfaceProbe} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const root=process.argv[2];assert.ok(root,'Pass the extracted Final STL directory');
assert.equal(process.argv.length,3);
const out='.cache/calf-knee-provenance',files=new Map();
fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;};
const json=p=>JSON.parse(read(p));
const source=json('docs/anatomy-alignment/donor-source-comparison.json');
const atlas=json('public/models/female/atlas-female.json');
const hierarchy=json('docs/anatomy-alignment/hra-bone-targets.json');
assert.equal(files.get('public/models/female/atlas-female.json'),hierarchy.atlasSha256);
const fits=json('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json');
const receipt=json('data/catalog/female-atlas-source.json');
for(const f of receipt.files)assert.equal(sha(read(f.path)),f.sha256);
const old=json('docs/anatomy-alignment/calf-shank-candidate.json');
const loader=new STLLoader(),point=new Vector3(),buffers=new Map();
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g);return g;};
const matrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
function original(side,kind,structure){
  const record=source.files.find(f=>f.side===side&&f.kind===kind&&f.structure===structure);assert.ok(record,`${side}/${kind}/${structure}`);
  const bytes=read(path.join(root,record.file));assert.equal(sha(bytes),record.sha256);
  const raw=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  raw.scale(.001,.001,.001);raw.deleteAttribute('normal');const g=mergeVertices(raw,1e-9);raw.dispose();
  return {file:record.file,g:finish(g)};
}
function packed(id){
  const p=atlas.parts.find(p=>p.id===id);assert.ok(p,id);
  // All selected native knee meshes and these two donor muscles are unchanged
  // by brain bindings, iliac restoration, and arm/foot registrations.
  assert.ok(['skeletal','connective','donor-muscle'].includes(p.system)||p.id==='HRAF0003');
  if(!buffers.has(p.chunk)){
    const c=atlas.chunks[p.chunk],b=read(`public/models/female/${c.gzip.split('/').pop()}`);
    assert.equal(b.length,c.gzipBytes);const bytes=gunzipSync(b);assert.equal(bytes.length,c.bytes);buffers.set(p.chunk,bytes);
  }
  const b=buffers.get(p.chunk),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));
  return {id,name:p.name,g:finish(g)};
}
function relation(a,b){
  const crosses=a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,new Matrix4());
  if(!crosses)return {crossing:false};
  const counts=triangleCrossings(a,b),witness=meshCrossingWitness(a,b);
  if(counts.strictPlaneStraddlingPairs)assert.ok(witness);
  return {crossing:true,...counts,witness};
}
function distances(a,b){
  const values=referencedVertices(a,Infinity).map(i=>b.boundsTree.closestPointToPoint(point.fromBufferAttribute(a.attributes.position,i)).distance*1000).sort((x,y)=>x-y);
  return {vertices:values.length,minimumMm:values[0],medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1)};
}
const skin=packed('HRAF0003'),probe=surfaceProbe(skin.g,.002);
function skinAudit(g){
  const row={vertices:0,inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0};
  for(const i of referencedVertices(g,Infinity)){
    const p=probe.classify(point.fromBufferAttribute(g.attributes.position,i));row.vertices++;row[p.kind]++;
    if(p.kind==='outside')row.maxOutsideMm=Math.max(row.maxOutsideMm,p.distance*1000);
  }return row;
}
const report={createdAt:new Date().toISOString(),status:'OFFLINE SOURCE/FRAME DIAGNOSTIC; no runtime changes',sides:[],
  limitations:[
    'This is a bounded knee diagnostic, not an all-mesh acceptance screen or anatomical validation.',
    'Crossings are surface relations, not solid penetration, tissue injury, or proof of an invalid attachment.',
    'No surface crossing does not exclude full containment. Vertex distances are not continuous Hausdorff distances.',
    'The donor tibial cartilage is not relabeled as a meniscus. No source counterpart is invented for HRA meniscus or enthesis.',
    'Source ligament correspondences use explicit published mesh names, not landmark or segmentation equivalence.',
    'Full source and packed meshes have different vertex counts; outside counts must not be subtracted as paired-point outcomes.',
    'HRA knee targets remain the current packed meshes. Restoring the muscle source alone does not restore HRA target resolution.',
    'Only rigid/uniform-scale source frame transforms are measured, without fitting or exporting a new correction.'
  ]};
const diagnostic=[];
for(const side of ['left','right']){
  const id=side==='left'?'VHF0005':'VHF0043',base=source.muscles.find(m=>m.id===id);assert.equal(base.fitGroup,`${side}-thigh`);
  const raw=original(side,'muscle','GastrocnemiusMedial'),low=packed(id);
  const sourceTargets=[['ligament','ACL'],['ligament','PCL'],['ligament','MCL'],['ligament','LCL'],['bone','Femur'],['bone','Tibia'],['bone','Fibula'],['cartilage','FemurDistal'],['cartilage','TibiaMedial'],['cartilage','TibiaLateral']].map(([kind,structure])=>({...original(side,kind,structure),kind,structure}));
  const legacy=old.comparisons.find(r=>r.id===id);
  const ids=new Set(legacy.pairs.filter(p=>p.system==='connective'||p.system==='skeletal').map(p=>p.otherId));
  // Include all four same-named ligament controls, even if they never crossed.
  const ligamentIds=side==='left'?{ACL:'HRAF0934',PCL:'HRAF0935',MCL:'HRAF0933',LCL:'HRAF0931'}:{ACL:'HRAF0905',PCL:'HRAF0906',MCL:'HRAF0904',LCL:'HRAF0908'};
  Object.values(ligamentIds).forEach(id=>ids.add(id));
  const targets=[...ids].sort().map(packed);
  const sourceMatrix=matrix(source.fits[base.fitGroup]);
  const sourceLow=finish(low.g.clone().applyMatrix4(sourceMatrix.clone().invert()));
  const row={side,id,rawVertices:raw.g.attributes.position.count,packedVertices:low.g.attributes.position.count,
    sourceRelations:sourceTargets.map(t=>({file:t.file,kind:t.kind,structure:t.structure,raw:relation(raw.g,t.g),packed:relation(sourceLow,t.g),rawToTarget:distances(raw.g,t.g)})),frames:[]};
  const frames=[['current-thigh',sourceMatrix],['original-shank',matrix(source.fits[`${side}-shank`])],
    ...['thigh','shank','whole-leg'].map(mode=>[`hierarchy-${mode}`,new Matrix4().fromArray(fits.fits.find(f=>f.side===side&&f.mode===mode).sourceToAtlasMatrix)])];
  for(const [name,transform] of frames){
    const full=finish(raw.g.clone().applyMatrix4(transform));
    const reduced=name==='current-thigh'?low.g:finish(low.g.clone().applyMatrix4(transform.clone().multiply(sourceMatrix.clone().invert())));
    const sourceLigamentParts=[];
    const entry={name,sourceToAtlasMatrix:transform.toArray(),rawSkin:skinAudit(full),packedSkin:skinAudit(reduced),
      pairs:targets.map(t=>({id:t.id,name:t.name,raw:relation(full,t.g),packed:relation(reduced,t.g)})),ligamentResiduals:[]};
    for(const [key,targetId] of Object.entries(ligamentIds)){
      const sourceLigament=sourceTargets.find(t=>t.kind==='ligament'&&t.structure===key),target=targets.find(t=>t.id===targetId);
      const moved=finish(sourceLigament.g.clone().applyMatrix4(transform));
      entry.ligamentResiduals.push({structure:key,targetId,forward:distances(moved,target.g),reverse:distances(target.g,moved)});
      if(name==='hierarchy-shank'){
        entry.ligamentCrossCorrespondence??=[];
        for(const [otherKey,otherId] of Object.entries(ligamentIds)){
          const other=targets.find(t=>t.id===otherId);
          entry.ligamentCrossCorrespondence.push({source:key,target:otherKey,targetId:otherId,forward:distances(moved,other.g),reverse:distances(other.g,moved)});
        }
      }
      if(name==='original-shank'||name==='hierarchy-shank')sourceLigamentParts.push({id:`SOURCE-${key}`,name:`Source ${key}`,positions:Array.from(moved.attributes.position.array),indices:Array.from(moved.index.array)});
      moved.dispose();
    }
    entry.rawCrossingIds=entry.pairs.filter(p=>p.raw.crossing).map(p=>p.id);
    entry.packedCrossingIds=entry.pairs.filter(p=>p.packed.crossing).map(p=>p.id);
    if(name==='original-shank')for(const p of legacy.pairs.filter(p=>p.system==='connective'||p.system==='skeletal')){
      const observed=entry.pairs.find(t=>t.id===p.otherId).packed;
      assert.equal(observed.crossing,Boolean(p.after),p.otherId);
      if(p.after)assert.equal(observed.intersectingTrianglePairs,p.after.intersectingTrianglePairs);
    }
    row.frames.push(entry);
    // Diagnostic geometry is private and not loaded by the app.
    if(name==='original-shank'||name==='hierarchy-shank')diagnostic.push({side,frame:name,focusIds:Object.values(ligamentIds),parts:[...[{id,name:low.name,g:full},...targets].map(p=>({id:p.id,name:p.name,positions:Array.from(p.g.attributes.position.array),indices:Array.from(p.g.index.array)})),...sourceLigamentParts]});
    full.dispose();if(reduced!==low.g)reduced.dispose();
    console.log(JSON.stringify({side,name,rawSkin:entry.rawSkin.outside,packedSkin:entry.packedSkin.outside,rawCrossingIds:entry.rawCrossingIds,packedCrossingIds:entry.packedCrossingIds}));
  }
  row.confirmedLegacyNewCrossings=legacy.pairs.filter(p=>!p.before&&p.after&&(p.system==='connective'||p.system==='skeletal')).map(p=>{
    const entry=row.frames.find(f=>f.name==='original-shank').pairs.find(t=>t.id===p.otherId);
    return {id:p.otherId,name:p.name,packedCrossing:entry.packed.crossing,fullSourceCrossing:entry.raw.crossing};
  });
  report.sides.push(row);
  for(const p of [raw,low,...targets,...sourceTargets])p.g.dispose();sourceLow.dispose();
}
for(const p of ['scripts/audit-calf-knee-provenance.mjs','scripts/lib/triangle-crossings.mjs','scripts/lib/triangle-witness.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(p);
report.files=[...files].map(([p,sha256])=>({path:p.startsWith(root)?path.relative(root,p):p,sha256}));
fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(`${out}/diagnostic.json`,JSON.stringify(diagnostic));
probe.dispose();skin.g.dispose();
