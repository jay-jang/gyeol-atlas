// Independent scalar composition/readback and a guarded v3 catalog generator.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const candidatePath='.cache/finger-chains/candidate.json',candidate=JSON.parse(fs.readFileSync(candidatePath));
for(const f of candidate.files)assert.equal(sha(f.path),f.sha256,f.path);
const {combined:c,baselineRegistration:base}=candidate;
assert.equal(base.version,'female-arm-partial-2');assert.equal(base.records.length,60);
assert.equal(c.records.length,14);assert.equal(new Set(c.records.map(r=>r.id)).size,14);
assert.equal(c.nonSkinMeshes,1200);assert.equal(c.pairChecks,14*(1200-14)+14*13/2);
for(const key of ['newIntersections','increasedStraddle','increasedTrianglePairs'])assert.deepEqual(c[key],[]);
for(const key of ['newOutside','worsenedOutside','ambiguous'])assert.equal(c.summary[key],0);
assert.equal(c.summary.beforeOutside,355);assert.equal(c.summary.afterOutside,3);
for(const j of c.rootJoints){assert.equal(j.after.triangleSurfacesIntersect,false);assert.ok(j.after.vertexSurfaceMinimumMm<1);}
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json')),chunks=new Map(),rows=[];
const apply=(r,p)=>r.translation.map((t,j)=>t+p.reduce((s,x,k)=>s+x*r.linear[k][j],0));
let maxCompositionErrorM=0,maxPairDistanceErrorMm=0,distancePairs=0,vertices=0;
for(const group of c.selectedGroups){
  const source=candidate.groups.find(g=>g.side===group.side&&g.finger===group.finger&&g.includeMetacarpal===group.includeMetacarpal);
  const e=group.matrix,m=[[e[0],e[1],e[2]],[e[4],e[5],e[6]],[e[8],e[9],e[10]]],t=[e[12],e[13],e[14]];
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs(m[a].reduce((s,x,k)=>s+x*m[b][k],0)-(a===b?1:0))<1e-12);
  const det=m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);assert.ok(Math.abs(det-1)<1e-12);
  const cloud=[];
  for(const id of source.movingIds){
    const r=c.records.find(r=>r.id===id),b=base.records.find(r=>r.id===id),p=atlas.parts.find(p=>p.id===id);
    assert.equal(r.sourceId,b.sourceId);assert.equal(p.system,'borrowed');assert.equal(r.vertexCount,p.vertexCount);assert.equal(r.indexCount,p.indexCount);
    for(let a=0;a<3;a++)for(let j=0;j<3;j++)assert.ok(Math.abs(r.linear[a][j]-b.linear[a].reduce((s,x,k)=>s+x*m[k][j],0))<1e-12);
    for(let j=0;j<3;j++)assert.ok(Math.abs(r.translation[j]-(t[j]+b.translation.reduce((s,x,k)=>s+x*m[k][j],0)))<1e-12);
    if(!chunks.has(p.chunk))chunks.set(p.chunk,gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
    const bytes=chunks.get(p.chunk),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),indices=new Set();
    for(let i=0;i<p.indexCount;i++)indices.add(view.getUint32(p.indices+4*i,true));
    const output=new Float32Array(p.vertexCount*3);
    for(let i=0;i<p.vertexCount;i++){
      const raw=[0,1,2].map(j=>view.getFloat32(p.positions+12*i+4*j,true)),direct=apply(r,raw),prior=apply(b,raw),staged=apply({linear:m,translation:t},prior);
      maxCompositionErrorM=Math.max(maxCompositionErrorM,...direct.map((x,j)=>Math.abs(x-staged[j])));
      output.set(direct,i*3);
      if(indices.has(i)){vertices++;cloud.push({before:prior.map(Math.fround),after:direct.map(Math.fround)});}
    }
    rows.push({id,vertices:indices.size,positionSha256:createHash('sha256').update(Buffer.from(output.buffer)).digest('hex'),
      sourceIndicesSha256:createHash('sha256').update(bytes.subarray(p.indices,p.indices+p.indexCount*4)).digest('hex')});
  }
  for(let i=0;i<cloud.length;i++)for(let j=i+1;j<cloud.length;j++){
    const distance=key=>Math.hypot(...cloud[i][key].map((x,k)=>x-cloud[j][key][k]));
    maxPairDistanceErrorMm=Math.max(maxPairDistanceErrorMm,Math.abs(distance('before')-distance('after'))*1000);distancePairs++;
  }
}
assert.equal(vertices,c.summary.vertices);assert.ok(maxCompositionErrorM<1e-12);assert.ok(maxPairDistanceErrorMm<.0002);
const readback={method:'DataView raw read; scalar row-vector composition; every within-chain referenced vertex pair; not independent surface intersection validation',
  vertices,distancePairs,maxCompositionErrorM,maxPairDistanceErrorMm,rows,
  files:[candidatePath,'scripts/build-finger-refinement.mjs'].map(path=>({path,sha256:sha(path)}))};
