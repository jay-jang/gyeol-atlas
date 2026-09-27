import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createApp} from '../server/index.mjs';
const groups=JSON.parse(await fs.readFile('data/male-detail-groups.json','utf8'));
const catalog=JSON.parse(await fs.readFile('data/male-detail-structures.json','utf8'));
const current=groups.find(g=>g.id==='lung'),old=groups.find(g=>g.id==='lung-branches');
const internal=current.ids.filter(id=>!catalog.find(s=>s.id===id).name.startsWith('Parenchyma of '));
const receipt=JSON.parse(await fs.readFile('data/catalog/male-detail-source.json','utf8'));
const server=createApp().listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const origin=(process.env.SMOKE_ORIGIN||`http://127.0.0.1:${server.address().port}`).replace(/\/$/,'');
let browser;
try{
  for(const file of receipt.files){
    const response=await fetch(origin+'/'+file.path.replace(/^public\//,''));assert.equal(response.status,200);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),file.sha256);
  }
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[],records=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(origin+'/#wiki');await page.getByRole('heading',{name:'위키에 물어보기'}).waitFor();
  assert.equal(requests.filter(url=>/\.glb|\.bin\.gz|\/assets\/Atlas-/.test(url)).length,0);
  await page.getByRole('link',{name:'3D 경혈 지도',exact:true}).click();
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});await ready();
  assert.equal(requests.some(url=>url.includes('/male-detail/')),false);
  await page.locator('.featured-anatomy > button').filter({has:page.getByText('폐',{exact:true})}).click();await ready();
  for(const mobile of [false,true]){
    if(mobile){await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'폐실질 함께 보기',exact:true}).click();}
    for(const [id,button,ids] of [['lung',null,current.ids],['lung-internal','혈관·기관지 보기',internal],['lung-branches','이전 세부 가지 별도 보기',old.ids]]){
      if(button){const target=page.getByRole('button',{name:button,exact:true});await target.focus();await target.press('Enter');}
      await ready();
      await page.waitForFunction(expected=>{
        const actual=(document.querySelector('canvas')?.dataset.visibleStructureIds||'').split(',').filter(Boolean).sort();
        return JSON.stringify(actual)===JSON.stringify(expected);
      },[...ids].sort());
      const state=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
      assert.equal(state.detail.id,id);
      const samples=await page.locator('.selection-card').evaluate(root=>{
        const rgb=s=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];
        const lum=v=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const box=root.getBoundingClientRect();
        return [...root.querySelectorAll('p,small,strong,button,summary')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&r.top<box.bottom&&r.bottom>box.top;}).map(el=>{
          const style=getComputedStyle(el);let node=el,bg=[255,255,255];
          while(node){const color=rgb(getComputedStyle(node).backgroundColor);if((color[3]??1)>.99){bg=color;break;}node=node.parentElement;}
          const a=lum(rgb(style.color)),b=lum(bg);
          return {text:el.textContent.trim().slice(0,80),font:parseFloat(style.fontSize),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
        });
      });
      assert.deepEqual(samples.filter(s=>s.font<12||s.contrast<4.5),[]);
      records.push({mobile,id,visible:ids.length,samples});
      await page.reload();await ready();
      assert.deepEqual((await page.locator('canvas').getAttribute('data-visible-structure-ids')).split(',').sort(),[...ids].sort());
    }
  }
  assert.deepEqual(errors,[]);
  const output=process.env.SMOKE_ORIGIN?'docs/anatomy-alignment/lung-public-check.json':'docs/anatomy-alignment/lung-production-check.json';
  await fs.writeFile(output,JSON.stringify({origin,records,errors,sourceFiles:receipt.files},null,2)+'\n');
  console.log('Lung production: exact source hashes, lazy download, three scopes, keyboard/reload, desktop/mobile 12px and 4.5:1 passed.');
}finally{await browser?.close();server.close();}
