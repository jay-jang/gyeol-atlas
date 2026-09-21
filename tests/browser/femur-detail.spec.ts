import {test,expect} from '@playwright/test';
import {ready,snapshot,openTool,closeTool} from './helpers';
import {detailProjection} from './detail-projection';
import fs from 'node:fs';
import atlas from '../../public/models/female/atlas-female.json' with {type:'json'};

test('female femur selection opens every source child and keeps atomic selection separate',async({page})=>{
  test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  const metrics:unknown[]=[];
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  const canvas=page.locator('canvas'),card=page.getByRole('region',{name:'선택 구조 조작'});
  const visible=async()=>(await canvas.getAttribute('data-visible-structure-ids')||'').split(',').filter(Boolean).sort();
  for(const [side,root,label] of [['L','HRAF0937','왼쪽'],['R','HRAF0911','오른쪽']]){
    const ids=atlas.concepts.find(c=>c.id===`HRA:femur_${side}`)!.elements;
    await openTool(page,'구조 찾기');await page.getByLabel('해부 구조 검색').fill(root);
    await page.locator('.structure-item').click();await ready(page);await closeTool(page);
    const bounds=await canvas.getAttribute('data-selected-world-bounds');
    expect((await snapshot(page)).selection.ids).toEqual([root]);
    await expect(card.getByRole('button',{name:`${label} 대퇴골 전체 상세 보기`,exact:true})).toBeVisible();
    await card.getByRole('button',{name:`${label} 대퇴골 전체 상세 보기`,exact:true}).click();await ready(page);
    await expect.poll(visible).toEqual([...ids].sort());
    expect((await snapshot(page)).detail.ids).toEqual(ids);expect((await snapshot(page)).stage).toBe(2);
    await expect(card.locator('[data-composite-provenance]')).toContainText('관절연골');
    await card.locator('.organ-detail-parts summary').click();
    expect(await card.locator('.organ-detail-parts button').count()).toBe(16);
    await card.locator('.organ-detail-parts button').filter({hasText:`Femur (${side==='L'?'left':'right'})`}).click();await ready(page);
    await expect.poll(visible).toEqual([root]);expect(await canvas.getAttribute('data-selected-world-bounds')).toBe(bounds);
    await page.reload();await ready(page);await expect.poll(visible).toEqual([root]);
    expect((await snapshot(page)).detail.ids).toEqual(ids);
    await card.getByRole('button',{name:`${label} 대퇴골 전체 모형`,exact:true}).click();await ready(page);
    await expect.poll(visible).toEqual([...ids].sort());
    if(side==='L')for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
      await page.setViewportSize({width,height});
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
      await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
      await expect(card.locator('.organ-detail-parts summary')).toBeInViewport({ratio:1});
      await expect(card.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const readability=await card.evaluate(root=>{
        const rgb=(s:string)=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];
        const lum=(v:number[])=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
        return [...root.querySelectorAll('summary,button')].filter(el=>{
          const closed=el.closest('details:not([open])');
          return el.getBoundingClientRect().width>0&&(!closed||closed.querySelector(':scope > summary')?.contains(el));
        }).map(el=>{
          const c=getComputedStyle(el);let bg=[255,255,255],node:Element|null=el;
          while(node){const color=rgb(getComputedStyle(node).backgroundColor);if((color[3]??1)>.99){bg=color;break;}node=node.parentElement;}
          const a=lum(rgb(c.color)),b=lum(bg);return {text:el.textContent?.trim(),font:parseFloat(c.fontSize),color:c.color,background:bg,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
        });
      });
      expect(readability.filter(r=>r.font<12||r.contrast<4.5)).toEqual([]);
      metrics.push({viewport:name,projection:await detailProjection(page,fiberUrl),readability});
      await page.screenshot({path:`docs/ui-renewal/female-femur-detail-${name}.png`});
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByLabel('연속 해부 박리 깊이').fill('50.5');await ready(page);
    expect((await snapshot(page)).detail).toBe(null);expect((await snapshot(page)).selection).toBe(null);
  }
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  await expect(card).toHaveCount(0);expect(errors).toEqual([]);
  fs.writeFileSync('docs/ui-renewal/female-femur-detail-metrics.json',JSON.stringify({metrics,errors},null,2)+'\n');
});
