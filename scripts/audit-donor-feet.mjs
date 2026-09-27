// Offline source-foot inventory and three existing shank-frame candidates.
// Does not fit to borrowed male feet or change/export application geometry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';
import {triangleCrossings} from './lib/triangle-crossings.mjs';
import {applyFemaleFootRegistration} from '../src/female-foot-registration.ts';

const root=process.argv[2];assert.ok(root,'Pass extracted Final STL directory');
const out='.cache/donor-feet';fs.mkdirSync(out,{recursive:true});
const files=new Map();
const hash=file=>{const sha256=createHash('sha256').update(fs.readFileSync(file)).digest('hex');files.set(file,sha256);return sha256;};
const read=file=>{hash(file);return JSON.parse(fs.readFileSync(file));};
const source=read('docs/anatomy-alignment/donor-source-comparison.json');
const fits=read('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json');
const atlas=read('public/models/female/atlas-female.json');
assert.equal(hash('public/models/female/atlas-female.json'),fits.targetMembership.atlasSha256);
for(const f of read('data/catalog/female-atlas-source.json').files)assert.equal(hash(f.path),f.sha256,f.path);
const buffers=atlas.chunks.map(c=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const packed=p=>{
  const b=buffers[p.chunk],g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i)),1));
  applyFemaleFootRegistration(g,'female',p.id,p.system);return g;
};
const skin=packed(atlas.parts.find(p=>p.id==='HRAF0003')),topology=surfaceTopology(skin);
assert.equal(topology.connectedComponents,1);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);
const probe=surfaceProbe(skin,.002),point=new Vector3();
function containment(g){
  const counts={inside:0,'surface-band':0,outside:0,ambiguous:0};let maximum=null;
  const vertices=referencedVertices(g,Infinity);
  for(const vertex of vertices){point.fromBufferAttribute(g.attributes.position,vertex);const c=probe.classify(point);counts[c.kind]++;
    if(c.kind==='outside'&&(!maximum||c.distance*1000>maximum.distanceMm))maximum={vertex,pointMetres:point.toArray(),distanceMm:c.distance*1000};
  }
  return {vertices:vertices.length,...counts,maximum};
}
function relation(a,b){
  const crossings=triangleCrossings(a,b);
  // Both directions, all referenced vertices. Not continuous triangle minima.
  function nearest(from,to){
    const copy=to.clone(),tree=new MeshBVH(copy);let best=null;
    for(const vertex of referencedVertices(from,Infinity)){
      point.fromBufferAttribute(from.attributes.position,vertex);const q=tree.closestPointToPoint(point);
      if(!best||q.distance*1000<best.distanceMm)best={vertex,pointMetres:point.toArray(),nearestMetres:q.point.toArray(),distanceMm:q.distance*1000};
    }
    copy.dispose();return best;
  }
  return {...crossings,forwardMinimum:nearest(a,b),reverseMinimum:nearest(b,a)};
}
const structures=['Talus','Calcaneous','Navicular','Cuboid','LateralCuneiform','MedialCuneiform','IntermediateCuneiform','Phalanges'];
const report={createdAt:new Date().toISOString(),status:'OFFLINE SOURCE FOOT CANDIDATES; not runtime replacement or clinical approval',
  sourceUrl:source.sourceUrl,license:source.license,skin:{id:'HRAF0003',topology,toleranceMm:2},inventory:[],sourceFootCrossings:[],baseline:[],candidates:[],
  limitations:['Exact-coordinate components are geometric connectivity, not independent anatomical labels.',
    'Phalanges remains an aggregate with the original label; no per-toe FMA mapping is inferred.',
    'Containment tests every referenced vertex, not triangle interiors, anatomical placement or connections.',
    'Surface crossings do not detect a fully enclosed solid, and are not penetration depths or volumes.',
    'Ankle checks cover tibia/fibula target hierarchy only; other bone, muscle, nerve, vessel and cartilage relations remain unvalidated.',
    'The three candidate frames were fitted to lower-leg bones, not validated foot landmarks; none is auto-approved.']};
