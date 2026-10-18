// Baseline screenshots shared by the three independent UI/UX proposals (2026-10-16).
// Usage: PATH=<node24>:$PATH node docs/review-2026-10-16/capture-baseline.mjs [outDir]
import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const origin=process.env.SMOKE_ORIGIN||'http://127.0.0.1:5174';const dir=process.argv[2]||'docs/review-2026-10-16/baseline';await fs.mkdir(dir,{recursive:true});
const VIEWPORTS=[['desktop',1440,900],['laptop',1280,720],['tablet',820,1180],['mobile',390,844],['small-mobile',360,740],['landscape',844,390]];
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']});
const metrics=[];
const shot=async(page,name,state)=>{await page.mouse.move(1,1);await page.waitForTimeout(500);await page.screenshot({animations:'disabled',path:`${dir}/${name}-${state}.png`});
 metrics.push({name,state,overflowX:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),canvas:await page.locator('canvas').boundingBox().catch(()=>null)});};
const closePanels=async page=>{await page.keyboard.press('Escape');await page.waitForTimeout(200);};
try{for(const [name,width,height] of VIEWPORTS){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce',hasTouch:width<900,isMobile:width<500});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/#atlas');await page.evaluate(()=>{sessionStorage.clear();localStorage.clear();});await page.goto(origin+'/#atlas/CV12');await page.reload();
 await page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
 await shot(page,name,'01-initial');
 await page.locator('.point-summary').click();await shot(page,name,'02-point-detail');await closePanels(page);
 await page.locator('.ax-search input').click();await shot(page,name,'03-search-empty');
 await page.locator('.ax-search input').fill('위');await shot(page,name,'04-search-query');
 await page.locator('.structure-item').first().click();await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});await shot(page,name,'05-structure-selected');
 await page.getByRole('button',{name:'구조 선택 해제'}).click();await page.waitForTimeout(300);
 await page.getByRole('button',{name:'표시 설정'}).click();await shot(page,name,'06-display-settings');await closePanels(page);
 await page.getByRole('button',{name:'경혈 찾기',exact:true}).first().click();await shot(page,name,'07-point-list');await closePanels(page);
 await page.getByRole('button',{name:'도움말'}).click();await shot(page,name,'08-help');await closePanels(page);
 await page.locator('.point-summary').click();await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await page.getByText('해부 모델 로드 완료').waitFor();await shot(page,name,'09-comparison');
 await page.getByRole('button',{name:'여성'}).click();await page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});await shot(page,name,'10-female');
 await page.goto(origin+'/#wiki');await page.waitForTimeout(800);await shot(page,name,'11-wiki-home');
 await page.goto(origin+'/#wiki/points/CV12');await page.waitForTimeout(800);await shot(page,name,'12-wiki-point');
 await page.goto(origin+'/#sources');await page.waitForTimeout(800);await shot(page,name,'13-sources');
 metrics.push({name,errors});await page.close();console.log('captured',name);
}}finally{await browser.close();}
await fs.writeFile(`${dir}/metrics.json`,JSON.stringify(metrics,null,1)+'\n');
