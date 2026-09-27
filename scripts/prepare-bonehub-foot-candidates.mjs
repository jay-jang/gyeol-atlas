// Direct source-to-HRA shank fit. Previous Denver frame is initialization only.
// All seventeen source foot labels per side remain intact, with one common fit.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {MeshBVH} from 'three-mesh-bvh';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
import {fitSimilarity} from './lib/similarity-fit.mjs';
const symmetric=process.argv.includes('--symmetric-trimmed');
for(const arg of process.argv.slice(2))assert.equal(arg,'--symmetric-trimmed');
const out=symmetric?'.cache/bonehub-foot-symmetric':'.cache/bonehub-foot';fs.mkdirSync(out,{recursive:true});
const tracked=new Map(),hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>{tracked.set(f,hash(f));return JSON.parse(fs.readFileSync(f));};
const receipt=read('docs/anatomy-alignment/bonehub-female-receipt.json');
const inventory=read('docs/anatomy-alignment/bonehub-female-inventory.json');
const common=read('docs/anatomy-alignment/bonehub-denver-final-frame.json');
const fits=read('docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json');
const audit=read('.cache/donor-feet/audit.json');
assert.equal(hash('public/models/female/atlas-female.json'),fits.targetMembership.atlasSha256);
for(const f of audit.files)assert.equal(hash(f.file),f.sha256,f.file);
assert.equal(hash(audit.visual.file),audit.visual.sha256);
const rows=read(audit.visual.file);
const geometry=p=>new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3)).setIndex(p.indices);
function source(name){
  const entry=inventory.parts.find(p=>p.name===name);assert.ok(entry);
  const file=receipt.files.find(f=>f.path===entry.file);assert.equal(hash(file.local),entry.sha256);tracked.set(file.local,entry.sha256);
  const b=fs.readFileSync(file.local),raw=new STLLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
  const {geometry:g,components}=exactPositionComponents(raw);raw.dispose();g.scale(.001,.001,.001);g.computeBoundingBox();
  return {entry,g,components};
}
const sampleCount=symmetric?512:2000;
const indices=g=>Array.from({length:sampleCount},(_,i)=>Math.floor(i*(g.attributes.position.count-1)/(sampleCount-1)));
function distances(a,b){
  const copy=b.clone(),tree=new MeshBVH(copy),p=new Vector3(),values=[];let squares=0;
  for(let i=0;i<a.attributes.position.count;i++){p.fromBufferAttribute(a.attributes.position,i);const d=tree.closestPointToPoint(p).distance*1000;values.push(d);squares+=d*d;}
  values.sort((a,b)=>a-b);copy.dispose();return {vertices:values.length,p95Mm:values[Math.floor((values.length-1)*.95)],maxMm:values.at(-1),rmsMm:Math.sqrt(squares/values.length)};
}
const sides=[],parts=[];
for(const side of ['left','right']){
  const pairNames=['Tibia','Fibula'];
  const pairs=pairNames.map(name=>{
    const native=source(`${name.toUpperCase()}_${side.toUpperCase()}`),targetRow=rows.find(p=>p.kind==='target'&&p.side===side&&p.structure===`${name} (${side})`);assert.ok(targetRow);
    const target=geometry(targetRow),sCopy=native.g.clone(),tCopy=target.clone();
    return {name,...native,target,targetRow,sCopy,tCopy,sTree:new MeshBVH(sCopy),tTree:new MeshBVH(tCopy),si:indices(native.g),ti:indices(target)};
  });
  const toDenver=new Matrix4().fromArray(common.matrixColumnMajor);for(const k of [12,13,14])toDenver.elements[k]/=1000;
  const initial=new Matrix4().fromArray(fits.fits.find(f=>f.side===side&&f.mode==='shank').sourceToAtlasMatrix).multiply(toDenver);
  let matrix=initial.clone();const iterations=[];
  for(let iteration=0;iteration<240;iteration++){
    const inverse=matrix.clone().invert(),from=[],onto=[];
    for(const p of pairs){
      const forward=p.si.map(i=>{const a=new Vector3().fromBufferAttribute(p.g.attributes.position,i),q=p.tTree.closestPointToPoint(a.clone().applyMatrix4(matrix));return {a,b:q.point.clone(),distance:q.distance};});
      const reverse=symmetric?p.ti.map(i=>{const b=new Vector3().fromBufferAttribute(p.target.attributes.position,i),q=p.sTree.closestPointToPoint(b.clone().applyMatrix4(inverse));return {a:q.point.clone(),b,distance:q.point.clone().applyMatrix4(matrix).distanceTo(b)};}):[];
      for(const matches of [forward,reverse])for(const m of symmetric?matches.sort((a,b)=>a.distance-b.distance).slice(0,409):matches){from.push(m.a);onto.push(m.b);}
    }
    const next=fitSimilarity(from,onto),delta=Math.max(...pairs.flatMap(p=>p.si.map(i=>{const a=new Vector3().fromBufferAttribute(p.g.attributes.position,i);return a.clone().applyMatrix4(matrix).distanceTo(a.applyMatrix4(next));})));
    iterations.push({iteration,maximumSampleChangeMm:delta*1000,scale:Math.cbrt(next.determinant())});matrix=next;
    if(delta<1e-8)break;
  }
  const bones=pairs.map(p=>{
    const placed=p.g.clone().applyMatrix4(matrix),initialPlaced=p.g.clone().applyMatrix4(initial);
    const result={name:p.name,sourceName:p.entry.name,initialForward:distances(initialPlaced,p.target),forward:distances(placed,p.target),reverse:distances(p.target,placed)};
    initialPlaced.dispose();placed.dispose();
    parts.push({...p.targetRow,mode:'direct-shank',variant:'all'});return result;
  });
  const feet=inventory.parts.filter(p=>p.group===`FOOT_${side.toUpperCase()}`);assert.equal(feet.length,17);
  for(const f of feet){
    const native=source(f.name);native.g.applyMatrix4(matrix);
    parts.push({side,kind:'donor',mode:'direct-shank',structure:f.name,sourceFile:f.file,sourceSha256:f.sha256,
      positions:Array.from(native.g.attributes.position.array),indices:Array.from(native.g.index.array)});native.g.dispose();
  }
  sides.push({side,initialMatrix:initial.toArray(),sourceToAtlasMatrix:matrix.toArray(),uniformScale:Math.cbrt(matrix.determinant()),iterations,
    stopReason:iterations.at(-1).maximumSampleChangeMm<.00001?'sample-change threshold':'iteration limit',bones,footLabels:feet.map(f=>f.name)});
  console.log(JSON.stringify({side,iterations:iterations.length,scale:Math.cbrt(matrix.determinant()),bones}));
  for(const p of pairs){p.g.dispose();p.target.dispose();p.sCopy.dispose();p.tCopy.dispose();}
}
parts.push({...rows.find(p=>p.kind==='skin'),variant:'all'});
const partFile=`${out}/initial-parts.json`;fs.writeFileSync(partFile,JSON.stringify(parts));tracked.set(partFile,hash(partFile));
for(const f of ['scripts/prepare-bonehub-foot-candidates.mjs','scripts/lib/similarity-fit.mjs','scripts/lib/exact-position-components.mjs','package-lock.json'])tracked.set(f,hash(f));
fs.writeFileSync(`${out}/initial.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'Direct shank fitting only; foot placement not approved; no runtime export',
  sampling:symmetric?'512 per bone and direction, retain closest 409':'2000 source vertices per bone, untrimmed forward surface fit',
  sourceRevision:inventory.revision,sourceUnits:'STL mm converted once to metres before fitting',sides,parts:partFile,
  limitations:['HRA shank meshes are low-detail reference surfaces, not clinical landmarks.',
    'A common similarity is fitted only to tibia/fibula, never borrowed male foot shapes. Foot pose, skin, cartilage, vessels, nerves and attachments require separate checks.',
    'Digits are source compound labels; no individual phalanx or FMA mapping is invented.'],files:[...tracked].map(([file,sha256])=>({file,sha256}))},null,2)+'\n');
