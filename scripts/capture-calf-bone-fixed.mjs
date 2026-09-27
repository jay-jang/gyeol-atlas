// Private fixed-camera diagnostic: common initial pose versus bone-fixed warp.
// Both muscle states use the same original full-resolution triangles.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
const out='.cache/calf-bone-fixed',hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p)),report=read(`${out}/report.json`),audit=read(`${out}/audit.json`);
assert.equal(audit.candidateSha256,hash(`${out}/report.json`));assert.equal(hash(report.binary.path),report.binary.sha256);
const packing=read('docs/anatomy-alignment/donor-fidelity-packing.json').unsimplifiedAlternative;
assert.equal(hash('.cache/donor-fidelity/source-full.bin.gz'),packing.sha256);
const original=gunzipSync(fs.readFileSync('.cache/donor-fidelity/source-full.bin.gz'));
const candidate=gunzipSync(fs.readFileSync(report.binary.path)),atlas=read('public/models/female/atlas-female.json'),membership=read('docs/anatomy-alignment/hra-bone-targets.json'),chunks=new Map();
const ids=new Set(['HRAF0003','VHF0004','VHF0042',...report.binary.parts.map(p=>p.id),...membership.targets.flatMap(t=>t.members.map(m=>m.id))]);assert.equal(ids.size,65);
const sides=new Map([['VHF0004','left'],['VHF0042','right']]);
for(const side of report.sides)for(const m of side.muscles)sides.set(m.id,side.side);
for(const target of membership.targets)for(const m of target.members){assert.ok(!sides.has(m.id)||sides.get(m.id)===target.side);sides.set(m.id,target.side);}
const decode=(b,p)=>({positions:Array.from({length:p.vertexCount*3},(_,i)=>b.readFloatLE(p.positions+4*i)),indices:Array.from({length:p.indexCount},(_,i)=>b.readUInt32LE(p.indices+4*i))});
const parts=atlas.parts.filter(p=>ids.has(p.id)).map(p=>{
  if(!chunks.has(p.chunk))chunks.set(p.chunk,gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`)));
  const q=report.binary.parts.find(q=>q.id===p.id);assert.ok(p.id==='HRAF0003'||sides.has(p.id));
  let initial=decode(chunks.get(p.chunk),p);
  if(q){
    initial=decode(original,packing.parts.find(r=>r.id===p.id));const e=report.sides.find(r=>r.side===sides.get(p.id)).initialMatrix;
    for(let i=0;i<initial.positions.length;i+=3){const [x,y,z]=initial.positions.slice(i,i+3);initial.positions[i]=Math.fround(e[0]*x+e[4]*y+e[8]*z+e[12]);initial.positions[i+1]=Math.fround(e[1]*x+e[5]*y+e[9]*z+e[13]);initial.positions[i+2]=Math.fround(e[2]*x+e[6]*y+e[10]*z+e[14]);}
  }
  return {id:p.id,name:p.name,system:p.system,side:sides.get(p.id),initial,candidate:q?decode(candidate,q):null};
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']}),captures=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:850}});page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/__calf-bone-fixed-diagnostic',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0"></body></html>'}));
  await page.goto('http://127.0.0.1:5174/__calf-bone-fixed-diagnostic');
  await page.evaluate(async({parts})=>{
    const T=await import('/node_modules/.vite/deps/three.js'),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(1100,850);renderer.setClearColor('#14212b');document.body.append(renderer.domElement);window.calfCommon={T,renderer,parts};
  },{parts});
  for(const side of ['left','right'])for(const view of ['posterior','medial'])for(const state of ['initial','candidate']){
    const data=await page.evaluate(({side,view,state})=>{
      const {T,renderer,parts}=window.calfCommon,scene=new T.Scene();scene.add(new T.AmbientLight(0xffffff,2));
      const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,-3);scene.add(light);const focus=new T.Box3(),ids=[];
      for(const p of parts){
        if(p.id!=='HRAF0003'&&p.side!==side)continue;
        const data=state==='candidate'&&p.candidate?p.candidate:p.initial,g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(data.positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(data.indices),1));g.computeVertexNormals();g.computeBoundingBox();
        if(p.name===`Tibia (${side})`||p.name===`Fibula (${side})`)focus.union(g.boundingBox);
        const skin=p.id==='HRAF0003',muscle=p.system==='donor-muscle',color=skin?'#e6c2a6':!muscle?'#efd5a6':/Gastrocnemius medial/.test(p.name)?'#51bdf5':/Gastrocnemius lateral/.test(p.name)?'#67e998':/Soleus/.test(p.name)?'#ef985d':/Biceps femoris/.test(p.name)?'#ddcb6c':'#a26674';
        const m=new T.Mesh(g,new T.MeshStandardMaterial({color,side:T.DoubleSide,transparent:skin,opacity:skin?.12:1,depthWrite:!skin}));scene.add(m);ids.push(p.id);
      }
      const target=focus.getCenter(new T.Vector3()),extent=focus.getSize(new T.Vector3()).y+.2,aspect=1100/850;
      const camera=new T.OrthographicCamera(-extent*aspect/2,extent*aspect/2,extent/2,-extent/2,.001,5),direction=new T.Vector3(view==='posterior'?0:side==='left'?-1:1,.05,view==='posterior'?-1:-.3).normalize();
      camera.position.copy(target).addScaledVector(direction,1);camera.lookAt(target);camera.updateProjectionMatrix();renderer.render(scene,camera);
      const result={ids,target:target.toArray(),cameraPosition:camera.position.toArray(),extent,png:renderer.domElement.toDataURL('image/png').split(',')[1]};scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});return result;
    },{side,view,state});
    const file=`bone-fixed-calf-${side}-${view}-${state}.png`;fs.writeFileSync(`${out}/${file}`,Buffer.from(data.png,'base64'));delete data.png;captures.push({side,view,state,file,sha256:hash(`${out}/${file}`),...data});
  }
  assert.deepEqual(errors,[]);
  for(const p of captures.filter(p=>p.state==='initial')){const q=captures.find(q=>q.state==='candidate'&&q.side===p.side&&q.view===p.view);assert.deepEqual(p.cameraPosition,q.cameraPosition);assert.deepEqual(p.target,q.target);assert.equal(p.extent,q.extent);assert.deepEqual(p.ids,q.ids);}
  fs.writeFileSync(`${out}/captures.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'PRIVATE DIAGNOSTIC of two offline states; not a public app UI or anatomy approval',candidateSha256:hash(`${out}/report.json`),auditSha256:hash(`${out}/audit.json`),scriptSha256:hash('scripts/capture-calf-bone-fixed.mjs'),
    limits:'Only 12 calf muscles, the short biceps femoris, 19 HRA knee/leg hierarchy pieces per side and whole skin are displayed. Other muscles, vessels, nerves, borrowed foot bones and pelvic bones are absent. The viewport frames the lower leg, not the whole body. Both initial/candidate muscle states use full source geometry. Initial is an offline common shank pose, not current public muscle placement.',
    colors:{medialGastrocnemius:'blue',lateralGastrocnemius:'green',soleus:'orange',otherCalfMuscles:'muted red',shortBicepsFemoris:'yellow',fixedHra:'beige',skin:'12% translucent'},errors,captures},null,2)+'\n');console.log('Eight fixed-camera calf diagnostics saved; page errors 0.');
}finally{await browser.close();}