fs.writeFileSync('.cache/finger-chains/readback.json',JSON.stringify(readback,null,2)+'\n');
const replacements=new Map(c.records.map(r=>[r.id,r])),remaining=base.screening.afterOutside-c.summary.beforeOutside+c.summary.afterOutside;
const output={...base,version:'female-arm-partial-3',records:base.records.map(r=>replacements.get(r.id)||r),
  screening:{...base.screening,afterOutside:remaining},
  limitations:[`${remaining} arm/hand referenced points remain outside the 2 mm skin band; other borrowed skeleton and donor muscles remain uncorrected.`,...base.limitations.slice(1)],
  fingerRefinement:{baselineVersion:base.version,method:'Four rigid ring/little-finger chains; no additional scale or shear',
    movedParts:14,nonSkinMeshes:c.nonSkinMeshes,pairChecks:c.pairChecks,...c.summary,groups:c.selectedGroups,
    resolvedSurfacePairs:c.pairs.filter(r=>r.before&&!r.after).map(r=>r.ids),anatomicallyValidated:false},
  evidence:[...base.evidence,{path:'docs/anatomy-alignment/finger-chain-candidate.json.gz',sha256:createHash('sha256').update(gzipSync(fs.readFileSync(candidatePath))).digest('hex')}]};
fs.writeFileSync('.cache/finger-chains/female-arm-registration-v3.json',JSON.stringify(output,null,2)+'\n');
if(process.argv.includes('--export')){
  const visual=JSON.parse(fs.readFileSync('.cache/finger-chains/captures.json'));
  assert.equal(visual.screenshots.length,8);assert.deepEqual(visual.errors,[]);
  for(const f of [...visual.files,...visual.screenshots])assert.equal(sha(f.path),f.sha256,f.path);
  assert.equal(visual.files.find(f=>f.path===candidatePath).sha256,sha(candidatePath));
  fs.writeFileSync('docs/anatomy-alignment/female-arm-registration-v2.json',JSON.stringify(base,null,2)+'\n');
  fs.writeFileSync('docs/anatomy-alignment/finger-chain-candidate.json.gz',gzipSync(fs.readFileSync(candidatePath)));
  fs.copyFileSync('.cache/finger-chains/readback.json','docs/anatomy-alignment/finger-chain-readback.json');
  const captures={...visual,screenshots:visual.screenshots.map(f=>{
    const dest=`docs/anatomy-alignment/finger-${f.path.split('/').pop()}`;fs.copyFileSync(f.path,dest);return {...f,path:dest};
  })};
  fs.writeFileSync('docs/anatomy-alignment/finger-chain-captures.json',JSON.stringify(captures,null,2)+'\n');
  fs.copyFileSync('.cache/finger-chains/female-arm-registration-v3.json','data/catalog/female-arm-registration.json');
}
console.log(JSON.stringify({remaining,...readback,rows:undefined,files:undefined}));
