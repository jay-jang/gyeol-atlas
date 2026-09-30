import {chromium} from '@playwright/test';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
const origin=process.env.SMOKE_ORIGIN||'http://127.0.0.1:5174';const dir='docs/ui-renewal';await fs.mkdir(dir,{recursive:true});
// Scene tools must not cover one another, and point labels must stay on the canvas.
// Hover/focus tooltips are transient; nested elements belong to their container.
const OVERLAYS=['.ax-search','.ax-top-actions','.ax-depth','.ax-point-bar','.ax-point-chip','.detail-panel','.selection-card','.movement-pad','.view-presets','.view-tools','.ax-status .scene-status','.ax-status .scene-legend','.ax-status .ax-source','.cutaway-reset','.comparison-note'];
const layout=page=>page.evaluate(selectors=>{
 const shown=el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&r.width>0&&r.height>0;};
 const boxes=[...new Set(selectors.flatMap(sel=>[...document.querySelectorAll(sel)]))].filter(shown).map(el=>({el,name:el.className,r:el.getBoundingClientRect()}));
 const overlaps=[];for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];if(a.el.contains(b.el)||b.el.contains(a.el))continue;
  const w=Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left),h=Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top);if(w>1&&h>1)overlaps.push(`${a.name} × ${b.name} ${w.toFixed(1)}×${h.toFixed(1)}`);}
 const c=document.querySelector('canvas').getBoundingClientRect();
 const clippedLabels=[...document.querySelectorAll('.point-label.active')].filter(shown).map(el=>el.getBoundingClientRect()).filter(r=>r.left<c.left-.5||r.right>c.right+.5||r.top<c.top-.5||r.bottom>c.bottom+.5).map(r=>`${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}×${r.height.toFixed(1)}`);
 return {overlaps,clippedLabels};
},OVERLAYS);
const browser=await chromium.launch({headless:true,args:process.env.PLAYWRIGHT_GPU==='1'?['--no-sandbox','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']:['--no-sandbox','--enable-unsafe-swiftshader']});const evidence=[];
try{for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['small-mobile',360,740],['landscape',844,390]]){
 const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/#atlas/CV12');await page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
 const settled=async state=>{await page.mouse.move(1,1);await page.waitForTimeout(400);const result=await layout(page);assert.deepEqual(result,{overlaps:[],clippedLabels:[]},`${name} ${state} overlays`);return result;};
 const canvas=await page.locator('canvas').boundingBox();const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);assert.equal(overflow,false);assert.ok(canvas.y<100);assert.ok(canvas.y+canvas.height<=height+1);
 // Many acupoints on the body at once (male reference).
 assert.ok(Number(await page.locator('canvas').getAttribute('data-rendered-markers'))>=800,'all acupoint markers are rendered');
 const initial=await settled('initial');await page.screenshot({animations:"disabled",path:`${dir}/${name}-initial.png`});
 await page.getByRole('button',{name:'경혈 찾기',exact:true}).click();const dock=await page.locator('.ax-panel').boundingBox();await page.screenshot({animations:"disabled",path:`${dir}/${name}-search.png`});if(width<701)assert.ok(dock.height<=canvas.height*.45,'phone panel within 45% of the scene');await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
 await page.locator('.point-summary').click();await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await page.getByText('해부 모델 로드 완료').waitFor();const card=await page.locator('.selection-card').boundingBox();assert.ok(card.x>=0&&card.x+card.width<=width,'comparison card stays on screen');
 const note=page.locator('.selection-card .comparison-note');await note.waitFor();assert.match(await note.innerText(),/전통적 대응, 압력 경로 아님/);const compare=await settled('compare');await page.screenshot({animations:"disabled",path:`${dir}/${name}-compare.png`});
 await page.getByRole('button',{name:'비교 대상만 보기'}).click();await page.locator('.selection-card').getByRole('button',{name:'확대',exact:true}).click();const isolate=await settled('isolate');await page.screenshot({animations:"disabled",path:`${dir}/${name}-isolate.png`});assert.deepEqual(errors,[]);evidence.push({name,width,height,canvas,dock,overflow,errors,overlays:{initial,compare,isolate}});await page.close();
}await fs.writeFile(`${dir}/layout-metrics.json`,JSON.stringify({date:new Date().toISOString(),origin,evidence},null,2)+'\n');console.log('Visual workspace gates passed for four viewports, including overlay separation, on-canvas point labels and all acupoint markers. Screenshots still require visual review.');}finally{await browser.close();}
