import {test,expect} from '@playwright/test';
import {ready,openTool,closeTool,snapshot} from './helpers';
import {detailProjection} from './detail-projection';
import femaleGroups from '../../data/female-organ-groups.json' with {type:'json'};
import maleGroups from '../../data/male-organ-groups.json' with {type:'json'};
import maleInputs from '../../scripts/model-inputs.json' with {type:'json'};

test.use({viewport:{width:1440,height:900}});
const regions:Record<string,string>={brain:'head',heart:'chest',lung:'chest',breast:'chest',liver:'abdomen',kidney:'abdomen',stomach:'abdomen',pancreas:'abdomen',spleen:'abdomen',uterus:'pelvis',ovary:'pelvis',bladder:'pelvis'};
for(const sex of ['male','female'] as const)test(`${sex}: source organ regions, selection and restored scopes stay consistent`,async({page},testInfo)=>{
  test.setTimeout(180000);
  const errors:string[]=[];let fiberUrl='';
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/');await ready(page);
  if(sex==='female'){await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
  await page.getByRole('button',{name:'장기 빠른 보기',exact:true}).click();await ready(page);
  await openTool(page,'레이어 조절');
  for(const layer of (sex==='female'?['신경','체표','림프']:['신경','혈관']))await page.getByRole('checkbox',{name:`${layer} 레이어`,exact:true}).check();
  await ready(page);await closeTool(page);
  const groups=(sex==='female'?femaleGroups:maleGroups).filter(g=>regions[g.id]);
  const visible=async()=>((await page.locator('canvas').getAttribute('data-visible-structure-ids'))||'').split(',');
  const observations=[];
  for(const group of groups){
    const region=regions[group.id];
    await page.getByLabel('전신 부위 선택').selectOption(region);
    // Male overview intentionally uses ZA nerves/vessels instead of duplicate BP3
    // surfaces. BP3 members remain available on explicit selection/detail only.
    const ids=sex==='female'?group.ids:group.ids.filter(id=>!['nerve','vessel'].includes(maleInputs.assets.find(s=>s.id===id)!.layer));
    await expect.poll(async()=>{const actual=await visible();return ids.filter(id=>actual.includes(id));}).toEqual(ids);
    const actual=await visible();observations.push({group:group.id,region,expected:ids,actual:ids.filter(id=>actual.includes(id))});
  }
  await testInfo.attach('region-memberships',{body:JSON.stringify(observations,null,2),contentType:'application/json'});
  for(const o of observations)expect(o.actual,`${o.group}/${o.region}`).toEqual(o.expected);
  const checks=sex==='female'?[['HRAF0475','abdomen'],['HRAF0432','pelvis']]:[['FMA7148','abdomen']];
  for(const [index,[id,region]] of checks.entries()){
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(id);await page.locator('.structure-item').click();await ready(page);await closeTool(page);
    await expect(page.getByLabel('전신 부위 선택')).toHaveValue(region);
    expect((await snapshot(page)).selection.ids).toEqual([id]);
    const geometry=()=>page.evaluate(async({url,id})=>{
      const {_roots}=await import(/* @vite-ignore */url),state=_roots.get(document.querySelector('canvas')).store.getState();
      state.scene.updateMatrixWorld(true);const rows:any[]=[];
      state.scene.traverseVisible((mesh:any)=>{
        if(!mesh.isMesh||!(mesh.name===id||mesh.parent?.name===id))return;
        rows.push({id:mesh.name,matrix:mesh.matrixWorld.toArray(),positions:Array.from(mesh.geometry.attributes.position.array),indices:mesh.geometry.index?Array.from(mesh.geometry.index.array):[]});
      });
      const encoded=new TextEncoder().encode(JSON.stringify(rows));
      return {count:rows.length,hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoded))).map(b=>b.toString(16).padStart(2,'0')).join('')};
    },{url:fiberUrl,id});
    const before=await geometry();expect(before.count).toBeGreaterThan(0);
    if(index===0){
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(0);
      await page.screenshot({path:`docs/anatomy-alignment/organ-region-${sex}-desktop.png`});
      await page.setViewportSize({width:390,height:844});await page.locator('.selection-actions').getByRole('button',{name:'확대',exact:true}).click();
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(0);
      await expect(page.getByRole('button',{name:'구조 선택 해제',exact:true})).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`docs/anatomy-alignment/organ-region-${sex}-mobile.png`});
      await page.setViewportSize({width:1440,height:900});
    }
    // Simulate a pre-fix saved region, not a new selection action. Keep camera/preferences.
    const saved=await snapshot(page);
    await page.evaluate(()=>{const key='gyeol-view-v2',s=JSON.parse(sessionStorage.getItem(key)!);s.anatomyRegion='chest';sessionStorage.setItem(key,JSON.stringify(s));});
    await page.reload();await ready(page);
    await expect(page.getByLabel('전신 부위 선택')).toHaveValue(region);
    const restored=await snapshot(page);expect(restored.markers).toBe(saved.markers);expect(restored.alpha).toEqual(saved.alpha);
    for(const key of ['position','target'])for(let axis=0;axis<3;axis++)expect(restored.camera[key][axis]).toBeCloseTo(saved.camera[key][axis],6);
    expect(await geometry()).toEqual(before);
    await page.locator('canvas').focus();await page.keyboard.press('Alt+ArrowDown');await ready(page);
    expect((await snapshot(page)).dissection).toBe(saved.dissection+.5);
    expect(await geometry()).toEqual(before);
  }
  expect(errors).toEqual([]);
});
