import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import {ready,choosePoint,closeTool} from './helpers';

// The rule-placed female approximate markers on the final coordinates, and
// the point card naming each marker's method and its recorded exceptions.
const anchors=JSON.parse(fs.readFileSync('public/models/acupoint-anchors-female.json','utf8'));
const landmarks=JSON.parse(fs.readFileSync('data/female-acupoint-landmarks.json','utf8')).female;
const marker=(id:string,side:string)=>anchors.find((a:any)=>a.pointId===id&&a.occurrence===0&&a.side===side);
const drawnMarkers=(page:Page,url:string)=>page.evaluate(async url=>{
  const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')!).store.getState();
  let mesh:any;s.scene.traverse((o:any)=>{if(o.isInstancedMesh&&o.userData.acupointMarkers)mesh=o;});
  const out:number[][]=[];if(!mesh)return out;const m=s.camera.matrixWorld.clone(),v=s.camera.position.clone();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);if(!m.elements[0])continue;v.setFromMatrixPosition(m);mesh.localToWorld(v);out.push([v.x,v.y,v.z]);}
  return out;
},url);
const look=(page:Page,url:string,target:number[],offset:number[])=>page.evaluate(async({url,target,offset})=>{
  const {_roots}=await import(/* @vite-ignore */url),s=_roots.get(document.querySelector('canvas')!).store.getState();
  s.controls.target.set(target[0],target[1],target[2]);s.camera.position.set(target[0]+offset[0],target[1]+offset[1],target[2]+offset[2]);
  s.camera.lookAt(target[0],target[1],target[2]);s.controls.update();s.invalidate();
},{url,target,offset});
async function open(page:Page,id:string){
  await choosePoint(page,id);await ready(page);
  if(await page.locator('.point-summary').getAttribute('aria-expanded')!=='true')await page.locator('.point-summary').click();
  return page.locator('[data-female-marker-note]');
}

for(const [name,width,height,touch] of [['desktop',1440,900,false],['touch phone',390,844,true]] as const) test.describe(name,()=>{
  test.use({viewport:{width,height},hasTouch:touch,isMobile:touch});
  test('rule-placed markers sit on their female landmarks and the card names each method and exception',async({page})=>{
    test.setTimeout(300000);let fiberUrl='';const errors:string[]=[];
    page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('/');await ready(page);
    await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
    await page.locator('.ax-point-bar .ax-note').getByRole('button',{name:'근사 위치로 보기'}).click();await ready(page);
    // The definition points are where their landmark is (file values, drawn markers).
    const cv8=marker('CV8','midline'),st17=marker('ST17','right');
    expect(Math.hypot(cv8.surfacePoint[0]-landmarks.navel.point[0],cv8.surfacePoint[1]-landmarks.navel.point[1])).toBeLessThan(.001);
    expect(Math.hypot(...[0,1].map(i=>st17.surfacePoint[i]-landmarks.nipples.right[i]))).toBeLessThan(.004);
    await look(page,fiberUrl,[0,1.02,.05],[0,0,touch?1.35:.85]);await page.waitForTimeout(400);
    const drawn=await drawnMarkers(page,fiberUrl);
    for(const [id,side] of [['CV8','midline'],['CV2','midline'],['ST25','right'],['ST25','left'],['ST17','right'],['ST17','left'],['ST18','left']]){
      const m=marker(id,side);
      expect(drawn.some(p=>Math.hypot(p[0]-m.position[0],p[1]-m.position[1],p[2]-m.position[2])<.002),`${id} ${side} drawn`).toBe(true);
    }
    await page.screenshot({path:`docs/anatomy-alignment/female-acupoints-torso-${touch?'touch':'desktop'}.png`});
    // Each card says how its marker was placed and what it does not keep.
    const cases:[string,RegExp[]][]=[
      ['CV8',[/WHO 비례촌/,/검수 전/]],
      ['ST17',[/젖꼭지 중심/,/높이 관계/]],
      ['ST18',[/유방 아래 주름/,/ST19보다 아래/,/높이 관계/]],
      ['ST19',[/WHO 비례촌/,/유방 표면/]],
      ['LR14',[/남성 표식을 여성 골격·피부 대응/,/높이 관계/]],
      ['ST32',[/남성 표식을 여성 골격·피부 대응/,/약 100mm 위/]],
      ['GB28',[/WHO 비례촌/,/주석을 따랐/]],
      ['SP12',[/높이만 여성 표지/]],
      ['HT2',[/반대쪽 면/]],
      ['LU1',[/남성 표식을 여성 골격·피부 대응/]],
    ];
    for(const [id,patterns] of cases){
      const note=await open(page,id);
      for(const pattern of patterns)await expect(note,id).toContainText(pattern);
      if(id==='ST18')await page.screenshot({path:`docs/anatomy-alignment/female-acupoints-st18-card-${touch?'touch':'desktop'}.png`});
      const box=await note.boundingBox();expect(box,id).not.toBeNull();
      expect(await note.evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    // Without the markers the card adds no female note.
    await page.getByRole('button',{name:'여성 근사 표식 끄기'}).click();await ready(page);
    expect(await (await open(page,'CV8')).count()).toBe(0);
    await closeTool(page);
    expect(errors).toEqual([]);
  });
});
