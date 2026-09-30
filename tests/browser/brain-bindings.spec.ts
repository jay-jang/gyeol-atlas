import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {ready,snapshot,organs} from './helpers';
import {detailProjection} from './detail-projection';
import bindings from '../../data/catalog/female-brain-bindings.json' with {type:'json'};
const text=fs.readFileSync('public/models/female/atlas-female.json','utf8'),atlas=JSON.parse(text);
const brain=atlas.parts.filter((p:any)=>p.system==='brain');
const parts=new Map<string,any>(atlas.parts.map((p:any)=>[p.id,p]));
const records=new Map(bindings.records.map(r=>[r.id,r]));
const chunks=atlas.chunks.map((c:any)=>gunzipSync(fs.readFileSync(`public/models/female/${c.gzip.split('/').pop()}`)));
const hash=createHash('sha256');
for(const p of brain){
  const q=parts.get(records.get(p.id)?.partnerId||p.id),b=chunks[q.chunk];
  for(const [offset,length] of [[q.positions,q.vertexCount*12],[q.normals,q.vertexCount*6],[q.indices,q.indexCount*4]])hash.update(b.subarray(offset,offset+length));
}
const expectedHash=hash.digest('hex');

test('brain source bindings, ray selection and every half-percent peel preserve complete buffers',async({page})=>{
  test.setTimeout(300000);let fiberUrl='';const errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const actual=()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */ url),state=module._roots.get(document.querySelector('canvas')).store.getState();
    const bytes:Uint8Array[]=[],rows=[];
    for(const id of ids){
      const mesh=state.scene.getObjectByName(id),g=mesh.geometry;
      if(!mesh.matrix.equals(mesh.matrix.clone().identity()))throw new Error(`Moved local matrix ${id}`);
      for(const attr of [g.attributes.position,g.attributes.normal,g.index])bytes.push(new Uint8Array(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength));
      rows.push({id,source:mesh.userData.sourceGeometryId,tag:g.userData.femaleBrainBinding??null,normalized:g.attributes.normal.normalized});
    }
    const buffer=new Uint8Array(bytes.reduce((n,b)=>n+b.length,0));let offset=0;
    for(const b of bytes){buffer.set(b,offset);offset+=b.length;}
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    return {hash:Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join(''),rows};
  },{url:fiberUrl,ids:brain.map((p:any)=>p.id)});
  const first=await actual();expect(first.hash).toBe(expectedHash);
  expect(first.rows).toEqual(brain.map((p:any)=>({id:p.id,source:records.get(p.id)?.partnerId||p.id,normalized:true,
    tag:records.has(p.id)?{version:bindings.version,canonicalId:p.id,sourceGeometryId:records.get(p.id)!.partnerId}:null})));
  await page.evaluate(async url=>{
    const m=await import(/* @vite-ignore */ url),s=m._roots.get(document.querySelector('canvas')).store.getState();
    (window as any).__brainOriginalRender=s.gl.render;s.gl.render=()=>{};
  },fiberUrl);
  for(let tick=0;tick<=200;tick++){
    await page.getByLabel('연속 해부 박리 깊이').fill(String(tick/2));
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(tick/2);
    expect(await actual()).toEqual(first);
    if(tick%50===0)console.log(`All 283 brain position/normal/index buffers unchanged at ${tick/2}%`);
  }
  await page.evaluate(async url=>{
    const m=await import(/* @vite-ignore */ url),s=m._roots.get(document.querySelector('canvas')).store.getState();
    s.gl.render=(window as any).__brainOriginalRender;delete (window as any).__brainOriginalRender;s.invalidate();
  },fiberUrl);
  const whole=async()=>{await (await organs(page)).filter({has:page.getByText('뇌',{exact:true})}).click();await ready(page);};
  await whole();
  await expect.poll(async()=>(await detailProjection(page,fiberUrl)).targetError).toBeLessThan(.001);
  // Find an actual visible surface hit, then dispatch a real pointer click.
  const hit=await page.evaluate(async({url,ids})=>{
    const m=await import(/* @vite-ignore */ url),canvas=document.querySelector('canvas')!,s=m._roots.get(canvas).store.getState();
    const rect=canvas.getBoundingClientRect(),meshes:any[]=[];s.scene.updateMatrixWorld(true);
    s.scene.traverseVisible((o:any)=>{if(o.isMesh&&o.material.opacity>.01)meshes.push(o);});
    const ray=s.raycaster;
    for(const id of ids){
    const target=s.scene.getObjectByName(id),g=target.geometry;
    for(let i=0;i<g.index.count;i+=3*Math.max(1,Math.floor(g.index.count/192))){
      const point=s.camera.position.clone().set(0,0,0);
      for(let j=0;j<3;j++)point.add(s.camera.position.clone().fromBufferAttribute(g.attributes.position,g.index.getX(i+j)));
      point.multiplyScalar(1/3).applyMatrix4(target.matrixWorld);
      ray.set(s.camera.position,point.clone().sub(s.camera.position).normalize());
      if(ray.intersectObjects(meshes,false)[0]?.object!==target)continue;
      const projected=point.project(s.camera),x=rect.left+(projected.x+1)*rect.width/2,y=rect.top+(1-projected.y)*rect.height/2;
      if(document.elementFromPoint(x,y)===canvas)return {x,y,id:target.name};
    }}throw new Error('No unobscured left brain ray target');
  },{url:fiberUrl,ids:bindings.records.filter(r=>r.name.endsWith('(left)')).map(r=>r.id)});
  await page.mouse.click(hit.x,hit.y);await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual([hit.id]);
  for(const id of ['HRAF0134','HRAF0267','HRAF0123','HRAF0256','HRAF0070']){
    await whole();const detail=page.locator('.organ-detail-parts');
    if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
    await detail.locator('button').nth(brain.findIndex((p:any)=>p.id===id)).click();await ready(page);
    expect((await snapshot(page)).selection.ids).toEqual([id]);
    if(records.has(id))await expect(page.locator('.selection-card > div > .selection-description')).toContainText(records.get(id)!.partnerId);
    expect(await actual()).toEqual(first);
  }
  await whole();const detail=page.locator('.organ-detail-parts');
  if(await detail.getAttribute('open')===null)await detail.locator('summary').click();
  await detail.locator('button').nth(brain.findIndex((p:any)=>p.id==='HRAF0200')).click();await ready(page);
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    await page.screenshot({path:`docs/anatomy-alignment/brain-binding-${label}.png`});
  }
  await page.reload();await ready(page);expect((await snapshot(page)).selection.ids).toEqual(['HRAF0200']);expect(await actual()).toEqual(first);
  const legacyPart=parts.get('HRAF0200'),oldTarget=legacyPart.bounds[0].map((v:number,i:number)=>(v+legacyPart.bounds[1][i])/2);
  await page.evaluate(target=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);delete s.brainBindingVersion;
    s.markers='hidden';s.camera={target,position:[target[0],target[1],target[2]+.4]};
    sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  },oldTarget);
  await page.reload();await ready(page);
  await expect.poll(async()=>(await detailProjection(page,fiberUrl)).targetError).toBeLessThan(.001);
  expect((await snapshot(page)).brainBindingVersion).toBe(bindings.version);expect((await snapshot(page)).markers).toBe('hidden');
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0200']);
  const migratedPose=(await snapshot(page)).camera;
  await page.reload();await ready(page);expect((await snapshot(page)).camera).toEqual(migratedPose);
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  expect((await snapshot(page)).selection).toBeNull();expect(errors).toEqual([]);
});

test('unreviewed female manifest is rejected before geometry download and retry recovers',async({page})=>{
  const requested:string[]=[];page.on('request',r=>requested.push(r.url()));
  await page.route('**/models/female/atlas-female.json',r=>r.fulfill({contentType:'application/json',body:text+' '}));
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');
  expect(requested.some(url=>/\/female\/.*\.bin\.gz/.test(url))).toBe(false);
  await page.unroute('**/models/female/atlas-female.json');
  await page.getByRole('button',{name:'3D 다시 시도',exact:true}).click();await ready(page);
  await expect(page.locator('canvas')).toHaveAttribute('data-model-sex','female');
});
