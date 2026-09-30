import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ready,snapshot,openTool,closeTool} from './helpers';
import {detailProjection} from './detail-projection';
import spec from '../../data/catalog/female-pelvic-bindings.json' with {type:'json'};

const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json','utf8'));
const byId=new Map<string,any>(atlas.parts.map((part:any)=>[part.id,part]));
const chunks=atlas.chunks.map((chunk:any)=>gunzipSync(fs.readFileSync(`public/models/female/${chunk.gzip.split('/').pop()}`)));
const expected=new Map(spec.records.map(record=>{
  const part=byId.get(record.partnerId),bytes=chunks[part.chunk];
  const blocks=[[part.positions,part.vertexCount*12],[part.normals,part.vertexCount*6],[part.indices,part.indexCount*4]];
  return [record.id,createHash('sha256').update(Buffer.concat(blocks.map(([offset,length])=>bytes.subarray(offset,offset+length)))).digest('hex')];
}));

test('female uterine round-ligament IDs select the appropriate existing side at every peel step',async({page})=>{
  test.setTimeout(300000);let fiberUrl='';const errors:string[]=[];
  page.on('request',request=>{if(/\/@react-three_fiber\.js\?/.test(request.url()))fiberUrl=request.url();});
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const actual=()=>page.evaluate(async({url,ids})=>{
    const module=await import(/* @vite-ignore */ url),scene=module._roots.get(document.querySelector('canvas')).store.getState().scene;
    const rows=[];
    for(const id of ids){
      const mesh=scene.getObjectByName(id),geometry=mesh.geometry;
      const arrays=[geometry.attributes.position,geometry.attributes.normal,geometry.index].map(attribute=>new Uint8Array(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
      const buffer=new Uint8Array(arrays.reduce((sum,array)=>sum+array.length,0));let offset=0;
      for(const array of arrays){buffer.set(array,offset);offset+=array.length;}
      const digest=await crypto.subtle.digest('SHA-256',buffer);
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      rows.push({id,source:mesh.userData.sourceGeometryId,name:mesh.userData.sourceName,
        tag:geometry.userData.femalePelvicBinding??null,brainTag:geometry.userData.femaleBrainBinding??null,
        minX:geometry.boundingBox.min.x,maxX:geometry.boundingBox.max.x,
        hash:Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')});
    }
    return rows;
  },{url:fiberUrl,ids:spec.records.map(record=>record.id)});
  const first=await actual();
  for(const record of spec.records){
    const row=first.find(row=>row.id===record.id)!;
    expect(row.source).toBe(record.partnerId);expect(row.name).toBe(record.partnerName);
    expect(row.tag).toEqual({version:spec.version,canonicalId:record.id,sourceGeometryId:record.partnerId});
    expect(row.brainTag).toBeNull();expect(row.hash).toBe(expected.get(record.id));
  }
  expect(first.find(row=>row.id==='HRAF0417')!.maxX).toBeLessThan(0);
  expect(first.find(row=>row.id==='HRAF0418')!.minX).toBeGreaterThan(0);
  await page.evaluate(async url=>{
    const module=await import(/* @vite-ignore */ url),state=module._roots.get(document.querySelector('canvas')).store.getState();
    (window as any).__pelvicOriginalRender=state.gl.render;state.gl.render=()=>{};
  },fiberUrl);
  for(let tick=0;tick<=200;tick++){
    await page.getByLabel('연속 해부 박리 깊이').fill(String(tick/2));
    await expect.poll(async()=>(await snapshot(page)).dissection).toBe(tick/2);
    expect(await actual()).toEqual(first);
  }
  await page.evaluate(async url=>{
    const module=await import(/* @vite-ignore */ url),state=module._roots.get(document.querySelector('canvas')).store.getState();
    state.gl.render=(window as any).__pelvicOriginalRender;delete (window as any).__pelvicOriginalRender;state.invalidate();
  },fiberUrl);
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  const choose=async(id:string)=>{
    await openTool(page,'구조 찾기');await page.getByLabel('경혈·구조 검색').fill(id);
    await page.locator('.structure-item').filter({hasText:id}).click();await ready(page);await closeTool(page);
    expect((await snapshot(page)).selection.ids).toEqual([id]);
    await expect(page.locator('.selection-card')).toContainText(byId.get(id).name);
    await expect(page.locator('.selection-card')).toContainText(spec.records.find(record=>record.id===id)!.partnerId);
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).targetError).toBeLessThan(.001);
  };
  await choose('HRAF0417');
  await page.screenshot({path:'docs/anatomy-alignment/pelvic-binding-right-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('canvas')).toBeInViewport();
  await page.screenshot({path:'docs/anatomy-alignment/pelvic-binding-right-mobile.png'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:900});
  await choose('HRAF0418');
  await page.screenshot({path:'docs/anatomy-alignment/pelvic-binding-left-desktop.png'});
  await page.reload();await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0418']);expect(await actual()).toEqual(first);
  await page.evaluate(oldTarget=>{
    const state=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);delete state.pelvicBindingVersion;
    state.markers='hidden';state.camera={target:oldTarget,position:[oldTarget[0],oldTarget[1],oldTarget[2]+.4]};
    sessionStorage.setItem('gyeol-view-v2',JSON.stringify(state));
  },byId.get('HRAF0418').bounds[0].map((value:number,index:number)=>(value+byId.get('HRAF0418').bounds[1][index])/2));
  await page.reload();await ready(page);
  await expect.poll(async()=>(await detailProjection(page,fiberUrl)).targetError).toBeLessThan(.001);
  expect((await snapshot(page)).pelvicBindingVersion).toBe(spec.version);
  expect((await snapshot(page)).markers).toBe('hidden');
  const migratedPose=(await snapshot(page)).camera;
  await page.reload();await ready(page);expect((await snapshot(page)).camera).toEqual(migratedPose);
  expect(errors).toEqual([]);
});
