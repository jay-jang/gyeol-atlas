// Read-only deployed UI check. Does not validate anatomical registration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';

const origin=(process.env.SMOKE_ORIGIN||'https://jay-jang.github.io/gyeol-atlas').replace(/\/$/,'');
const out='.cache/public-female-composite';
fs.mkdirSync(out,{recursive:true});
const groups=JSON.parse(fs.readFileSync('data/female-composite-groups.json'));
const catalog=JSON.parse(fs.readFileSync('data/female-atlas-structures.json'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const errors=[],failures=[],checks=[],layouts=[],requests=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  page.on('response',r=>{if(r.status()>=400)failures.push({status:r.status(),url:r.url()});});
  await page.goto(`${origin}/?verify=female-composite`);
  const ready=()=>expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:60000});
  await ready();await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready();
  const card=page.getByRole('region',{name:'선택 구조 조작'}),canvas=page.locator('canvas');
  const visible=async()=>(await canvas.getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  for(const [index,group] of groups.entries()){
    await page.getByRole('button',{name:'구조 찾기',exact:true}).click();
    await page.getByLabel('경혈·구조 검색').fill(group.ids[0]);await page.locator('.structure-item').click();await ready();
    await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();
    await card.getByRole('button',{name:`${group.name} 전체 상세 보기`,exact:true}).click();await ready();
    await expect.poll(visible).toEqual([...group.ids].sort());
    if(index===0){
      for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]]){
        await page.setViewportSize({width,height});
        const summary=card.locator('.organ-detail-parts summary');
        await expect(summary).toBeInViewport({ratio:1});
        await expect(card.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport({ratio:1});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
        // Wait for the camera's resize framing before the visual evidence.
        await page.waitForTimeout(1000);
        await page.screenshot({path:`${out}/${name}.png`});
        layouts.push({name,width,height,partsSelector:await summary.boundingBox(),canvas:await canvas.boundingBox()});
      }
      await page.setViewportSize({width:1440,height:900});
    }
    const parts=catalog.filter(part=>group.ids.includes(part.id));
    const atomicChecks=[];
    await card.locator('.organ-detail-parts summary').click();
    await expect(card.locator('.organ-detail-parts button')).toHaveCount(group.ids.length);
    for(const [partIndex,part] of parts.entries()){
      const button=card.locator('.organ-detail-parts button').nth(partIndex);
      await expect(button.locator('small')).toHaveText(part.name);
      await button.click();await ready();
      await expect.poll(visible).toEqual([part.id]);
      await expect(button).toHaveAttribute('aria-pressed','true');
      atomicChecks.push(part.id);
    }
    const selected=await visible();await page.reload();await ready();await expect.poll(visible).toEqual(selected);
    await card.getByRole('button',{name:`${group.name} 전체 모형`,exact:true}).click();await ready();
    await expect.poll(visible).toEqual([...group.ids].sort());
    await page.reload();await ready();await expect.poll(visible).toEqual([...group.ids].sort());
    checks.push({group:group.id,visibleIds:await visible(),atomicChecks,restoredAtomic:selected,restoredComposite:await visible()});
    await card.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const result={origin,verifiedAt:new Date().toISOString(),checks,layouts,errors,failures,
    scripts:[...new Set(requests.filter(r=>/\/assets\/index-.*\.js/.test(r)))],
    scriptSha256:createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex')};
  fs.writeFileSync(`${out}/verification.json`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
