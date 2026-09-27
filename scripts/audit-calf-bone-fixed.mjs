// Read back the saved experimental candidate independently, then screen every
// pair involving a changed mesh against the CURRENT female runtime geometry.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3,Ray,DoubleSide,Triangle} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {applyFemaleArmRegistration} from '../src/female-arm-registration.ts';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';
import {applyFemaleSourceRestoration} from '../src/female-source-restoration.ts';
import {resolveFemaleBrainGeometryPart} from '../src/female-brain-bindings.ts';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';

const out='.cache/calf-bone-fixed',files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;},json=p=>JSON.parse(read(p));
const candidate=json(`${out}/report.json`);for(const f of candidate.files)assert.equal(sha(read(f.file)),f.sha256,f.file);
const zipped=read(candidate.binary.path);assert.equal(sha(zipped),candidate.binary.sha256);const bytes=gunzipSync(zipped);assert.equal(bytes.length,candidate.binary.bytes);
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const rawZipped=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(rawZipped),packing.sha256);const raw=gunzipSync(rawZipped);
const scalar=(p,side)=>{
  const e=side.initialMatrix;let x=e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12],y=e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13],z=e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14];
  for(const s of side.steps){const dx=x-s.centre[0],dy=y-s.centre[1],dz=z-s.centre[2],r2=dx*dx+dy*dy+dz*dz;if(r2>=s.radius*s.radius)continue;const t=Math.sqrt(r2)/s.radius,q=1-t,k=q*q*q*q*(4*t+1);x+=k*s.displacement[0];y+=k*s.displacement[1];z+=k*s.displacement[2];}
  return [x,y,z];
};
const readback={vertices:0,indexReferences:0,differentFloat32Coordinates:0,maximumCoordinateResidualMetres:0,minimumWitnesses:[]};
for(const side of candidate.sides){
  for(const step of side.steps){const bound=135*Math.sqrt(step.displacement.reduce((n,v)=>n+v*v,0))/(64*step.radius);assert.ok(bound<1);assert.ok(Math.abs(bound-step.lipschitzBound)<1e-14);}
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
// Independently decode binary STL triangle corners (no STLLoader, welding or
// BVH search), then exhaustively check support clearance with triangle-AABB
// lower-bound rejection and exact Three.js point-to-triangle distance.
const supportAudit=[];
for(const side of candidate.sides){
  const sideName=side.side==='left'?'Left':'Right',bones=[];
  for(const name of ['Femur','Patella','Tibia','Fibula']){
    const file=candidate.files.find(f=>f.file.endsWith('/'+sideName+'/VHF_'+sideName+'_Bone_'+name+'_smooth.stl'));assert.ok(file);
    const b=read(file.file);assert.equal(sha(b),file.sha256);const count=b.readUInt32LE(80);assert.equal(b.length,84+50*count);
    const triangles=new Float64Array(count*9),bounds=new Float64Array(count*6),e=side.initialMatrix;
    let changedCoordinates=0,maximumPositionResidualMetres=0;
    for(let i=0;i<count;i++){
      for(let j=0;j<3;j++){
        const p=[0,1,2].map(k=>Math.fround(b.readFloatLE(84+50*i+12+12*j+4*k)*.001));
        const initial=[Math.fround(e[0]*p[0]+e[4]*p[1]+e[8]*p[2]+e[12]),Math.fround(e[1]*p[0]+e[5]*p[1]+e[9]*p[2]+e[13]),Math.fround(e[2]*p[0]+e[6]*p[1]+e[10]*p[2]+e[14])];
        const mapped=scalar(p,side).map(Math.fround);triangles.set(initial,9*i+3*j);
        for(let k=0;k<3;k++){changedCoordinates+=initial[k]!==mapped[k];maximumPositionResidualMetres=Math.max(maximumPositionResidualMetres,Math.abs(initial[k]-mapped[k]));}
      }
      for(let k=0;k<3;k++){bounds[6*i+k]=Math.min(triangles[9*i+k],triangles[9*i+3+k],triangles[9*i+6+k]);bounds[6*i+3+k]=Math.max(triangles[9*i+k],triangles[9*i+3+k],triangles[9*i+6+k]);}
    }
    assert.equal(changedCoordinates,0);bones.push({name,triangles,bounds,count,changedCoordinates,maximumPositionResidualMetres});
  }
  const checks=[],tri=new Triangle(),centre=new Vector3(),nearest=new Vector3();
  for(let stepIndex=0;stepIndex<side.steps.length;stepIndex++){
    const step=side.steps[stepIndex];centre.set(...step.centre);
    for(const bone of bones){
      let minSq=Infinity,triangle=-1,exactChecks=0;
      for(let i=0;i<bone.count;i++){
        let lowerSq=0;for(let k=0;k<3;k++){const x=step.centre[k],d=Math.max(bone.bounds[6*i+k]-x,0,x-bone.bounds[6*i+3+k]);lowerSq+=d*d;}
        if(lowerSq>=minSq)continue;
        tri.a.fromArray(bone.triangles,9*i);tri.b.fromArray(bone.triangles,9*i+3);tri.c.fromArray(bone.triangles,9*i+6);tri.closestPointToPoint(centre,nearest);exactChecks++;
        const d=centre.distanceToSquared(nearest);if(d<minSq){minSq=d;triangle=i;}
      }
      const distanceMetres=Math.sqrt(minSq),recorded=step.protectedDistances.find(p=>p.name===bone.name);assert.ok(recorded);
      assert.ok(Math.abs(distanceMetres-recorded.distanceMetres)<1e-9);
      assert.ok(distanceMetres-step.radius>=candidate.options.supportMarginMicrometres*1e-6-1e-9);
      checks.push({step:stepIndex,bone:bone.name,trianglesConsidered:bone.count,exactChecks,nearestTriangle:triangle,distanceMetres,radiusMetres:step.radius,clearanceMetres:distanceMetres-step.radius,recordedDistanceResidualMetres:Math.abs(distanceMetres-recorded.distanceMetres)});
    }
  }
  supportAudit.push({side:side.side,bones:bones.map(({name,count,changedCoordinates,maximumPositionResidualMetres})=>({name,triangles:count,cornerOccurrences:count*3,changedCoordinates,maximumPositionResidualMetres})),checks});
  console.log(JSON.stringify({side:side.side,supportChecks:checks.length,minimumClearanceMetres:Math.min(...checks.map(c=>c.clearanceMetres)),rawBoneCornerOccurrences:bones.reduce((n,b)=>n+b.count*3,0)}));
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
const initialMeshes=new Map(candidate.sides.flatMap(side=>side.muscles.map(m=>{
  const p=packing.parts.find(p=>p.id===m.id),g=geometry(raw,p);g.applyMatrix4(new Matrix4().fromArray(side.initialMatrix));return [m.id,finish(g)];
})));
const skin=parts.find(p=>p.id==='HRAF0003'),probe=surfaceProbe(skin.g,.002),point=new Vector3(),ambiguities=[];
const initialPlacementSkin=[];
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maximumOutsideMm:0});
const count=(r,c)=>{r[c.kind]++;if(c.kind==='outside')r.maximumOutsideMm=Math.max(r.maximumOutsideMm,c.distance*1000);};
for(const side of candidate.sides)for(const m of side.muscles){
  const p=packing.parts.find(p=>p.id===m.id),g=changed.get(m.id),initial=new Matrix4().fromArray(side.initialMatrix);
  const row={id:m.id,vertices:p.vertexCount,initial:tally(),after:tally(),newOutside:0,worsenedOutside:0,resolvedOutside:0};
  for(let i=0;i<p.vertexCount;i++){
    const input=new Vector3(...[0,1,2].map(k=>raw.readFloatLE(p.positions+4*(3*i+k)))).applyMatrix4(initial);input.set(...input.toArray().map(Math.fround));
    const a=probe.classify(input),b=probe.classify(point.fromBufferAttribute(g.attributes.position,i));count(row.initial,a);count(row.after,b);
    row.newOutside+=b.kind==='outside'&&a.kind!=='outside';row.worsenedOutside+=b.kind==='outside'&&a.kind==='outside'&&b.distance>a.distance+1e-6;row.resolvedOutside+=a.kind==='outside'&&b.kind!=='outside';
  }
  assert.deepEqual(row.after,m.after);assert.equal(row.after.outside-row.initial.outside,row.newOutside-row.resolvedOutside);initialPlacementSkin.push(row);
}
// Reconstruct the actual fitted skin sample trajectory, comparing each cropped
// target query with the full fixed skin. This checks the alleged crop-edge
// attraction on these samples, not all continuous source surface points.
const envelopeFile=candidate.files.find(f=>f.file.endsWith('/VHF_Both_All.stl'));assert.ok(envelopeFile);
const eb=read(envelopeFile.file);assert.equal(sha(eb),envelopeFile.sha256);
const loaded=new STLLoader().parse(eb.buffer.slice(eb.byteOffset,eb.byteOffset+eb.byteLength));loaded.scale(.001,.001,.001);loaded.deleteAttribute('normal');
const envelope=mergeVertices(loaded,1e-9);loaded.dispose();assert.equal(envelope.attributes.position.count,326280);
const skinCorrespondence=[];
for(const side of candidate.sides){
  const [yMin,yMax]=side.skinSelection.placedYBand,sign=side.side==='left'?1:-1,indices=[],a=skin.g.attributes.position,index=skin.g.index.array;
  for(let i=0;i<index.length;i+=3){
    const v=[index[i],index[i+1],index[i+2]].map(j=>new Vector3().fromBufferAttribute(a,j));
    if(v.every(p=>p.x*sign>0)&&Math.max(...v.map(p=>p.y))>=yMin-.02&&Math.min(...v.map(p=>p.y))<=yMax+.02)indices.push(...index.slice(i,i+3));
  }
  assert.equal(indices.length/3,side.skinSelection.targetTriangles);
  const target=skin.g.clone();target.setIndex(new BufferAttribute(new Uint32Array(indices),1));finish(target);
  const samples=side.fitSamples.find(g=>g.name==='skin').indices.map(vertex=>({vertex,point:new Vector3().fromBufferAttribute(envelope.attributes.position,vertex).applyMatrix4(new Matrix4().fromArray(side.initialMatrix))}));
  const result={side:side.side,samples:samples.length,stages:side.steps.length+1,queries:0,worseRestrictedQueries:0,maximumExcessDistanceMetres:0,maximumWitness:null};
  for(let stage=0;stage<=side.steps.length;stage++){
    for(const sample of samples){
      const cropped=target.boundsTree.closestPointToPoint(sample.point),full=skin.g.boundsTree.closestPointToPoint(sample.point),excess=cropped.distance-full.distance;result.queries++;
      assert.ok(excess>=-1e-10);result.worseRestrictedQueries+=excess>1e-7;
      if(excess>result.maximumExcessDistanceMetres){result.maximumExcessDistanceMetres=excess;result.maximumWitness={stage,vertex:sample.vertex,pointMetres:sample.point.toArray(),croppedPointMetres:cropped.point.toArray(),fullPointMetres:full.point.toArray(),fullSameSide:full.point.x*sign>0,croppedDistanceMetres:cropped.distance,fullDistanceMetres:full.distance};}
      if(stage<side.steps.length){
        const s=side.steps[stage],p=sample.point,dx=p.x-s.centre[0],dy=p.y-s.centre[1],dz=p.z-s.centre[2],r2=dx*dx+dy*dy+dz*dz;
        if(r2<s.radius*s.radius){const t=Math.sqrt(r2)/s.radius,q=1-t,k=q*q*q*q*(4*t+1);p.x+=k*s.displacement[0];p.y+=k*s.displacement[1];p.z+=k*s.displacement[2];}
      }
    }
  }
  skinCorrespondence.push(result);target.dispose();
}
envelope.dispose();
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
  const afterA=changed.get(a.id)||a.g,afterB=changed.get(b.id)||b.g,initialA=initialMeshes.get(a.id)||a.g,initialB=initialMeshes.get(b.id)||b.g;
  const before=crosses(a.g,b.g),initial=crosses(initialA,initialB),after=crosses(afterA,afterB);
  if(before||initial||after)relations.push({ids:[a.id,b.id],names:[a.name,b.name],systems:[a.system,b.system],layers:[a.layer,b.layer],bothChanged:changed.has(a.id)&&changed.has(b.id),before:before?triangleCrossings(a.g,b.g):null,initial:initial?triangleCrossings(initialA,initialB):null,after:after?triangleCrossings(afterA,afterB):null});
}
assert.equal(pairCount,24*1196+24*23/2);
const counts=(rows,beforeKey='before')=>({beforePairs:rows.filter(p=>p[beforeKey]).length,afterPairs:rows.filter(p=>p.after).length,newPairs:rows.filter(p=>!p[beforeKey]&&p.after).length,removedPairs:rows.filter(p=>p[beforeKey]&&!p.after).length});
const summary={meshes:parts.length,changedMeshes:changed.size,uniquePairs:pairCount,...counts(relations),newByOtherLayer:{},fromCommonInitial:counts(relations,'initial'),withUnchangedMeshes:counts(relations.filter(p=>!p.bothChanged)),withinChangedMeshes:counts(relations.filter(p=>p.bothChanged))};
for(const r of relations.filter(p=>!p.before&&p.after&&!p.bothChanged)){
  const layer=r.layers[changed.has(r.ids[0])?1:0];summary.newByOtherLayer[layer]=(summary.newByOtherLayer[layer]||0)+1;
}
for(const p of ['scripts/audit-calf-bone-fixed.mjs','src/female-arm-registration.ts','src/female-foot-registration.ts','src/female-source-restoration.ts','src/female-brain-bindings.ts','data/catalog/female-arm-registration.json','data/catalog/female-foot-registration.json','data/catalog/female-brain-bindings.json','scripts/lib/triangle-crossings.mjs','scripts/lib/surface-containment.mjs'])read(p);
const report={createdAt:new Date().toISOString(),status:'FULL PAIR SCREEN; not anatomical approval or runtime export',candidateSha256:files.get(`${out}/report.json`),readback,supportAudit,initialPlacementSkin,skinCorrespondence,ambiguities,summary,relations,
  limitations:['Baseline is actual current low-resolution runtime geometry; candidate restores full source triangles and changes coordinates. Cross-count differences combine those effects.',
    'All 1,220 overview meshes are present, including normally hidden meshes; separately loaded CT and male details are not part of this frame.',
    'Surface intersections do not measure solid penetration, containment or correct attachments. No crossing does not prove anatomically valid separation.',
    'Readback arithmetic and 24 derivative examples are independent checks of saved numbers, not a second independent fit.',
    'Additional rays and solid-angle winding do not overwrite the original three-ray ambiguous result.'],files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({readback,ambiguities:ambiguities.map(a=>({id:a.id,vertex:a.vertex,winding:a.signedSolidAngleWinding,evenRays:a.rays.filter(r=>r.parity===0).length})),summary}));
probe.dispose();parts.forEach(p=>p.g.dispose());changed.forEach(g=>g.dispose());initialMeshes.forEach(g=>g.dispose());
