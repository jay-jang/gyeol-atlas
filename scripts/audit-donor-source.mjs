// Read-only reproduction of the upstream donor fit, using the user-supplied STL set.
// No export path to runtime geometry. Source coordinates are millimetres.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Box3,Vector3,Matrix4} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const root=process.argv[2],archive=process.argv[3];assert.ok(root,'Pass extracted Final 3D STL Models-stl directory');
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const loader=new STLLoader(),donors=[];
function walk(folder){for(const e of fs.readdirSync(folder,{withFileTypes:true})){
  const file=path.join(folder,e.name);if(e.isDirectory()){walk(file);continue;}
  if(!e.name.toLowerCase().endsWith('.stl'))continue;
  const m=/^VHF_(Left|Right)_(Bone|Muscle|Cartilage|Ligament)_(.+?)_smooth\.stl$/.exec(e.name);assert.ok(m,e.name);
  const bytes=fs.readFileSync(file),g=loader.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const a=g.attributes.position,box=new Box3();
  assert.equal(a.count%3,0);assert.ok(a.count>0);
  for(let i=0;i<a.count;i++){
    const p=new Vector3(a.getX(i)/1000,a.getY(i)/1000,a.getZ(i)/1000);
    assert.ok(p.toArray().every(Number.isFinite));box.expandByPoint(p);
  }
  g.dispose();donors.push({file,relative:path.relative(root,file),side:m[1].toLowerCase(),kind:m[2].toLowerCase(),structure:m[3],
    sha256:sha(file),triangles:a.count/3,box});
}}
walk(root);assert.equal(donors.length,128);
const count=kind=>donors.filter(p=>p.kind===kind).length;
assert.deepEqual(['bone','muscle','cartilage','ligament'].map(count),[28,76,16,8]);
const centre=b=>b.getCenter(new Vector3()).toArray();
const corners=b=>Array.from({length:8},(_,i)=>[i&1?b.max.x:b.min.x,i&2?b.max.y:b.min.y,i&4?b.max.z:b.min.z]);
const spin=(r,p)=>r.map(row=>row.reduce((n,v,i)=>n+v*p[i],0));
const identity=[[1,0,0],[0,1,0],[0,0,1]];
function place(rows,from,onto){
  const turned=from.map(p=>spin(rows,p));
  const mean=pts=>[0,1,2].map(k=>pts.reduce((n,p)=>n+p[k]/pts.length,0));
  const a=mean(turned),b=mean(onto);let num=0,den=0;
  for(let i=0;i<turned.length;i++)for(let k=0;k<3;k++){const d=turned[i][k]-a[k];num+=d*(onto[i][k]-b[k]);den+=d*d;}
  const scale=num/den,offset=b.map((v,k)=>v-scale*a[k]);
  return {rows,scale,offset,error:Math.max(...turned.flatMap((p,i)=>p.map((v,k)=>Math.abs(scale*v+offset[k]-onto[i][k]))))};
}
const groups=[
  {id:'hip',sorts:['Pelvis'],anchors:[['Pelvis',/^(ilium|ischium|pubis) (compact|spongy) bone/i],['Femur',/^femur \(/i]]},
  {id:'thigh',sorts:['Femur','Patella'],anchors:[['Femur',/^femur \(/i],['Patella',/^patella \(/i]]},
  {id:'shank',sorts:['Tibia','Fibula'],anchors:[['Tibia',/^tibia \(/i],['Fibula',/^fibula \(/i]]},
];
const donorBone=(name,side)=>{const d=donors.filter(p=>p.kind==='bone'&&p.side===side&&p.structure===name);assert.equal(d.length,1);return d[0];};
const ownBox=(re,side)=>{
  const parts=atlas.parts.filter(p=>re.test(p.name)&&p.name.includes(`(${side})`));assert.ok(parts.length);
  return parts.reduce((box,p)=>box.union(new Box3(new Vector3(...p.bounds[0]),new Vector3(...p.bounds[1]))),new Box3());
};
const correspondences=[];
for(const side of ['left','right'])for(const group of groups)for(const [name,re] of group.anchors)
  correspondences.push({from:centre(donorBone(name,side).box),onto:centre(ownBox(re,side))});
const rotations=[];
for(const permutation of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]])
  for(const x of [1,-1])for(const y of [1,-1])for(const z of [1,-1]){
    const rows=permutation.map((axis,k)=>[0,1,2].map(j=>axis===j?[x,y,z][k]:0));
    const matrix=new Matrix4().set(...rows[0],0,...rows[1],0,...rows[2],0,0,0,0,1);
    if(matrix.determinant()>0)rotations.push(rows);
  }
assert.equal(rotations.length,24);
const frame=rotations.map(r=>place(r,correspondences.map(p=>p.from),correspondences.map(p=>p.onto))).sort((a,b)=>a.error-b.error)[0];
const fits={},marks=[];
for(const side of ['left','right'])for(const group of groups){
  const from=[],onto=[];
  for(const [name,re] of group.anchors){
    const turned=new Box3().setFromPoints(corners(donorBone(name,side).box).map(p=>new Vector3(...spin(frame.rows,p))));
    from.push(...corners(turned));onto.push(...corners(ownBox(re,side)));
  }
  const fit={...place(identity,from,onto),rows:frame.rows},key=`${side}-${group.id}`;fits[key]=fit;
  assert.equal(+fit.scale.toFixed(4),atlas.donorMuscle.groups[key].scale,key);
  assert.equal(+(fit.error*1000).toFixed(1),atlas.donorMuscle.groups[key].boneAgreementMillimetres,key);
  for(const name of group.sorts)marks.push({key,side,at:centre(donorBone(name,side).box)});
}
const apply=(t,p)=>spin(t.rows,p).map((v,k)=>v*t.scale+t.offset[k]);
const muscles=donors.filter(p=>p.kind==='muscle').map(d=>{
  const part=atlas.parts.find(p=>p.conceptId===`VHF:${d.side}-${d.structure}`);assert.ok(part,d.relative);
  const c=centre(d.box),mark=marks.filter(m=>m.side===d.side).sort((a,b)=>
    a.at.reduce((n,v,k)=>n+(v-c[k])**2,0)-b.at.reduce((n,v,k)=>n+(v-c[k])**2,0))[0];
  const importedGroup=atlas.concepts.find(c=>c.id.startsWith('VHF:group-')&&c.elements.includes(part.id));
  assert.equal(`VHF:group-${mark.key.split('-')[1]}`,importedGroup.id);
  const transformed=new Box3().setFromPoints(corners(d.box).map(p=>new Vector3(...apply(fits[mark.key],p))));
  const residualMm=Math.max(...[transformed.min.toArray(),transformed.max.toArray()].flatMap((b,i)=>b.map((v,k)=>Math.abs(v-part.bounds[i][k])*1000)));
  assert.ok(residualMm<.002,`${part.id}: bounds mismatch ${residualMm}mm`);
  return {...d,id:part.id,name:part.name,fitGroup:mark.key,importManifestBoundResidualMm:residualMm};
});
function geometry(d,fit){
  const b=fs.readFileSync(d.file),g=loader.parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const a=g.attributes.position;
  for(let i=0;i<a.count;i++){
    let p=[a.getX(i)/1000,a.getY(i)/1000,a.getZ(i)/1000];if(fit)p=apply(fit,p);a.setXYZ(i,...p);
  }
  g.deleteAttribute('normal');const welded=mergeVertices(g,1e-9);g.dispose();welded.boundsTree=new MeshBVH(welded);return welded;
}
function nearest(a,b){
  let minimum=Infinity;const p=new Vector3(),vertices=a.attributes.position;
  for(let i=0;i<vertices.count;i++)minimum=Math.min(minimum,b.boundsTree.closestPointToPoint(p.fromBufferAttribute(vertices,i)).distance);
  return minimum*1000;
}
function relation(a,b){return {forwardVertexToSurfaceMm:nearest(a,b),reverseVertexToSurfaceMm:nearest(b,a),...triangleCrossings(a,b)};}
const calf=[];
for(const side of ['left','right']){
  const selected=['GastrocnemiusMedial','GastrocnemiusLateral','Soleus'].map(name=>muscles.find(p=>p.side===side&&p.structure===name));
  const raw=selected.map(d=>geometry(d)),fitted=selected.map(d=>geometry(d,fits[d.fitGroup]));
  for(const [a,b] of [[0,1],[0,2],[1,2]]){
    const row={side,ids:[selected[a].id,selected[b].id],names:[selected[a].name,selected[b].name],
      fitGroups:[selected[a].fitGroup,selected[b].fitGroup],raw:relation(raw[a],raw[b]),fittedBeforeSimplification:relation(fitted[a],fitted[b])};
    calf.push(row);console.log(JSON.stringify(row));
  }
  [...raw,...fitted].forEach(g=>g.dispose());
}
const clean=d=>({file:d.relative,sha256:d.sha256,side:d.side,kind:d.kind,structure:d.structure,triangles:d.triangles,bounds:[d.box.min.toArray(),d.box.max.toArray()]});
const report={createdAt:new Date().toISOString(),status:'SOURCE FIT REPRODUCED; no runtime correction applied',
  sourceUrl:'https://digitalcommons.du.edu/visiblehuman/1/',license:'CC-BY-4.0',
  archive:archive?{file:path.basename(archive),bytes:fs.statSync(archive).size,sha256:sha(archive)}:null,
  inventory:{bone:28,muscle:76,cartilage:16,ligament:8},frame,fits,
  maximumManifestBoundResidualMm:Math.max(...muscles.map(p=>p.importManifestBoundResidualMm)),
  files:donors.map(clean),muscles:muscles.map(d=>({id:d.id,name:d.name,source:d.relative,fitGroup:d.fitGroup,importManifestBoundResidualMm:d.importManifestBoundResidualMm})),calf,
  limitations:['Pre-simplification manifest bounds and grouping are reproduced, not every packed vertex.',
    'Raw and fitted calf measurements use the same STL geometry; their change isolates the recorded similarity transforms, not anatomical attachment validity.',
    'Nearest vertex-to-surface distances are not exact continuous triangle minima or tendon attachment lengths.',
    'Crossing counts are surface diagnostics, not solid penetration depths or clinical approval.',
    'Only six calf muscle-pair relations are measured here; 76 bounds checks are not all-muscle anatomical validation.'],
  provenance:[atlasPath,'scripts/audit-donor-source.mjs','.cache/donor-muscle/upstream-import-lower-limb.mjs',path.join(root,'README.txt')].map(p=>({file:path.basename(p),sha256:sha(p)}))};
fs.mkdirSync('.cache/donor-muscle',{recursive:true});fs.writeFileSync('.cache/donor-muscle/source-comparison.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({inventory:report.inventory,maxResidualMm:report.maximumManifestBoundResidualMm}));
