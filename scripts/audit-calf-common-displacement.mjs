// Read back the saved experimental candidate independently, then screen every
// pair involving a changed mesh against the CURRENT female runtime geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3,Ray,DoubleSide} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const out='.cache/calf-common-displacement',files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const candidate=json(`${out}/report.json`);for(const f of candidate.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const zipped=read(candidate.binary.path);assert.equal(sha(zipped),candidate.binary.sha256);const bytes=gunzipSync(zipped);assert.equal(bytes.length,candidate.binary.bytes);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const rawZipped=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(rawZipped),packing.sha256);const raw=gunzipSync(rawZipped);
const scalar=(p,side)=>{
  const e=side.initialMatrix;let x=e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12],y=e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13],z=e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14];
  for(const s of side.steps){const dx=x-s.centre[0],dy=y-s.centre[1],dz=z-s.centre[2],k=Math.exp(-(dx*dx+dy*dy+dz*dz)/(2*s.sigma*s.sigma));x+=k*s.displacement[0];y+=k*s.displacement[1];z+=k*s.displacement[2];}
  return [x,y,z];
};
const readback={vertices:0,indexReferences:0,differentFloat32Coordinates:0,maximumCoordinateResidualMetres:0,minimumWitnesses:[]};
for(const side of candidate.sides){
  for(const step of side.steps){const bound=Math.sqrt(step.displacement.reduce((n,v)=>n+v*v,0))/(step.sigma*Math.sqrt(Math.E));assert.ok(bound<1);assert.ok(Math.abs(bound-step.lipschitzBound)<1e-14);}
  for(const m of side.muscles){
    const p=candidate.binary.parts.find(p=>p.id===m.id),source=packing.parts.find(p=>p.id===m.id);assert.equal(p.vertexCount,source.vertexCount);assert.equal(p.indexCount,source.indexCount);
    for(let i=0;i<p.vertexCount;i++){
      const input=[0,1,2].map(k=>raw.readFloatLE(source.positions+4*(3*i+k))),expected=scalar(input,side).map(Math.fround);
      for(let k=0;k<3;k++){const value=bytes.readFloatLE(p.positions+4*(3*i+k)),error=Math.abs(expected[k]-value);readback.differentFloat32Coordinates+=value!==expected[k];readback.maximumCoordinateResidualMetres=Math.max(readback.maximumCoordinateResidualMetres,error);assert.ok(error<=1e-7);}
      readback.vertices++;
    }
    for(let i=0;i<p.indexCount;i++){assert.equal(bytes.readUInt32LE(p.indices+4*i),raw.readUInt32LE(source.indices+4*i));readback.indexReferences++;}
    const witness=m.minimumWitness,derivative=[];
    for(let axis=0;axis<3;axis++){
      const a=[...witness.sourcePointMetres],b=[...a],h=1e-6;a[axis]-=h;b[axis]+=h;const x=scalar(a,side),y=scalar(b,side);
      for(let row=0;row<3;row++)derivative.push((y[row]-x[row])/(2*h));
    }
    const residual=Math.max(...derivative.map((v,i)=>Math.abs(v-witness.jacobianColumnMajor[i])));assert.ok(residual<1e-6);
    readback.minimumWitnesses.push({id:m.id,vertex:witness.vertex,finiteDifferenceStepMetres:1e-6,jacobianColumnMajor:derivative,maximumElementResidual:residual});
  }
}
const atlas=json('public/models/female/atlas-female.json'),catalog=json('data/female-atlas-structures.json'),catalogMap=new Map(catalog.map(p=>[p.id,p]));
const chunks=atlas.chunks.map(c=>gunzipSync(read(`public/models/female/${c.gzip.split('/').pop()}`))),byId=new Map(atlas.parts.map(p=>[p.id,p]));
const restoration=json('data/catalog/female-source-restoration.json'),r=gunzipSync(read(`public/${restoration.url}`)),restored=r.buffer.slice(r.byteOffset,r.byteOffset+r.byteLength);
const finish=g=>{g.computeBoundingBox();g.boundsTree=new MeshBVH(g,{indirect:true});return g;};
function geometry(data,p){
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>data.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>data.readUInt32LE(p.indices+4*i)),1));return g;
}
const parts=atlas.parts.map(p=>{
  const q=resolveFemaleBrainGeometryPart(p,'female',byId),g=geometry(chunks[q.chunk],q);
  applyFemaleSourceRestoration(g,'female',p.id,p.system,restored);applyFemaleArmRegistration(g,'female',p.id,p.system);applyFemaleFootRegistration(g,'female',p.id,p.system);
  return {id:p.id,name:p.name,system:p.system,layer:catalogMap.get(p.id).layer,g:finish(g)};
});assert.equal(parts.length,1220);
const changed=new Map(candidate.binary.parts.map(p=>[p.id,finish(geometry(bytes,p))]));assert.equal(changed.size,24);
const skin=parts.find(p=>p.id==='HRAF0003'),probe=surfaceProbe(skin.g,.002),point=new Vector3(),ambiguities=[];
for(const [id,g] of changed)for(const vertex of referencedVertices(g,Infinity)){
  point.fromBufferAttribute(g.attributes.position,vertex);const result=probe.classify(point);if(result.kind!=='ambiguous')continue;
  const directions=[[1,.137,.071],[.117,1,.193],[.073,.127,1]];
  for(let i=0;i<32;i++){const z=1-2*(i+.5)/32,a=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-z*z);directions.push([r*Math.cos(a),r*Math.sin(a),z]);}
  const rays=directions.map(d=>{
    const direction=new Vector3(...d).normalize(),hits=skin.g.boundsTree.raycast(new Ray(point,direction),DoubleSide).sort((a,b)=>a.distance-b.distance);
    let last=-Infinity,crossings=0;for(const h of hits)if(h.distance-last>1e-7){last=h.distance;crossings++;}
    return {direction:direction.toArray(),crossings,parity:crossings%2,hits:hits.map(h=>({distanceMetres:h.distance,faceIndex:h.faceIndex,pointMetres:h.point.toArray()}))};
  });
  const position=skin.g.attributes.position,index=skin.g.index.array;let angle=0;
  for(let i=0;i<index.length;i+=3){
    const [a,b,c]=[0,1,2].map(k=>new Vector3().fromBufferAttribute(position,index[i+k]).sub(point));
    const lengths=[a.length(),b.length(),c.length()],numerator=a.dot(b.clone().cross(c)),denominator=lengths[0]*lengths[1]*lengths[2]+a.dot(b)*lengths[2]+b.dot(c)*lengths[0]+c.dot(a)*lengths[1];
    angle+=2*Math.atan2(numerator,denominator);
  }
  ambiguities.push({id,vertex,pointMetres:point.toArray(),original:result,rays,signedSolidAngleWinding:angle/(4*Math.PI),interpretation:'Additional numerical evidence only; original ambiguous classification is retained'});
}
const crosses=(a,b)=>a.boundingBox.intersectsBox(b.boundingBox)&&a.boundsTree.intersectsGeometry(b,new Matrix4());
const relations=[];let pairCount=0;
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=parts[i],b=parts[j];if(!changed.has(a.id)&&!changed.has(b.id))continue;pairCount++;
  const afterA=changed.get(a.id)||a.g,afterB=changed.get(b.id)||b.g,before=crosses(a.g,b.g),after=crosses(afterA,afterB);
  if(before||after)relations.push({ids:[a.id,b.id],names:[a.name,b.name],systems:[a.system,b.system],layers:[a.layer,b.layer],bothChanged:changed.has(a.id)&&changed.has(b.id),before:before?triangleCrossings(a.g,b.g):null,after:after?triangleCrossings(afterA,afterB):null});
}
assert.equal(pairCount,24*1196+24*23/2);
const counts=rows=>({beforePairs:rows.filter(p=>p.before).length,afterPairs:rows.filter(p=>p.after).length,newPairs:rows.filter(p=>!p.before&&p.after).length,removedPairs:rows.filter(p=>p.before&&!p.after).length});
const summary={meshes:parts.length,changedMeshes:changed.size,uniquePairs:pairCount,...counts(relations),newByOtherLayer:{},withUnchangedMeshes:counts(relations.filter(p=>!p.bothChanged)),withinChangedMeshes:counts(relations.filter(p=>p.bothChanged))};
for(const r of relations.filter(p=>!p.before&&p.after&&!p.bothChanged)){
  const layer=r.layers[changed.has(r.ids[0])?1:0];summary.newByOtherLayer[layer]=(summary.newByOtherLayer[layer]||0)+1;
}
for(const p of ['scripts/audit-calf-common-displacement.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','scripts/lib/triangle-crossings.mjs','scripts/lib/surface-containment.mjs'])read(p);
const report={createdAt:new Date().toISOString(),status:'FULL PAIR SCREEN; not anatomical approval or runtime export',candidateSha256:files.get(`${out}/report.json`),readback,ambiguities,summary,relations,
  limitations:['Baseline is actual current low-resolution runtime geometry; candidate restores full source triangles and changes coordinates. Cross-count differences combine those effects.',
    'All 1,220 overview meshes are present, including normally hidden meshes; separately loaded CT and male details are not part of this frame.',
    'Surface intersections do not measure solid penetration, containment or correct attachments. No crossing does not prove anatomically valid separation.',
    'Readback arithmetic and 24 derivative examples are independent checks of saved numbers, not a second independent fit.',
    'Additional rays and solid-angle winding do not overwrite the original three-ray ambiguous result.'],files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({readback,ambiguities:ambiguities.map(a=>({id:a.id,vertex:a.vertex,winding:a.signedSolidAngleWinding,evenRays:a.rays.filter(r=>r.parity===0).length})),summary}));
probe.dispose();parts.forEach(p=>p.g.dispose());changed.forEach(g=>g.dispose());
