import {chromium} from '@playwright/test';import fs from 'node:fs/promises';
const b=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});const result={};
try{
const p=await b.newPage({viewport:{width:1440,height:900}});await p.goto('http://127.0.0.1:3002/#atlas/CV12');await p.getByText('해부 모델 로드 완료').waitFor();await p.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await p.getByText('해부 모델 로드 완료').waitFor();
const canvas=p.locator('canvas');const r=await canvas.boundingBox();await canvas.click({position:{x:r.width*.54,y:r.height*.35}});result.withSkin=await p.getByLabel('해부 구조 선택').inputValue();await p.locator('.layer-control').getByRole('button',{name:'체표',exact:true}).click();await canvas.click({position:{x:r.width*.54,y:r.height*.35}});result.withoutSkin=await p.getByLabel('해부 구조 선택').inputValue();await p.close();
const m=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await m.goto('http://127.0.0.1:3002/');await m.getByText('해부 모델 로드 완료').waitFor();await m.evaluate(()=>scrollTo(0,1000));const cdp=await m.context().newCDPSession(m);
async function swipe(x){await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:430}]});for(let y=410;y>=230;y-=20)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(400);return await m.evaluate(()=>scrollY);}
result.touch={before:await m.evaluate(()=>scrollY),canvasAfter:await swipe(195),marginAfter:await swipe(5)};await m.close();await fs.writeFile('docs/ux-review-2026-09-10/interaction-observations.json',JSON.stringify(result,null,2));console.log(result);
}finally{await b.close();}
