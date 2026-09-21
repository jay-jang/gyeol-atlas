// Candidate-only screen: put the two medial gastrocnemius meshes in their
// donor shank frame. No runtime geometry or registration file is written.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const files=new Map(),read=p=>{const b=fs.readFileSync(p);files.set(p,createHash('sha256').update(b).digest('hex'));return b;};
const source=JSON.parse(read('data/catalog/female-atlas-source.json'));
for(const f of source.files)assert.equal(createHash('sha256').update(read(f.path)).digest('hex'),f.sha256);
const atlas=JSON.parse(read('public/models/female/atlas-female.json'));
const sourceFit=JSON.parse(read('docs/anatomy-alignment/donor-source-comparison.json'));
const surfaceMode=process.argv.find(a=>a.startsWith('--surface-fit='))?.split('=')[1];
assert.ok(!surfaceMode||['shank','whole-leg'].includes(surfaceMode));
const surfaceFits=surfaceMode?JSON.parse(read('.cache/calf-registration/bone-surface-fits.json')):null;
const chunks=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const parts=atlas.parts.map(p=>{
  const b=chunks[p.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+i*4)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+i*4)),1));
  applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);g.computeBoundingBox();
  return {p,g};
});
const ensureBVH=g=>g.boundsTree||(g.boundsTree=new MeshBVH(g));
const skin=parts.find(p=>p.p.id==='HRAF0003'),probe=surfaceProbe(skin.g),point=new Vector3();
function skinAudit(g){
  const row={inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0},classified=new Map();
  for(const i of referencedVertices(g,Infinity)){
    const c=probe.classify(point.fromBufferAttribute(g.attributes.position,i));row[c.kind]++;classified.set(i,c);
    if(c.kind==='outside')row.maxOutsideMm=Math.max(row.maxOutsideMm,c.distance*1000);
  }return {row,classified};
}
function nearest(a,b){
  ensureBVH(b);let minimum=Infinity;
  for(const i of referencedVertices(a,Infinity))minimum=Math.min(minimum,b.boundsTree.closestPointToPoint(point.fromBufferAttribute(a.attributes.position,i)).distance);
  return minimum*1000;
}
function intersections(a,b){
  if(!a.boundingBox.intersectsBox(b.boundingBox))return null;
  ensureBVH(a);ensureBVH(b);if(!a.boundsTree.intersectsGeometry(b,new Matrix4()))return null;
  return triangleCrossings(a,b);
}
const candidates=new Map();
const selected=surfaceMode?sourceFit.muscles.filter(p=>!p.fitGroup.endsWith('-hip')&&(surfaceMode==='whole-leg'||p.fitGroup.endsWith('-shank')||/Gastrocnemius medial|Plantaris|Popliteus/.test(p.name))):sourceFit.muscles.filter(p=>['VHF0005','VHF0043'].includes(p.id));
assert.equal(selected.length,surfaceMode==='whole-leg'?50:surfaceMode==='shank'?24:2);
const fitMatrix=fit=>new Matrix4().set(...fit.rows[0].map(v=>v*fit.scale),fit.offset[0],...fit.rows[1].map(v=>v*fit.scale),fit.offset[1],...fit.rows[2].map(v=>v*fit.scale),fit.offset[2],0,0,0,1);
for(const selectedPart of selected){
  const id=selectedPart.id,side=selectedPart.fitGroup.split('-')[0],a=sourceFit.fits[selectedPart.fitGroup];
  const target=surfaceMode?new Matrix4().fromArray(surfaceFits.fits.find(f=>f.side===side&&f.mode===surfaceMode).sourceToAtlasMatrix):fitMatrix(sourceFit.fits[`${side}-shank`]);
  const delta=target.clone().multiply(fitMatrix(a).invert());
  const sourcePart=parts.find(p=>p.p.id===id);assert.equal(sourcePart.p.name,selectedPart.name);
  const g=sourcePart.g.clone();g.applyMatrix4(delta);g.computeBoundingBox();
  candidates.set(id,{id,side,g,delta});
}
const report={createdAt:new Date().toISOString(),status:'CANDIDATE SCREEN ONLY; no runtime mutation',
  sourceFitMethod:surfaceMode?`Recompose every selected source-group inverse then the common ${surfaceMode} surface-fit transform.`:'Recompose the reproduced source thigh inverse then source shank similarity transform, without further fitting.',
  candidateMode:surfaceMode||'original-shank',candidateMeshes:candidates.size,otherMeshesPerCandidate:parts.length-1,
  comparisons:[],limitations:['All indexed vertices checked against the female skin with a 2mm numeric band, not tissue thickness.',
    'All other atlas meshes are screened for surface intersection, including normally hidden parts.',
    'No intersection does not exclude containment. New or worse crossings require review; surface crossing is not solid penetration depth.',
    'Nearest vertex-to-surface distances are not tendon attachment validation or exact triangle distance.',
    'Identical donor shank frame restores source-relative placement only; it does not prove alignment to the HRA bones.']};
