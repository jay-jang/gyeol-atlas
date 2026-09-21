// Experimental common spatial deformation, using original unsimplified muscles.
// Outputs stay in .cache. Skin/Jacobian rejection prevents any runtime export.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix3,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceFrameField} from './lib/surface-frame-field.mjs';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
const root=process.argv[2];assert.ok(root,'Pass extracted STL directory');
const regularizationMm=Number(process.argv[3]??20);assert.ok(Number.isFinite(regularizationMm)&&regularizationMm>0);
const kernel=process.argv[4]??'inverse-square';assert.ok(['inverse-square','gaussian'].includes(kernel));
const options=process.argv.slice(5);for(const o of options)assert.ok(['--hip-surface','--per-side'].includes(o));
const hipSurface=options.includes('--hip-surface'),perSide=options.includes('--per-side');
const files=new Map(),sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>{const b=fs.readFileSync(p);files.set(p,sha(b));return b;};
const json=p=>JSON.parse(read(p));
const source=json('docs/anatomy-alignment/donor-source-comparison.json');
const fitReport=json('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json');
const hipFits=hipSurface?json('docs/anatomy-alignment/hip-surface-fits.json'):null;
const packing=json('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
const packed=read('.cache/donor-fidelity/source-full.bin.gz');assert.equal(sha(packed),packing.sha256);
const data=gunzipSync(packed),candidate=Buffer.from(data);assert.equal(data.length,packing.bytes);
const atlas=json('public/models/female/atlas-female.json');
for(const f of json('data/catalog/female-atlas-source.json').files)assert.equal(sha(read(f.path)),f.sha256);
const groupMatrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
const frames=[],frameRecords=[];
for(const side of ['left','right'])for(const [group,bones] of [['hip',['Pelvis']],['thigh',['Femur','Patella']],['shank',['Tibia','Fibula']]]){
  const geometries=bones.map(name=>{
    const f=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure===name);assert.ok(f);
    const bytes=read(path.join(root,f.file));assert.equal(sha(bytes),f.sha256);
    const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));raw.scale(.001,.001,.001);raw.deleteAttribute('normal');
    const g=mergeVertices(raw,1e-8);raw.dispose();return g;
  });
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());geometry.boundsTree=new MeshBVH(geometry);
  const hipFit=hipFits?.fits.find(f=>f.side===side);if(hipFit)assert.equal(hipFit.converged,true);
  const matrix=group==='hip'?(hipFit?new Matrix4().fromArray(hipFit.sourceToAtlasMatrix):groupMatrix(source.fits[`${side}-hip`])):new Matrix4().fromArray(fitReport.fits.find(f=>f.side===side&&f.mode===group).sourceToAtlasMatrix);
  frames.push({side,matrix,geometry,nearest:point=>geometry.boundsTree.closestPointToPoint(point)});
  frameRecords.push({side,group,bones,matrix:matrix.toArray(),fit:group==='hip'?(hipFit?'six-component pelvic surface fit':'original coarse bounding-box fit'):'hierarchical bone surface fit'});
}
const globalField=surfaceFrameField(frames,regularizationMm/1000,kernel);
const sideFields=Object.fromEntries(['left','right'].map(side=>[side,surfaceFrameField(frames.filter(f=>f.side===side),regularizationMm/1000,kernel)]));
const skinPart=atlas.parts.find(p=>p.id==='HRAF0003'),skinBytes=gunzipSync(read(`public/models/female/${atlas.chunks[skinPart.chunk].gzip.split('/').pop()}`)),skin=new BufferGeometry();
skin.setAttribute('position',new BufferAttribute(Float32Array.from({length:skinPart.vertexCount*3},(_,i)=>skinBytes.readFloatLE(skinPart.positions+4*i)),3));
skin.setIndex(new BufferAttribute(Uint32Array.from({length:skinPart.indexCount},(_,i)=>skinBytes.readUInt32LE(skinPart.indices+4*i)),1));
const probe=surfaceProbe(skin),point=new Vector3(),beforePoint=new Vector3(),afterPoint=new Vector3(),rows=[];
const tally=()=>({inside:0,outside:0,'surface-band':0,ambiguous:0,maxOutsideMm:0});
const count=(row,c)=>{row[c.kind]++;if(c.kind==='outside')row.maxOutsideMm=Math.max(row.maxOutsideMm,c.distance*1000);};
let minimum;
for(const part of packing.parts){
  const original=source.muscles.find(m=>m.id===part.id);assert.equal(original.name,part.name);
  const sourceSide=source.files.find(f=>f.file===original.source)?.side;assert.ok(['left','right'].includes(sourceSide));
  const field=perSide?sideFields[sourceSide]:globalField;
  const anchorFrameIndices=frames.map((f,i)=>({f,i})).filter(({f})=>!perSide||f.side===sourceSide).map(({i})=>i);
  const initial=groupMatrix(source.fits[original.fitGroup]);
  const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>data.readFloatLE(part.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>data.readUInt32LE(part.indices+4*i)),1));
  const row={id:part.id,name:part.name,sourceSide,anchorFrameIndices,vertices:0,skinBefore:tally(),skinAfter:tally(),newOutside:0,worsenedOutside:0,resolvedOutside:0,nonpositiveJacobians:0,minimumJacobianDeterminant:Infinity,maximumJacobianDeterminant:-Infinity,maximumJacobianFrobeniusNorm:0};
  for(const i of referencedVertices(g,Infinity)){
    row.vertices++;point.fromBufferAttribute(g.attributes.position,i);
    const mapped=field(point);assert.ok(mapped.point.toArray().every(Number.isFinite)&&Number.isFinite(mapped.determinant));
    beforePoint.copy(point).applyMatrix4(initial);beforePoint.set(...beforePoint.toArray().map(Math.fround));
    for(let axis=0;axis<3;axis++)candidate.writeFloatLE(mapped.point.getComponent(axis),part.positions+4*(i*3+axis));
    afterPoint.set(...[0,1,2].map(axis=>candidate.readFloatLE(part.positions+4*(i*3+axis))));
    const before=probe.classify(beforePoint),after=probe.classify(afterPoint);count(row.skinBefore,before);count(row.skinAfter,after);
    if(after.kind==='outside'&&(!row.maximumOutsideWitness||after.distance*1000>row.maximumOutsideWitness.distanceMm))row.maximumOutsideWitness={vertex:i,sourcePointMetres:point.toArray(),beforePointMetres:beforePoint.toArray(),candidatePointMetres:afterPoint.toArray(),distanceMm:after.distance*1000,weights:mapped.weights,anchorDistancesMetres:mapped.distancesMetres};
    if(after.kind==='outside'&&before.kind!=='outside')row.newOutside++;
    if(after.kind==='outside'&&before.kind==='outside'&&after.distance>before.distance+1e-6)row.worsenedOutside++;
    if(after.kind!=='outside'&&before.kind==='outside')row.resolvedOutside++;
    if(mapped.determinant<=0)row.nonpositiveJacobians++;
    row.minimumJacobianDeterminant=Math.min(row.minimumJacobianDeterminant,mapped.determinant);
    row.maximumJacobianDeterminant=Math.max(row.maximumJacobianDeterminant,mapped.determinant);
    row.maximumJacobianFrobeniusNorm=Math.max(row.maximumJacobianFrobeniusNorm,Math.hypot(...mapped.jacobian));
    if(!minimum||mapped.determinant<minimum.determinant)minimum={id:part.id,sourceSide,anchorFrameIndices,vertex:i,pointMetres:point.toArray(),jacobian:mapped.jacobian,determinant:mapped.determinant,weights:mapped.weights};
  }
  assert.equal(row.vertices,part.vertexCount,'Unexpected unused source vertices');
  assert.equal(row.skinAfter.outside-row.skinBefore.outside,row.newOutside-row.resolvedOutside);
  g.dispose();rows.push(row);console.log(JSON.stringify(row));
}
// Verify the most adverse sampled derivative by an independent finite difference.
const centre=new Vector3(...minimum.pointMetres),step=1e-6,numerical=Array(9).fill(0);
const field=perSide?sideFields[minimum.sourceSide]:globalField;
for(let axis=0;axis<3;axis++){
  const a=centre.clone(),b=centre.clone();a.setComponent(axis,a.getComponent(axis)-step);b.setComponent(axis,b.getComponent(axis)+step);
  const derivative=field(b).point.sub(field(a).point).multiplyScalar(1/(2*step));
  for(let row=0;row<3;row++)numerical[row*3+axis]=derivative.getComponent(row);
}
minimum.finiteDifference={stepMetres:step,jacobian:numerical,determinant:new Matrix3().set(...numerical).determinant(),maximumElementResidual:Math.max(...numerical.map((v,i)=>Math.abs(v-minimum.jacobian[i])))};
const sum=f=>rows.reduce((s,r)=>s+f(r),0);
const summary={meshes:rows.length,vertices:sum(r=>r.vertices),skinOutsideBefore:sum(r=>r.skinBefore.outside),skinOutsideAfter:sum(r=>r.skinAfter.outside),newOutside:sum(r=>r.newOutside),worsenedOutside:sum(r=>r.worsenedOutside),nonpositiveJacobians:sum(r=>r.nonpositiveJacobians)};
const rejected=summary.nonpositiveJacobians>0||summary.newOutside>0||summary.worsenedOutside>0;
const out='.cache/donor-continuous',stem=`surface-weighted-${kernel}-${regularizationMm}mm${hipSurface?'-hip-surface':''}${perSide?'-per-side':''}`;fs.mkdirSync(out,{recursive:true});
const compressed=gzipSync(candidate,{level:9});fs.writeFileSync(`${out}/${stem}.bin.gz`,compressed);
for(const p of ['scripts/build-continuous-donor-candidate.mjs','scripts/lib/surface-frame-field.mjs','scripts/lib/surface-containment.mjs','package-lock.json'])read(p);
const report={status:rejected?'REJECTED BY SKIN/JACOBIAN SCREEN; no runtime export':'NOT APPROVED; further anatomical and intersection checks required',kernel,regularizationMm,hipSurface,perSide,summary,minimumJacobianWitness:minimum,frames:frameRecords,rows,
  binary:{path:`${out}/${stem}.bin.gz`,bytes:candidate.length,gzipBytes:compressed.length,sha256:sha(compressed),parts:packing.parts},
  limitations:[perSide?'Each original side uses its own three frames, shared by all 38 muscles on that side. This excludes contralateral influence but does not establish attachment-specific weights.':'Same common source-space map applied to all 76 muscles; no mesh-ID or side branch in field evaluation.',
    '20mm default is an experimental numerical regularization length, not a biological tissue thickness or validated registration parameter.',
    hipSurface?'All six frames use surface fits; pelvic targets include the six source-labelled compact/spongy components per side.':'Hip frame estimates remain the coarse original box fits; thigh and shank frames use corrected composite surface fits.',
    'Blended frames are soft influences, not exact bone constraints. Resulting bone residuals are not measured by this muscle-only screen.',
    'Baseline is unsimplified source muscles in old group frames, not the lower-density public packed muscles. Counts cannot be compared directly to old public vertex counts.',
    'Analytic Jacobians are evaluated only at indexed source vertices. Closest-surface switches can be nondifferentiable; positive sampled determinants do not prove global injectivity or triangle validity.',
    'Skin 2mm band is numerical. Triangle intersection, attachment, internal tissue and clinical validation are NOT performed by this script.'],files:[...files].map(([path,sha256])=>({path,sha256}))};
fs.writeFileSync(`${out}/${stem}.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();skin.dispose();frames.forEach(f=>f.geometry.dispose());console.log(JSON.stringify({status:report.status,summary,minimumJacobianWitness:minimum}));
