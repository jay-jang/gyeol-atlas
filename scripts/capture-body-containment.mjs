import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas/');
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:90000});
  await ready();await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready();
  await page.evaluate(()=>{
    const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
    s.layers={skin:true,muscle:false,bone:true,organ:false,vessel:false,lymph:false,nerve:false};
    s.displayMode='layers';s.alpha.skin=.18;
    s.selection=null;s.detail=null;s.comparison=null;s.isolated=false;s.cutaway=0;
    s.camera={position:[-.35,1.03,.9],target:[-.35,1.03,-.09]};
    sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));
  });
  await page.reload();await ready();
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.visibleBone==='321');
  await page.screenshot({path:'docs/anatomy-alignment/female-borrowed-arm-containment.png'});
  console.log('Captured published female skin and bone at a fixed diagnostic arm view; no asset changes.');
} finally {await browser.close();}
