import {test,expect} from '@playwright/test';
import {ready,snapshot,organs} from './helpers';
import {detailProjection} from './detail-projection';

test('female reference brain exposes provenance for bundle and individual selections',async({page})=>{
  test.setTimeout(120000);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.setViewportSize({width:1440,height:900});await page.goto('/');await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);
  await (await organs(page)).filter({has:page.getByText('뇌',{exact:true})}).click();await ready(page);
  const notice=page.locator('[data-brain-provenance]');await expect(notice).toBeVisible();
  await expect(notice).toContainText('Allen 참조 282개 + Visible Human 시신경교차 1개');
  await expect(notice).toContainText('차용 머리뼈와 뇌 모형 35개 표면 교차');
  expect((await snapshot(page)).selection.ids).toHaveLength(283);
  const fit=async()=>{
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).clearance).toBeGreaterThan(4);
    await expect.poll(async()=>(await detailProjection(page,fiberUrl)).canvasClearance).toBeGreaterThan(0);
  };
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});await fit();
    const warning=notice.locator('p').first();await warning.scrollIntoViewIfNeeded();
    await expect(warning).toBeInViewport();
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    const readability=await warning.evaluate(el=>{
      const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
      const luminance=(v:number[])=>v.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
      const fg=luminance(rgb(getComputedStyle(el).color));
      const bg=luminance(rgb(getComputedStyle(el.closest('.selection-card')!).backgroundColor));
      return {font:parseFloat(getComputedStyle(el).fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
    });
    expect(readability.font).toBeGreaterThanOrEqual(12);expect(readability.contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({path:`docs/anatomy-alignment/brain-skull-warning-${label}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await notice.locator('summary').click();
  await expect(notice).toContainText('표면 교차 55쌍');
  await expect(notice.getByRole('link')).toHaveAttribute('href','https://3d.nih.gov/entries/3DPX-020959');
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});await fit();
    await page.screenshot({path:`docs/anatomy-alignment/brain-origins-${label}.png`});
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    await notice.getByRole('link').scrollIntoViewIfNeeded();
    await expect(notice.getByRole('link')).toBeInViewport();await fit();
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    await page.screenshot({path:`docs/anatomy-alignment/brain-origins-${label}-scrolled.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.organ-detail-parts summary').click();
  await page.locator('.organ-detail-parts button').first().click();await ready(page);
  expect((await snapshot(page)).selection.ids).toHaveLength(1);await expect(notice).toBeVisible();await fit();
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0070']);
  const card=page.locator('.selection-card');
  await expect(card.locator(':scope > div > .selection-source')).toContainText('Visible Human 여성 시신경교차');
  await expect(card.locator(':scope > div > .selection-description')).not.toContainText('여성 기증자 뇌 스캔이 아닙니다');
  for(const [label,width,height] of [['desktop',1440,900],['mobile',390,844],['landscape',844,390]] as const){
    await page.setViewportSize({width,height});await fit();
    await card.locator(':scope > div > .selection-source').scrollIntoViewIfNeeded();
    await expect(card.locator(':scope > div > .selection-source')).toBeInViewport();
    await expect(page.getByRole('button',{name:'전신으로 돌아가기',exact:true})).toBeInViewport();
    const readability=await card.evaluate(root=>{
      const rgb=(value:string)=>value.match(/[\d.]+/g)!.map(Number);
      const lum=(v:number[])=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((n,x,i)=>n+x*[.2126,.7152,.0722][i],0);
      return [...root.querySelectorAll('p,small,summary,button')].filter(el=>{
        const closed=el.closest('details:not([open])');
        return el.getBoundingClientRect().width>0&&(!closed||closed.querySelector(':scope > summary')?.contains(el));
      }).map(el=>{
        const style=getComputedStyle(el);let bg=[255,255,255],node:Element|null=el;
        while(node){const c=rgb(getComputedStyle(node).backgroundColor);if((c[3]??1)>.99){bg=c;break;}node=node.parentElement;}
        const a=lum(rgb(style.color)),b=lum(bg);
        return {text:el.textContent,font:parseFloat(style.fontSize),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      });
    });
    expect(readability.filter(r=>r.font<12||r.contrast<4.5)).toEqual([]);
    await page.screenshot({path:`docs/anatomy-alignment/optic-chiasm-origin-${label}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('button',{name:'기관 전체 모형',exact:true}).click();await ready(page);
  const parts=page.locator('.organ-detail-parts');
  if(!await parts.getAttribute('open').then(value=>value!==null))await parts.locator('summary').click();
  await parts.locator('button').nth(1).click();await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual(['HRAF0071']);
  await expect(card.locator(':scope > div > .selection-source')).toContainText('Allen 기반');
  await expect(card.locator(':scope > div > .selection-description')).toContainText('여성 기증자 뇌 스캔이 아닙니다');
  await page.getByRole('button',{name:'전신으로 돌아가기',exact:true}).click();await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'남성',exact:true}).click();await ready(page);
  await expect(notice).toHaveCount(0);
  expect(errors).toEqual([]);
});
