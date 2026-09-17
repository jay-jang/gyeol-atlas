import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const records=[]; const origin=process.env.SMOKE_ORIGIN||'http://127.0.0.1:5174';
try {
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await page.goto(origin.replace(/\/$/,'')+'/#atlas/ST36'); await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
 for(const name of ['경혈 찾기','레이어 조절','구조 찾기','도움말','효능·오행']){
  if(name==='효능·오행') {
   await page.locator('.point-summary').click();
   await page.getByRole('tab',{name:'효능·오행'}).click();
   await page.locator('.point-tradition').scrollIntoViewIfNeeded();
  } else await page.getByRole('button',{name,exact:true}).click();
  const samples=await page.locator('.dock-body').evaluate(root=>{
   const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];
   const luminance=v=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
   return [...root.querySelectorAll('p,label,small,strong,button,summary,select,dt,dd')].filter(el=>{
    const r=el.getBoundingClientRect();const box=root.getBoundingClientRect();return r.width&&r.height&&r.top<box.bottom&&r.bottom>box.top;
   }).map(el=>{
    const c=getComputedStyle(el);let bg=[255,255,255],node=el;
    while(node){const b=rgb(getComputedStyle(node).backgroundColor);if((b[3]??1)>.99){bg=b;break;}node=node.parentElement;}
    const a=luminance(rgb(c.color)),b=luminance(bg);
    return {text:el.textContent.trim().slice(0,60),font:parseFloat(c.fontSize),color:c.color,background:bg,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
   });
  });
  records.push({name,samples});await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
 }
 await fs.writeFile('docs/acupoint-expansion/readability.json',JSON.stringify({origin,records},null,2)+'\n');
 const failures=records.flatMap(r=>r.samples.filter(s=>s.font<12||s.contrast<4.5).map(s=>({panel:r.name,...s})));
 assert.deepEqual(failures,[]); console.log('Visible mobile panel text: minimum 12px and contrast >= 4.5:1 passed.');
} finally {await browser.close();}
