// Cache-only common head placement. Approximate anchors are not clinical landmarks.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Box3,Matrix4,Vector3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';

const folder='.cache/sci-head-fit';fs.mkdirSync(folder,{recursive:true});
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const source=json('.cache/sci-head/shared-candidate.json'),packed=read(source.binary.path);assert.equal(sha(packed),source.binary.sha256);
const binary=gunzipSync(packed);assert.equal(binary.length,source.binary.bytes);
const atlas=json('public/models/female/atlas-female.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
function geometry(b,p){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(b.buffer,b.byteOffset+p.positions,p.vertexCount*3).slice(),3));
  g.setIndex(new BufferAttribute(new Uint32Array(b.buffer,b.byteOffset+p.indices,p.indexCount).slice(),1));g.computeBoundingBox();return g;
}
const sourceGeometry=id=>geometry(binary,source.parts.find(p=>p.id===id));
const targetGeometry=id=>{const p=atlas.parts.find(p=>p.id===id);assert.ok(p);return geometry(chunks[p.chunk],p);};
const sourceEnvelope=sourceGeometry('non-background-envelope'),sourceEyes=sourceGeometry('label-1'),skin=targetGeometry('HRAF0003');
skin.boundsTree=new MeshBVH(skin);
// Actual connected components, never a sign-of-X split that could cut a mesh.
const roots=Array.from({length:sourceEyes.attributes.position.count},(_,i)=>i),root=i=>{while(roots[i]!==i){roots[i]=roots[roots[i]];i=roots[i];}return i;};
for(let i=0;i<sourceEyes.index.count;i+=3){const a=sourceEyes.index.getX(i),b=sourceEyes.index.getX(i+1),c=sourceEyes.index.getX(i+2);roots[root(b)]=root(a);roots[root(c)]=root(a);}
const boxes=new Map(),point=new Vector3();
for(const i of referencedVertices(sourceEyes,Infinity)){const r=root(i);if(!boxes.has(r))boxes.set(r,new Box3());boxes.get(r).expandByPoint(point.fromBufferAttribute(sourceEyes.attributes.position,i));}
assert.equal(boxes.size,2);
const eyeBoxes=[...boxes.values()].sort((a,b)=>a.min.x-b.min.x);
const sourceEyeCenters=eyeBoxes.map(b=>b.getCenter(new Vector3()));
const eyeIds=[['HRAF0026','HRAF0041'],['HRAF0065','HRAF0050']]; // right/left sclera + cornea
const targetEyes=eyeIds.map(ids=>{const pieces=ids.map(targetGeometry),g=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());g.computeBoundingBox();return g;});
const targetEyeCenters=targetEyes.map(g=>g.boundingBox.getCenter(new Vector3()));
assert.ok(sourceEyeCenters[0].x<sourceEyeCenters[1].x&&targetEyeCenters[0].x<targetEyeCenters[1].x);
function topPatch(g){
  const indices=referencedVertices(g,Infinity).filter(i=>g.attributes.position.getY(i)>=g.boundingBox.max.y-.001);
  assert.ok(indices.length);const center=new Vector3();for(const i of indices)center.add(point.fromBufferAttribute(g.attributes.position,i));
  return {center:center.multiplyScalar(1/indices.length),vertices:indices.length};
}
const sourceTop=topPatch(sourceEnvelope),targetTop=topPatch(skin);
const from=[...sourceEyeCenters,sourceTop.center],onto=[...targetEyeCenters,targetTop.center];
assert.ok(new Vector3().subVectors(from[1],from[0]).cross(new Vector3().subVectors(from[2],from[0])).length()>1e-5);
const anchorMatrix=fitSimilarity(from,onto);
// Excludes most neck and all inferior scan caps. This is a diagnostic crop,
// not a named anatomical subregion or independently reviewed head boundary.
const sourceCutY=(sourceEyeCenters[0].y+sourceEyeCenters[1].y)/2-.04;
const eligible=referencedVertices(sourceEnvelope,Infinity).filter(i=>sourceEnvelope.attributes.position.getY(i)>sourceCutY);
const indices=Array.from({length:Math.min(4000,eligible.length)},(_,i)=>eligible[Math.floor(i*(eligible.length-1)/(Math.min(4000,eligible.length)-1))]);
const samples=indices.map(i=>new Vector3().fromBufferAttribute(sourceEnvelope.attributes.position,i));
const matrix=anchorMatrix.clone(),history=[];let previous=Infinity,converged=false;
for(let iteration=0;iteration<150;iteration++){
  const current=[],targets=[];let squares=0;
  for(const p of samples){const q=p.clone().applyMatrix4(matrix),hit=skin.boundsTree.closestPointToPoint(q);current.push(q);targets.push(hit.point.clone());squares+=hit.distance**2;}
  const rms=Math.sqrt(squares/samples.length);history.push(rms*1000);
  if(iteration%25===0)console.log(JSON.stringify({iteration,sampleRmsMm:rms*1000}));
  if(Math.abs(previous-rms)<1e-8){converged=true;break;}previous=rms;
  matrix.premultiply(fitSimilarity(current,targets));const scale=Math.cbrt(matrix.determinant());assert.ok(scale>.65&&scale<1.4&&matrix.elements.every(Number.isFinite));
}
const fits=[{mode:'anchors',matrix:anchorMatrix.toArray(),scale:Math.cbrt(anchorMatrix.determinant())},
  {mode:'skin-refined',matrix:matrix.toArray(),scale:Math.cbrt(matrix.determinant()),converged,iterations:history.length,sampleRmsHistoryMm:history}];
