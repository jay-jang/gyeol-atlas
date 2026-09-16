import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const dir='docs/ux-review-2026-09-10';
const b=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const findings=[];
const frame=async p=>p.evaluate(()=>{
 const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,visibleHeight:Math.max(0,Math.min(innerHeight,r.bottom)-Math.max(0,r.top))}};
 return {scrollY,viewport:{width:innerWidth,height:innerHeight},canvas:rect('canvas'),controls:rect('.anatomy-controls'),detail:rect('.detail-panel'),filter:rect('.filter-panel'),pageHeight:document.documentElement.scrollHeight};
});
try{
 for(const [device,width,height] of [['desktop',1440,900],['mobile',390,844]]){
  const p=await b.newPage({viewport:{width,height}});await p.goto('http://127.0.0.1:3002/#atlas/CV12');await p.getByText('해부 모델 로드 완료').waitFor();
  findings.push({device,step:'initial',...await frame(p)});await p.screenshot({path:`${dir}/${device}-initial.png`});
  await p.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await p.getByText('해부 모델 로드 완료').waitFor();
  findings.push({device,step:'after-compare',...await frame(p)});await p.screenshot({path:`${dir}/${device}-after-compare.png`});
  const controls=p.getByRole('region',{name:'단계별 해부 탐색'});
  await controls.getByRole('button',{name:'4장기',exact:true}).click();
  await p.getByLabel('해부 구조 선택').selectOption('FMA7148');
  await controls.getByRole('button',{name:'선택 구조만 보기',exact:true}).click();
  await p.locator('.layer-control').getByRole('button',{name:'장기',exact:true}).click();
  await p.locator('.layer-control').getByRole('button',{name:'근육',exact:true}).click();
  await p.getByText('해부 모델 로드 완료').waitFor();
  findings.push({device,step:'isolated-organ-off-muscle-on',selectedValue:await p.getByLabel('해부 구조 선택').inputValue(),isolationButton:await controls.getByRole('button',{name:'전체 구조 보기',exact:true}).count(),...await frame(p)});
  await p.locator('canvas').screenshot({path:`${dir}/${device}-isolation-layer-switch.png`});
  await p.close();
 }
 await fs.writeFile(`${dir}/observations.json`,JSON.stringify(findings,null,2));console.log(JSON.stringify(findings));
}finally{await b.close();}
