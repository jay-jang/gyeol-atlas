// Export a partial registration only after pointwise non-regression and full
// bone-layer pair screening. This does NOT certify complete anatomy alignment.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
const candidatePath='.cache/arm-registration/hand-clearance-candidates.json';
const auditPath='.cache/arm-registration/all-bones-candidate-audit.json';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const candidate=JSON.parse(fs.readFileSync(candidatePath)),audit=JSON.parse(fs.readFileSync(auditPath));
for(const f of [...candidate.files,...audit.files])assert.equal(sha(f.path),f.sha256,f.path);
assert.equal(audit.evaluatedPairs,17430);assert.deepEqual(audit.newIntersections,[]);
const atlasPath='public/models/female/atlas-female.json',atlas=JSON.parse(fs.readFileSync(atlasPath)),cache=new Map();
function geometry(part){
  const path=`public/models/female/${atlas.chunks[part.chunk].gzip.split('/').pop()}`;
  if(!cache.has(path))cache.set(path,gunzipSync(fs.readFileSync(path)));
  const b=cache.get(path),g=new BufferGeometry();
  g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>b.readFloatLE(part.positions+i*4)),3));
  g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>b.readUInt32LE(part.indices+i*4)),1));return g;
}
const skin=geometry(atlas.parts.find(p=>p.name==='Skin')),probe=surfaceProbe(skin),records=[];
let beforeOutside=0,afterOutside=0,newOutside=0,worsenedOutside=0,maxIncreaseMm=0,checked=0;
for(const row of candidate.arms.flatMap(a=>a.parts).filter(p=>p.transformed)){
  const part=atlas.parts.find(p=>p.id===row.id);assert.equal(part.system,'borrowed');
  const g=geometry(part),positions=g.getAttribute('position');
  for(const index of referencedVertices(g,Infinity)){
    const point=new Vector3().fromBufferAttribute(positions,index),raw=point.toArray();
    const moved=new Vector3(...row.translation.map((v,j)=>Math.fround(v+raw.reduce((n,c,k)=>n+c*row.linear[k][j],0))));
    const before=probe.classify(point),after=probe.classify(moved);checked++;
    assert.notEqual(before.kind,'ambiguous');assert.notEqual(after.kind,'ambiguous');
    beforeOutside+=before.kind==='outside';afterOutside+=after.kind==='outside';
    newOutside+=before.kind!=='outside'&&after.kind==='outside';
    const delta=(after.kind==='outside'?after.distance:0)-(before.kind==='outside'?before.distance:0);
    if(delta>1e-6){worsenedOutside++;maxIncreaseMm=Math.max(maxIncreaseMm,delta*1000);}
  }
  records.push({id:row.id,name:row.name,sourceId:row.sourceId,vertexCount:part.vertexCount,indexCount:part.indexCount,
    linear:row.linear,translation:row.translation});g.dispose();
}
probe.dispose();skin.dispose();
const screening={checkedVertices:checked,beforeOutside,afterOutside,newOutside,worsenedOutside,maxIncreaseMm,
  bonePairsChecked:audit.evaluatedPairs,newBoneSurfaceIntersections:audit.newIntersections.length,
  toleranceMm:2,completeContainment:false,anatomicallyValidated:false};
console.log(JSON.stringify(screening));
assert.equal(records.length,60);assert.equal(newOutside,0);assert.equal(worsenedOutside,0);
assert.ok(afterOutside<beforeOutside);
const result={version:'female-arm-partial-1',dataset:'female',sourceManifestSha256:sha(atlasPath),partial:true,
  source:'Existing male-derived BodyParts3D supplement; not native female bones',screening,
  limitations:[`${afterOutside} referenced points remain outside the 2 mm skin band; other borrowed skeleton and donor muscles remain uncorrected.`,
    'Geometry screening does not establish clinical anatomy, cartilage contact, nerve course, or muscle alignment.',
    'Native HRA organs, brain, vessels, nerves, skin, and source files are unchanged.'],records,
  evidence:[candidatePath,auditPath,'scripts/build-female-arm-registration.mjs',...cache.keys()].map(path=>({path,sha256:sha(path)}))};
if(process.argv.includes('--export'))fs.writeFileSync('data/catalog/female-arm-registration.json',JSON.stringify(result,null,2)+'\n');
else fs.writeFileSync('.cache/arm-registration/partial-registration-screen.json',JSON.stringify(screening,null,2)+'\n');