const probe=surfaceProbe(skin),results=[];
const materialIds=['label-1','label-2','label-3','label-6'];
for(const fit of fits){
  const transform=new Matrix4().fromArray(fit.matrix),distances=[];
  for(const i of eligible){point.fromBufferAttribute(sourceEnvelope.attributes.position,i).applyMatrix4(transform);distances.push(skin.boundsTree.closestPointToPoint(point).distance*1000);}
  distances.sort((a,b)=>a-b);
  const result={mode:fit.mode,anchorResidualsMm:from.map((p,i)=>p.clone().applyMatrix4(transform).distanceTo(onto[i])*1000),
    croppedSourceEnvelope:{vertices:eligible.length,medianMm:distances[Math.floor(distances.length*.5)],p95Mm:distances[Math.floor(distances.length*.95)],maximumMm:distances.at(-1)},materials:[]};
  for(const id of materialIds){
    const g=sourceGeometry(id).applyMatrix4(transform);g.computeBoundingBox();
    const counts={inside:0,'surface-band':0,outside:0,ambiguous:0};let maximumOutsideMm=0,witness=null;
    for(const i of referencedVertices(g,Infinity)){
      point.fromBufferAttribute(g.attributes.position,i);const p=probe.classify(point);counts[p.kind]++;
      if(p.kind==='outside'&&p.distance*1000>maximumOutsideMm){maximumOutsideMm=p.distance*1000;witness={vertex:i,point:point.toArray()};}
    }
    const row={id,vertices:g.attributes.position.count,bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],counts,maximumOutsideMm,witness};
    result.materials.push(row);console.log(JSON.stringify({mode:fit.mode,...row}));g.dispose();
  }
  results.push(result);
}
for(const p of ['scripts/fit-sci-head.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(p);
const rejectedModes=results.filter(r=>r.materials.find(m=>m.id==='label-6').counts.outside>0).map(r=>r.mode);
const report={status:rejectedModes.length===fits.length?'REJECTED: bone vertices outside target skin in both placements; no runtime replacement':'UNAPPROVED: further correspondence checks required',rejectedModes,
  anchors:{sourceEyes:sourceEyeCenters.map(p=>p.toArray()),sourceEyeBounds:eyeBoxes.map(b=>[b.min.toArray(),b.max.toArray()]),targetEyes:targetEyeCenters.map(p=>p.toArray()),targetEyePartIds:eyeIds,
    sourceTop:{point:sourceTop.center.toArray(),vertices:sourceTop.vertices},targetTop:{point:targetTop.center.toArray(),vertices:targetTop.vertices}},
  sampling:{sourceCutY,sourceEnvelopeEligibleVertices:eligible.length,fitVertices:indices.length,indices},fits,results,
  limitations:['Source label 1 is inferred as eyes; target sclera/cornea bounding-box centers and superior 1mm patch means are approximate geometric anchors, not expert landmarks.',
    'Skin refinement uses only 4000 deterministic source-envelope samples and unlabelled full target-skin nearest triangles. Full eligible-vertex distances are held apart from fitting samples.',
    'One common proper similarity transform for all source tissues. No local warping or runtime peel-dependent movement.',
    'Containment checks every referenced vertex only for labels 1,2,3,6, using a 2mm target skin band. Other tissue/air/envelope labels and triangle interiors are not certified.',
    'Source bone material includes neck and modeled oral bone; it is not a one-to-one named skull substitute.',
    'Preserved source relations and skin containment do not validate native HRA eye/cranial nerve/spinal cord connections or regional brain naming.',
    'No runtime source, anatomy membership, interaction or model coordinates changed.'],files:[...files].map(([path,sha256])=>({path,sha256}))};
fs.writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fits:fits.map(({mode,scale,converged})=>({mode,scale,converged})),results}));
probe.dispose();for(const g of [sourceEnvelope,sourceEyes,skin,...targetEyes])g.dispose();
