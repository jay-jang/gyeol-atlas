// One common placement for the source head. Cache-only registration experiment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Quaternion,Vector3,Box3} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {fitSimilarity} from './lib/similarity-fit.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';

const folder='.cache/vivaplus-head-fit';fs.mkdirSync(folder,{recursive:true});
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const data=fs.readFileSync(file);files.set(file,sha(data));return data;};
const json=file=>JSON.parse(read(file));
const source=json('.cache/vivaplus-head/consistent-surfaces.json');
const extraction=json('docs/anatomy-alignment/vivaplus-head-consistent-extraction.json');
assert.equal(files.get('.cache/vivaplus-head/consistent-surfaces.json'),extraction.geometrySha256);
const atlas=json('public/models/female/atlas-female.json'),catalog=json('data/female-atlas-structures.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`)));
function geometry(positions,indices){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array(positions),3));
  g.setIndex(new BufferAttribute(new Uint32Array(indices),1));g.computeBoundingBox();return g;
}
function packed(part){
  const b=chunks[part.chunk];return geometry(
    Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+i*4)),
    Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+i*4)));
}
const sourceSkinMesh=source.meshes.find(m=>m.id==='head-skin-union'),sourceSkullMesh=source.meshes.find(m=>m.id==='skull-trabecular-union');
assert.ok(sourceSkinMesh&&sourceSkullMesh);
const sourceSkin=geometry(sourceSkinMesh.positions,sourceSkinMesh.indices),sourceSkull=geometry(sourceSkullMesh.positions,sourceSkullMesh.indices);
const skin=packed(atlas.parts.find(p=>p.id==='HRAF0003'));skin.boundsTree=new MeshBVH(skin);
const headHeight=sourceSkin.boundingBox.max.y-sourceSkin.boundingBox.min.y;
const targetCutY=skin.boundingBox.max.y-headHeight,targetHeadVertices=referencedVertices(skin,Infinity).filter(i=>skin.attributes.position.getY(i)>=targetCutY);
assert.ok(targetHeadVertices.length>100);
const targetBox=new Box3(),point=new Vector3();
for(const i of targetHeadVertices)targetBox.expandByPoint(point.fromBufferAttribute(skin.attributes.position,i));
const offset=targetBox.getCenter(new Vector3()).sub(sourceSkin.boundingBox.getCenter(new Vector3()));
offset.y=skin.boundingBox.max.y-sourceSkin.boundingBox.max.y;
const initial=new Matrix4().makeTranslation(...offset.toArray());
const sourceFitVertices=referencedVertices(sourceSkin,Infinity).filter(i=>sourceSkin.attributes.position.getY(i)>sourceSkin.boundingBox.min.y+.01);
const samples=sourceFitVertices.map(i=>new Vector3().fromBufferAttribute(sourceSkin.attributes.position,i));
function fit(mode){
  const matrix=initial.clone(),history=[];let previous=Infinity,converged=false;
  for(let iteration=0;iteration<200;iteration++){
    const from=[],onto=[];let squares=0;
    for(const sample of samples){
      const p=sample.clone().applyMatrix4(matrix),nearest=skin.boundsTree.closestPointToPoint(p);
      from.push(p);onto.push(nearest.point.clone());squares+=nearest.distance**2;
    }
    const rms=Math.sqrt(squares/samples.length);history.push(rms*1000);
    if(iteration%25===0)console.log(JSON.stringify({mode,iteration,rmsMm:rms*1000}));
    if(Math.abs(previous-rms)<1e-8){converged=true;break;}previous=rms;
    const increment=fitSimilarity(from,onto);
    if(mode==='rigid'){
      const q=new Quaternion(),scale=new Vector3();increment.decompose(new Vector3(),q,scale);
      const mean=points=>points.reduce((s,p)=>s.add(p),new Vector3()).multiplyScalar(1/points.length);
      increment.compose(mean(onto).sub(mean(from).applyQuaternion(q)),q,new Vector3(1,1,1));
    }
    matrix.premultiply(increment);
    assert.ok(matrix.elements.every(Number.isFinite));
    const scale=Math.cbrt(matrix.determinant());assert.ok(scale>.7&&scale<1.3,'Unstable head fit');
  }
  const finalRmsMm=Math.sqrt(samples.reduce((sum,p)=>sum+skin.boundsTree.closestPointToPoint(p.clone().applyMatrix4(matrix)).distance**2,0)/samples.length)*1000;
  return {mode,matrix:matrix.toArray(),converged,iterations:history.length,sampleRmsMm:history,finalRmsMm,scale:Math.cbrt(matrix.determinant())};
}
const fits=[{mode:'initial',matrix:initial.toArray(),scale:1,converged:false,iterations:0},fit('rigid'),fit('similarity')];
const borrowedIds=['BM0004','BM0009','BM0017','BM0007','BM0015','BM0020','BM0010','BM0018','BM0013','BM0006','BM0014','BM0011','BM0019'];
// Matches source frontal/parietal/nasal/sphenoid/temporal/occipital/maxillary/
// zygomatic regions. Source frontal and occipital are split by side (16 vs 13).
assert.equal(borrowedIds.length,13);
const borrowedParts=borrowedIds.map(id=>{const p=atlas.parts.find(p=>p.id===id);assert.equal(p.system,'borrowed');return p;});
const borrowedPieces=borrowedParts.map(packed),borrowed=mergeGeometries(borrowedPieces);borrowedPieces.forEach(g=>g.dispose());
borrowed.computeBoundingBox();borrowed.boundsTree=new MeshBVH(borrowed);
const neuralParts=atlas.parts.filter(p=>catalog.find(c=>c.id===p.id)?.layer==='nerve');assert.equal(neuralParts.length,362);
const neural=neuralParts.map(p=>{const g=packed(p);g.boundsTree=new MeshBVH(g);return {part:p,geometry:g};});
const probe=surfaceProbe(skin),results=[];
function distances(g,target,indices=referencedVertices(g,Infinity)){
  const values=[];let witness=null;
  for(const i of indices){
    point.fromBufferAttribute(g.attributes.position,i);const hit=target.boundsTree.closestPointToPoint(point),distanceMm=hit.distance*1000;values.push(distanceMm);
    if(!witness||distanceMm>witness.distanceMm)witness={vertex:i,point:point.toArray(),nearest:hit.point.toArray(),distanceMm};
  }
  values.sort((a,b)=>a-b);return {vertices:values.length,medianMm:values[Math.floor(values.length*.5)],p95Mm:values[Math.floor(values.length*.95)],maximumMm:values.at(-1),witness};
}
function inspectSkull(mode,g){
  const containment={inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0};let outsideWitness=null;
  for(const i of referencedVertices(g,Infinity)){
    point.fromBufferAttribute(g.attributes.position,i);const c=probe.classify(point);containment[c.kind]++;
    if(c.kind==='outside'&&c.distance*1000>containment.maximumOutsideMm){containment.maximumOutsideMm=c.distance*1000;outsideWitness={vertex:i,point:point.toArray(),distanceMm:c.distance*1000};}
  }
  const crossings=[];
  for(const {part,geometry:other} of neural){
    if(!g.boundingBox.intersectsBox(other.boundingBox))continue;
    const witness=meshCrossingWitness(g,other);if(witness)crossings.push({id:part.id,name:part.name,system:part.system,witness});
  }
  console.log(JSON.stringify({mode,containment,crossingNeuralMeshes:crossings.length}));
  return {mode,vertices:referencedVertices(g,Infinity).length,containment,outsideWitness,crossings};
}
results.push(inspectSkull('current-borrowed',borrowed));
const visual=[{id:'current-borrowed',kind:'skull',positions:Array.from(borrowed.attributes.position.array),indices:Array.from(borrowed.index.array)}];
for(const fit of fits){
  const matrix=new Matrix4().fromArray(fit.matrix),headSkin=sourceSkin.clone().applyMatrix4(matrix),skull=sourceSkull.clone().applyMatrix4(matrix);
  headSkin.computeBoundingBox();headSkin.boundsTree=new MeshBVH(headSkin);skull.computeBoundingBox();skull.boundsTree=new MeshBVH(skull);
  const relation=inspectSkull(fit.mode,skull);
  relation.skinForward=distances(headSkin,skin);relation.skinReverse=distances(skin,headSkin,targetHeadVertices);
  const baseline=new Set(results[0].crossings.map(r=>r.id)),current=new Set(relation.crossings.map(r=>r.id));
  relation.newCrossingNeuralIds=[...current].filter(id=>!baseline.has(id));relation.absentCrossingNeuralIds=[...baseline].filter(id=>!current.has(id));
  results.push(relation);
  for(const [kind,g] of [['skin',headSkin],['skull',skull]])visual.push({id:`${fit.mode}-${kind}`,mode:fit.mode,kind,positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});
  skull.dispose();headSkin.dispose();
}
// The target slice is a diagnostic crop, never a replacement surface or fit cap.
const skinIndices=[];
for(let i=0;i<skin.index.count;i+=3){const ids=[0,1,2].map(k=>skin.index.getX(i+k));if(ids.every(n=>skin.attributes.position.getY(n)>=targetCutY))skinIndices.push(...ids);}
visual.push({id:'target-head-skin',kind:'target-skin',positions:Array.from(skin.attributes.position.array),indices:skinIndices});
const brainPieces=neural.filter(r=>r.part.system==='brain').map(r=>r.geometry),brain=mergeGeometries(brainPieces);
visual.push({id:'target-brain',kind:'brain',positions:Array.from(brain.attributes.position.array),indices:Array.from(brain.index.array)});
const zipped=gzipSync(JSON.stringify({meshes:visual}));fs.writeFileSync(`${folder}/comparison.json.gz`,zipped);
for(const file of ['scripts/fit-vivaplus-head.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs','package-lock.json'])read(file);
const rejectedModes=results.slice(1).filter(r=>r.newCrossingNeuralIds.length>0).map(r=>r.mode);
const report={createdAt:new Date().toISOString(),status:rejectedModes.length===fits.length?'REJECTED; new neural crossings in every placement; no runtime change':'NOT APPROVED; further correspondence checks required',rejectedModes,
  initialPlacement:{matrix:initial.toArray(),method:'Preserve axes/scale; align superior skin extent and horizontal centre of target skin crop',targetCutY,sourceHeadHeightMetres:headHeight},
  fitSelection:{sourceVertices:sourceFitVertices.length,sourceSkinVertices:sourceSkin.attributes.position.count,excludedInferiorStripMm:10,targetReverseVertices:targetHeadVertices.length},
  fits,results,borrowedIds,sourceSkullPartIds:sourceSkullMesh.sourcePartIds,neuralCompared:neural.length,
  visualization:{path:`${folder}/comparison.json.gz`,sha256:sha(zipped),gzipBytes:zipped.length},
  limitations:['Nearest skin is an unlabelled local fit, not correspondence of named cranial landmarks or a global optimum.',
    'Only a common rigid or proper uniform-scale transform is allowed; there is no local skull deformation or movement during peeling.',
    'Reverse skin distances use an initial source-height-based target crop; this is not a validated anatomical segmentation.',
    'Candidate skull is trabecular boundary only, whereas current bones include their source whole-bone surfaces. Witness reductions alone cannot approve replacement.',
    'Source and target represent different reference models; preserving source positions relative to one another does not establish compatibility with HRA brain.',
    'Neural-layer comparisons include brain cavities and sensory supporting tissues. First transverse triangle witness is not penetration depth or a clinical diagnosis.',
    'Zero witnesses does not prove separation or correct nerve passages. Skin containment uses a 2mm boundary band.',
    'FE brain/CSF unresolved parts, cortical thickness, mandible, teeth and cervical articulation are not repaired by this experiment.',
    'No source assets, atlas metadata, UI, or runtime coordinates were changed.'],files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${folder}/report.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({fits:fits.map(({mode,scale,converged,iterations,finalRmsMm})=>({mode,scale,converged,iterations,finalRmsMm})),results:results.map(({mode,containment,crossings,newCrossingNeuralIds,skinForward,skinReverse})=>({mode,containment,crossingNeuralMeshes:crossings.length,newCrossingNeuralIds,skinForward,skinReverse}))}));
probe.dispose();for(const {geometry:g} of neural)g.dispose();for(const g of [skin,sourceSkin,sourceSkull,borrowed,brain])g.dispose();