const visual=[];
for(const side of ['left','right']){
  const donor=[];
  for(const structure of [...structures,'Tibia','Fibula']){
    const f=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure===structure);assert.ok(f);
    const file=path.join(root,f.file);assert.equal(hash(file),f.sha256);
    const bytes=fs.readFileSync(file),raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const {geometry,components}=exactPositionComponents(raw);
    // Full corner-by-corner roundtrip before unit conversion, independent of BVH order.
    for(let i=0;i<geometry.index.count;i++)for(let k=0;k<3;k++)assert.equal(geometry.attributes.position.array[geometry.index.array[i]*3+k],raw.attributes.position.array[i*3+k]);
    raw.dispose();geometry.scale(.001,.001,.001);
    const record={side,structure,file:f.file,sha256:f.sha256,triangles:geometry.index.count/3,vertices:geometry.attributes.position.count,
      componentsMillimetres:components,topology:surfaceTopology(geometry)};
    report.inventory.push(record);donor.push({...record,geometry});
  }
  const targets=['Tibia','Fibula'].flatMap(bone=>fits.targetMembership.targets.find(t=>t.side===side&&t.bone===bone).members)
    .map(m=>{const p=atlas.parts.find(p=>p.id===m.id);return {...p,geometry:packed(p)};});
  const rawFeet=donor.filter(d=>structures.includes(d.structure));
  for(let i=0;i<rawFeet.length;i++)for(let j=i+1;j<rawFeet.length;j++){
    const c=triangleCrossings(rawFeet[i].geometry,rawFeet[j].geometry);
    if(c.intersectingTrianglePairs)report.sourceFootCrossings.push({side,structures:[rawFeet[i].structure,rawFeet[j].structure],...c});
  }
  const original=source.fits[`${side}-shank`],{rows:r,scale:s,offset:t}=original;
  const initial=new Matrix4().set(...r[0].map(v=>v*s),t[0],...r[1].map(v=>v*s),t[1],...r[2].map(v=>v*s),t[2],0,0,0,1);
  for(const mode of ['import-shank','surface-shank','surface-whole-leg']){
    const matrix=mode==='import-shank'?initial:new Matrix4().fromArray(fits.fits.find(f=>f.side===side&&f.mode===mode.replace('surface-','')).sourceToAtlasMatrix);
    assert.ok(matrix.determinant()>0);
    const transformed=donor.map(d=>({...d,geometry:d.geometry.clone().applyMatrix4(matrix)}));
    const feet=transformed.filter(d=>structures.includes(d.structure));
    const row={side,mode,sourceToAtlasMatrix:matrix.toArray(),uniformScale:Math.cbrt(matrix.determinant()),parts:[],ankle:[],footCrossings:[],evaluatedFootPairs:0};
    for(const foot of feet){
      foot.geometry.computeBoundingBox();const b=foot.geometry.boundingBox;
      const c={structure:foot.structure,...containment(foot.geometry),boundsMetres:[b.min.toArray(),b.max.toArray()]};row.parts.push(c);
      visual.push({side,mode,kind:'donor',structure:foot.structure,positions:Array.from(foot.geometry.attributes.position.array),indices:Array.from(foot.geometry.index.array)});
    }
    for(const foot of feet.filter(f=>f.structure==='Talus'))for(const target of targets){
      const sourceBone=transformed.find(d=>d.structure===target.name.split(' (')[0]);
      row.ankle.push({foot:foot.structure,targetId:target.id,targetName:target.name,
        sourceCommonFrame:sourceBone?relation(foot.geometry,sourceBone.geometry):null,
        hra:relation(foot.geometry,target.geometry)});
    }
    for(let i=0;i<feet.length;i++)for(let j=i+1;j<feet.length;j++){
      row.evaluatedFootPairs++;const c=triangleCrossings(feet[i].geometry,feet[j].geometry);
      if(c.intersectingTrianglePairs)row.footCrossings.push({structures:[feet[i].structure,feet[j].structure],...c});
    }
    row.summary={vertices:row.parts.reduce((n,p)=>n+p.vertices,0),outside:row.parts.reduce((n,p)=>n+p.outside,0),ambiguous:row.parts.reduce((n,p)=>n+p.ambiguous,0),
      outsideMeshes:row.parts.filter(p=>p.outside).length,maxOutsideMm:Math.max(0,...row.parts.map(p=>p.maximum?.distanceMm??0)),
      ankleCrossingPairs:row.ankle.filter(a=>a.hra.strictPlaneStraddlingPairs>0).length};
    report.candidates.push(row);console.log(JSON.stringify({side,mode,...row.summary}));
    transformed.forEach(d=>d.geometry.dispose());
  }
  const borrowed=atlas.parts.filter(p=>p.system==='borrowed'&&Number(p.id.slice(2))>=124&&Number(p.id.slice(2))<180&&new RegExp(`\\b${side}\\b`,'i').test(p.name));
  for(const p of borrowed){const geometry=packed(p);report.baseline.push({id:p.id,name:p.name,side,...containment(geometry)});geometry.dispose();}
  for(const target of targets){visual.push({side,mode:'all',kind:'target',structure:target.name,positions:Array.from(target.geometry.attributes.position.array),indices:Array.from(target.geometry.index.array)});target.geometry.dispose();}
  donor.forEach(d=>d.geometry.dispose());
}
assert.equal(report.inventory.length,20);assert.equal(report.baseline.length,56);
visual.push({side:'both',mode:'all',kind:'skin',positions:Array.from(skin.attributes.position.array),indices:Array.from(skin.index.array)});
for(const file of ['scripts/audit-donor-feet.mjs','scripts/lib/exact-position-components.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-crossings.mjs',
  'src/female-foot-registration.ts','data/catalog/female-foot-registration.json','package-lock.json'])hash(file);
fs.writeFileSync(`${out}/visual-parts.json`,JSON.stringify(visual));
report.visual={file:`${out}/visual-parts.json`,sha256:hash(`${out}/visual-parts.json`)};
report.files=[...files].map(([file,sha256])=>({file,sha256}));
fs.writeFileSync(`${out}/audit.json`,JSON.stringify(report,null,2)+'\n');
probe.dispose();skin.dispose();