for(const [id,candidate] of candidates){
  const original=parts.find(p=>p.p.id===id),beforeSkin=skinAudit(original.g),afterSkin=skinAudit(candidate.g);
  const pointwise={newOutside:0,worsenedOutside:0,resolvedOutside:0};
  assert.equal(beforeSkin.classified.size,afterSkin.classified.size);
  for(const [i,after] of afterSkin.classified){
    const before=beforeSkin.classified.get(i);assert.ok(before);
    if(after.kind==='outside'&&before.kind!=='outside')pointwise.newOutside++;
    if(after.kind==='outside'&&before.kind==='outside'&&after.distance>before.distance+1e-6)pointwise.worsenedOutside++;
    if(before.kind==='outside'&&after.kind!=='outside')pointwise.resolvedOutside++;
  }
  const row={id,name:original.p.name,side:candidate.side,sourceToCandidateMatrix:candidate.delta.toArray(),defaultHidden:/^Rectus femoris /.test(original.p.name),
    referencedVertices:referencedVertices(original.g,Infinity).length,
    skinBefore:beforeSkin.row,skinAfter:afterSkin.row,skinPointwise:pointwise,pairs:[],nearest:[]};
  for(const other of parts){
    if(other.p.id===id)continue;
    const before=intersections(original.g,other.g),after=intersections(candidate.g,candidates.get(other.p.id)?.g||other.g);
    if(before||after)row.pairs.push({otherId:other.p.id,name:other.p.name,system:other.p.system,before,after});
  }
  for(const name of original.p.name.startsWith('Gastrocnemius medial')?['Gastrocnemius lateral','Soleus','Femur','Tibia','Fibula']:[]){
    const other=parts.find(p=>p.p.name===`${name} (${candidate.side})`);assert.ok(other);
    row.nearest.push({id:other.p.id,name:other.p.name,beforeMm:nearest(original.g,other.g),afterMm:nearest(candidate.g,candidates.get(other.p.id)?.g||other.g)});
  }
  row.summary={beforePairs:row.pairs.filter(p=>p.before).length,afterPairs:row.pairs.filter(p=>p.after).length,
    newPairs:row.pairs.filter(p=>!p.before&&p.after).map(p=>p.otherId),removedPairs:row.pairs.filter(p=>p.before&&!p.after).map(p=>p.otherId)};
  report.comparisons.push(row);console.log(JSON.stringify({id,skinBefore:row.skinBefore,skinAfter:row.skinAfter,summary:row.summary,nearest:row.nearest}));
}
for(const p of ['scripts/audit-calf-registration.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs',
  'src/female-arm-registration.ts','src/female-foot-registration.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','package-lock.json'])read(p);
report.files=[...files].map(([path,sha256])=>({path,sha256}));
fs.mkdirSync('.cache/calf-registration',{recursive:true});fs.writeFileSync(`.cache/calf-registration/${surfaceMode?`surface-${surfaceMode}`:'shank'}-candidate.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();parts.forEach(p=>p.g.dispose());candidates.forEach(p=>p.g.dispose());
