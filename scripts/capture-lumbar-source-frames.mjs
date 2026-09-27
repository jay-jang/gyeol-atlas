// Private source-frame diagnostics, not atlas UI or anatomical peel states.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
import {lowerBodyPoseContext} from './lib/lower-body-pose-context.mjs';
const out='.cache/lumbar-source-frames',read=p=>fs.readFileSync(p),json=p=>JSON.parse(read(p)),sha=p=>createHash('sha256').update(read(p)).digest('hex');
const r=json(`${out}/report.json`),audit=json(`${out}/readback.json`);assert.equal(audit.reportSha256,sha(`${out}/report.json`));
const ctx=lowerBodyPoseContext(process.argv[2]),bones=JSON.parse(gunzipSync(read(r.partsFile))),decode=g=>({positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});
const ids=new Set(r.psoasCandidates.flatMap(c=>c.relations.flatMap(p=>p.ids)));ids.delete('VHF0034');ids.delete('VHF0072');
for(const p of r.parts)ids.add(p.id);for(const s of ctx.prior.sides)for(const b of s.bones.filter(b=>['Pelvis','Femur'].includes(b.name)))for(const id of b.targetIds)ids.add(id);
const fixed=[...ids].sort().map(id=>{const p=ctx.runtimeMap.get(id);return {id,layer:p.layer,name:p.name,...decode(p.g)};}),muscles=[];
for(const id of ['VHF0034','VHF0072']){
  const m=ctx.muscles.find(m=>m.id===id),f=ctx.source.fits[`${m.side}-hip`],matrix=[f.rows[0][0]*f.scale,f.rows[1][0]*f.scale,f.rows[2][0]*f.scale,0,f.rows[0][1]*f.scale,f.rows[1][1]*f.scale,f.rows[2][1]*f.scale,0,f.rows[0][2]*f.scale,f.rows[1][2]*f.scale,f.rows[2][2]*f.scale,0,...f.offset,1],data=decode(m.raw);
  const legacy=data.positions.map((_,i)=>{const k=i%3,j=i-k;return Math.fround(matrix[k]*data.positions[j]+matrix[k+4]*data.positions[j+1]+matrix[k+8]*data.positions[j+2]+matrix[k+12]);}),states={legacy};
  for(const c of r.psoasCandidates){assert.equal(sha(c.binary.path),c.binary.sha256);const bytes=gunzipSync(read(c.binary.path)),p=c.binary.records.find(p=>p.id===id);states[c.mode]=Array.from({length:p.vertexCount*3},(_,i)=>bytes.readFloatLE(p.positions+4*i));}
  muscles.push({id,indices:data.indices,states});
}
const frames=r.frames.filter(f=>['legacy-hip-left','legacy-hip-right','lumbar-rigid','lumbar-similarity'].includes(f.name));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']}),errors=[],captures=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.route('**/__lumbar-frames',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#14212b;color:white;font:16px sans-serif"><div id="label" style="position:absolute;top:14px;left:18px;max-width:1040px"></div></body></html>'}));await page.goto('http://127.0.0.1:5174/__lumbar-frames');
  await page.evaluate(async data=>{const T=await import('/node_modules/.vite/deps/three.js'),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1100,1000);renderer.setClearColor('#14212b');document.body.append(renderer.domElement);window.lumbar={T,renderer,...data};},{bones,fixed,muscles,frames});
  const jobs=[...frames.map(f=>({view:'spine',state:f.name})),...['front','oblique'].flatMap(view=>['legacy','rigid','similarity'].map(state=>({view,state})))];
  for(const job of jobs){
    const data=await page.evaluate(({view,state})=>{
      const {T,renderer,bones,fixed,muscles,frames}=window.lumbar,scene=new T.Scene(),focus=new T.Box3(),ids=[];scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
      const geometry=(p,positions=p.positions)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(positions),3));g.setIndex(new T.BufferAttribute(new Uint32Array(p.indices),1));g.computeBoundingBox();g.computeVertexNormals();return g;};
      const show=(id,g,color,opacity=1)=>{scene.add(new T.Mesh(g,new T.MeshStandardMaterial({color,opacity,transparent:opacity<1,depthWrite:opacity===1,side:T.DoubleSide})));ids.push(id);};
      if(view==='spine'){
        for(const p of bones){if(p.kind==='official'){const g=geometry(p);focus.union(g.boundingBox);show(p.id,g,'#75d3df',.65);}else {for(const f of frames){const g=geometry(p);g.applyMatrix4(new T.Matrix4().fromArray(f.matrix));g.computeBoundingBox();focus.union(g.boundingBox);if(f.name===state)show(p.id,g,'#efad58',.7);else g.dispose();}}}
      }else{
        for(const p of fixed){const g=geometry(p);show(p.id,g,p.layer==='bone'?'#e3d6bb':p.layer==='vessel'?'#5497ff':p.layer==='organ'?'#e6d35e':p.layer==='nerve'?'#82e7ad':'#aa8aad',p.layer==='bone'?.45:p.layer==='muscle'?.18:.75);}
        for(const p of muscles){for(const positions of Object.values(p.states)){const g=geometry(p,positions);focus.union(g.boundingBox);g.dispose();}show(p.id,geometry(p,p.states[state]),p.id==='VHF0034'?'#f49672':'#db6d92',.72);}
        for(const p of fixed.filter(p=>/^HRAF085[0-5]$/.test(p.id))){const g=geometry(p);focus.union(g.boundingBox);g.dispose();}
      }
      const target=focus.getCenter(new T.Vector3()),size=focus.getSize(new T.Vector3()),extent=Math.max(size.y,size.x/1.1)+.09,camera=new T.OrthographicCamera(-extent*1.1/2,extent*1.1/2,extent/2,-extent/2,.001,5),direction=new T.Vector3(view==='oblique'?.65:0,.02,1).normalize();camera.position.copy(target).addScaledVector(direction,1.5);camera.lookAt(target);camera.updateProjectionMatrix();renderer.render(scene,camera);
      document.getElementById('label').textContent=view==='spine'?`${state} | orange: implied BoneHub spine; cyan: official HRA | diagnostic only`:`Psoas ${state} / ${view} | fixed context translucent | diagnostic, not peel or approved anatomy`;
      const result={ids,target:target.toArray(),cameraPosition:camera.position.toArray(),extent};scene.traverse(m=>{if(m.isMesh){m.geometry.dispose();m.material.dispose();}});return result;
    },job);
    const file=`lumbar-${job.view}-${job.state}.png`;await page.screenshot({path:`${out}/${file}`});captures.push({...job,file,sha256:sha(`${out}/${file}`),...data});
  }
  assert.deepEqual(errors,[]);for(const view of ['spine','front','oblique']){const group=captures.filter(c=>c.view===view);for(const p of group){assert.deepEqual(p.ids,group[0].ids);assert.deepEqual(p.target,group[0].target);assert.deepEqual(p.cameraPosition,group[0].cameraPosition);assert.equal(p.extent,group[0].extent);}}
  fs.writeFileSync(`${out}/captures.json`,JSON.stringify({createdAt:new Date().toISOString(),reportSha256:sha(`${out}/report.json`),auditSha256:sha(`${out}/readback.json`),scriptSha256:sha('scripts/capture-lumbar-source-frames.mjs'),errors,captures,fixedContext:fixed.map(({id,name,layer})=>({id,name,layer})),limits:'Four same-camera spine views show implied muscle-frame probes, not extra runtime bones. Six psoas views show two high-resolution source muscles and the union of current/candidate crossing targets plus lumbar, pelvis and femur context. No skin, full neural network or whole body. Context is translucent, camera focused on psoas/spine: distal context can be clipped. No mobile/public UI or actual peel validation.'},null,2)+'\n');console.log(JSON.stringify({captures:captures.length,fixedContext:fixed.length,errors}));
}finally{await browser.close();}
