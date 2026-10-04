import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
// Measures every visible text element in each atlas panel on a 390×844 screen:
// computed size at least 12px and contrast at least 4.5:1 on its rendered surface.
const browser=await chromium.launch({headless:true,args:process.env.PLAYWRIGHT_GPU==='1'?['--no-sandbox','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']:['--no-sandbox','--enable-unsafe-swiftshader']});
const records=[]; const origin=(process.env.SMOKE_ORIGIN||'http://127.0.0.1:5174').replace(/\/$/,'');
const measure=root=>{
  const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];
  const luminance=v=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
  const box=root.getBoundingClientRect();
  return [...root.querySelectorAll('p,label,small,strong,button,summary,select,dt,dd,a,span,h3,input')].filter(el=>{
    const r=el.getBoundingClientRect();const s=getComputedStyle(el);
    return r.width&&r.height&&r.top<box.bottom&&r.bottom>box.top&&s.visibility!=='hidden'&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
  }).map(el=>{
    const c=getComputedStyle(el);let bg=[255,255,255],node=el;
    while(node){const b=rgb(getComputedStyle(node).backgroundColor);if((b[3]??1)>.99){bg=b;break;}node=node.parentElement;}
    const a=luminance(rgb(c.color)),b=luminance(bg);
    return {text:el.textContent.trim().slice(0,60),font:parseFloat(c.fontSize),color:c.color,background:bg,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
  });
};
try {
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await page.goto(origin+'/#atlas/ST36'); await page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  const panels=[
    ['경혈 목록', async()=>page.getByRole('button',{name:'경혈 찾기',exact:true}).click(), '[aria-label="경혈 목록"]'],
    ['표시 설정', async()=>page.getByRole('button',{name:'표시 설정',exact:true}).click(), '[aria-label="표시 설정"][role="region"]'],
    ['검색', async()=>{await page.getByLabel('경혈·구조 검색').click();await page.getByLabel('경혈·구조 검색').fill('위');}, '[aria-label="검색 결과"]'],
    ['도움말', async()=>page.getByRole('button',{name:'도움말',exact:true}).click(), '[aria-label="도움말"][role="region"]'],
    ['경혈 상세', async()=>page.locator('.point-summary').click(), '.detail-panel'],
    ['효능·오행', async()=>{await page.locator('.point-summary').click();await page.getByRole('tab',{name:'효능·오행'}).click();await page.locator('.point-tradition').scrollIntoViewIfNeeded();}, '.detail-panel'],
    ['여성 경혈 좌표 안내', async()=>{
      await page.goto(origin+'/#atlas/CV12');await page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
      await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
      await page.getByRole('button',{name:'선택 경혈 확대',exact:true}).click();
      await page.locator('.comparison-feedback').waitFor({state:'visible'});await page.locator('.comparison-feedback').scrollIntoViewIfNeeded();
    }, '.detail-panel'],
    ['여성 보완 위 비교', async()=>{
      await page.locator('.point-summary').click();await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();
      await page.getByRole('button',{name:'위 (여성 CT) 상세',exact:true}).waitFor({state:'visible'});
    }, '.selection-card'],
  ];
  for(const [name,open,root] of panels){
    await open();
    const samples=await page.locator(root).first().evaluate(measure);
    records.push({name,samples});
    if(name==='도움말'){
      const sample=await page.locator('.viewer-help p').filter({hasText:'박리 백분율'}).evaluate(el=>{const r=el.getBoundingClientRect();return {text:el.textContent.trim().slice(0,40),visible:r.height>0};});
      assert.ok(sample.visible,'peel limitation note is visible in help');
    }
    const close=page.getByRole('button',{name:'도구 패널 닫기',exact:true});
    if(await close.count())await close.first().click();
  }
  // Always-visible atlas chrome: depth rail, acupoint bar, status.
  records.push({name:'항상 보이는 도구',samples:[
    ...await page.locator('.ax-depth').evaluate(measure),
    ...await page.locator('.ax-point-bar').evaluate(measure),
  ]});
  await fs.writeFile('docs/acupoint-expansion/readability.json',JSON.stringify({origin,records},null,2)+'\n');
  const failures=records.flatMap(r=>r.samples.filter(s=>s.font<12||s.contrast<4.5).map(s=>({panel:r.name,...s})));
  assert.deepEqual(failures,[]); console.log(`Visible atlas text on 390×844: minimum 12px and contrast >= 4.5:1 passed (${records.reduce((n,r)=>n+r.samples.length,0)} samples, ${records.length} surfaces).`);
} finally {await browser.close();}
