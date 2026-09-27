import {test,expect} from '@playwright/test';
import {ready,snapshot,openTool,closeTool} from './helpers';
import {detailProjection} from './detail-projection';
import fs from 'node:fs';

test('female spinal cord partial rest pose retains whole and individually selectable segments',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill('HRAF0370');
  await page.locator('.structure-item').click();await ready(page);await closeTool(page);
  const card=page.getByRole('region',{name:'선택 구조 조작'}),canvas=page.locator('canvas');
  const bounds=await canvas.getAttribute('data-selected-world-bounds');
  const visible=async()=>(await canvas.getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  await expect(card.getByRole('button',{name:'척수 수록 분절 전체 상세 보기',exact:true})).toBeVisible();
  await card.getByRole('button',{name:'척수 수록 분절 전체 상세 보기',exact:true}).click();await ready(page);
  const group=JSON.parse(fs.readFileSync('data/female-composite-groups.json','utf8')).find((g:{id:string})=>g.id==='spinal-cord');
  await expect.poll(visible).toEqual([...group.ids].sort());
  expect((await snapshot(page)).stage).toBe(6);
  await card.locator('[data-composite-provenance] summary').click();
  await expect(card.locator('[data-composite-provenance]')).toContainText('표시용 15분절의 국소 이동');
  await card.locator('[data-composite-provenance] summary').click();
  await card.locator('.organ-detail-parts summary').click();
  const buttons=card.locator('.organ-detail-parts button');expect(await buttons.count()).toBe(29);
  const labels=await buttons.allTextContents();
  expect(labels[13]).toContain('T6');expect(labels[14]).toContain('T7');expect(labels[15]).toContain('T8');
  for(let i=0;i<group.ids.length;i++){
    await buttons.nth(i).click();await ready(page);await expect.poll(visible).toEqual([group.ids[i]]);
  }
  await buttons.filter({hasText:'T10 척수'}).click();await ready(page);
  await expect.poll(visible).toEqual(['HRAF0370']);
  await expect.poll(()=>canvas.getAttribute('data-selected-world-bounds')).toBe(bounds);
  await page.reload();await ready(page);await expect.poll(visible).toEqual(['HRAF0370']);
  expect((await snapshot(page)).detail.ids).toEqual(group.ids);
  await card.getByRole('button',{name:'척수 수록 분절 전체 모형',exact:true}).click();await ready(page);
  const metrics=[];
  for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
    await expect(card.locator('.organ-detail-parts summary')).toBeInViewport({ratio:1});
    await expect(card.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport({ratio:1});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const measure=(root:Element)=>{
      const rgb=(s:string)=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];
      const lum=(v:number[])=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
      return [...root.querySelectorAll('summary,button,p')].filter(el=>{
        const closed=el.closest('details:not([open])');
        return el.getBoundingClientRect().width>0&&(!closed||closed.querySelector(':scope > summary')?.contains(el));
      }).map(el=>{
        const c=getComputedStyle(el);let bg=[255,255,255],node:Element|null=el;
        while(node){const color=rgb(getComputedStyle(node).backgroundColor);if((color[3]??1)>.99){bg=color;break;}node=node.parentElement;}
        const a=lum(rgb(c.color)),b=lum(bg);return {text:el.textContent?.trim(),font:parseFloat(c.fontSize),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    };
    const readability=await card.evaluate(measure);
    expect(readability.filter(r=>r.font<12||r.contrast<4.5)).toEqual([]);
    const projection=await detailProjection(page,fiberUrl);
    await page.screenshot({path:`docs/ui-renewal/female-spinal-detail-${name}.png`});
    await card.locator('[data-composite-provenance] summary').click();
    await card.locator('[data-composite-provenance] p').scrollIntoViewIfNeeded();
    await expect(card.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport({ratio:1});
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
    const sourceReadability=await card.evaluate(measure);
    expect(sourceReadability.filter(r=>r.font<12||r.contrast<4.5)).toEqual([]);
    metrics.push({viewport:name,projection,readability,sourceReadability});
    await page.screenshot({path:`docs/ui-renewal/female-spinal-detail-${name}-provenance.png`});
    await card.locator('[data-composite-provenance] summary').click();
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
  expect((await snapshot(page)).detail).toBe(null);expect((await snapshot(page)).selection).toBe(null);
  await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill('경수');
  expect(await page.locator('.structure-item').count()).toBe(8);
  await page.getByLabel('해부 구조 검색').fill('Tenth thoracic spinal cord segment');
  expect(await page.locator('.structure-item').count()).toBe(1);await closeTool(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  expect((await snapshot(page)).detail).toBe(null);await expect(card).toHaveCount(0);expect(errors).toEqual([]);
  fs.writeFileSync('docs/ui-renewal/female-spinal-detail-metrics.json',JSON.stringify({metrics,errors},null,2)+'\n');
});
