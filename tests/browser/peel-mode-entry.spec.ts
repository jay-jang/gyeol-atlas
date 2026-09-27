import {test,expect} from '@playwright/test';
import {ready,compare,snapshot} from './helpers';
const origin=process.env.SMOKE_ORIGIN ? `${process.env.SMOKE_ORIGIN.replace(/\/$/,'')}/` : '/';
const captures=process.env.PEEL_SCREENSHOT_DIR || 'docs/anatomy-alignment';

test('a backward peel input at zero exits a comparison instead of being discarded',async({page})=>{
  await page.goto(`${origin}#atlas/KI3`);await ready(page);await compare(page);
  const before=await snapshot(page);expect(before.displayMode).toBe('layers');expect(before.dissection).toBe(0);
  await page.locator('canvas').focus();await page.keyboard.press('Alt+ArrowUp');
  await expect.poll(async()=>(await snapshot(page)).displayMode).toBe('dissection');
  const after=await snapshot(page);
  expect(after.dissection).toBe(0);expect(after.comparison).toBe(null);expect(after.selection).toBe(null);
  expect(after.layers).toEqual({skin:true,muscle:false,bone:false,organ:false,vessel:false,lymph:false,nerve:false});
  expect(after.camera).toEqual(before.camera);expect(after.markers).toBe(before.markers);
});

for(const sex of ['male','female'])test(`${sex}: layer view has an explicit peel entry on desktop and touch`,async({browser})=>{
  test.setTimeout(150000);
  for(const [width,height] of [[1440,900],[390,844]]){
    // Configure the layer using the desktop-only quick view, then exercise
    // the actual responsive entry control with touch enabled on mobile.
    const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:width===390});const page=await context.newPage();
    try {
      await page.goto(origin);await ready(page);
      if(sex==='female'){await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
      await page.getByRole('button',{name:'장기 빠른 보기',exact:true}).click();await ready(page);
      await page.setViewportSize({width,height});
      if(width===390){await page.reload();await ready(page);}
      await expect(page.locator('.depth-heading')).toContainText('계통별 보기');
      const entry=page.getByRole('button',{name:'현재 기준 66.0%에서 연속 박리 시작',exact:true});
      await expect(entry).toBeInViewport();
      await expect(page.getByLabel('연속 해부 박리 깊이')).toHaveAttribute('aria-valuetext','계통별 보기 중 · 박리 시작 기준 66.0%');
      const metrics=await entry.evaluate(el=>{
        const s=getComputedStyle(el),rect=el.getBoundingClientRect();
        const lum=(c:string)=>c.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const fg=lum(s.color),bg=lum(s.backgroundColor);
        return {font:parseFloat(s.fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),height:rect.height};
      });
      expect(metrics.font).toBeGreaterThanOrEqual(12);expect(metrics.contrast).toBeGreaterThanOrEqual(4.5);expect(metrics.height).toBeGreaterThanOrEqual(32);
      const labelMetrics=await page.locator('.depth-steps span').evaluateAll(elements=>elements.map(el=>{
        const s=getComputedStyle(el),background=getComputedStyle(el.closest('.depth-explorer')!).backgroundImage;
        const lum=(c:string)=>c.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const fg=lum(s.color);const stops=background.match(/rgb\([^)]*\)/g)!;
        return {font:parseFloat(s.fontSize),contrast:Math.min(...stops.map(c=>(Math.max(fg,lum(c))+.05)/(Math.min(fg,lum(c))+.05)))};
      }));
      for(const m of labelMetrics){expect(m.font).toBeGreaterThanOrEqual(12);expect(m.contrast).toBeGreaterThanOrEqual(4.5);}
      if(width===390){
        const labels=await page.locator('.depth-steps').boundingBox(),panel=await page.locator('.explore-sidebar').boundingBox();
        expect(labels!.y+labels!.height).toBeLessThanOrEqual(panel!.y+panel!.height);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`${captures}/peel-mode-${sex}-${width}-layers.png`});
      const before=await snapshot(page);
      if(width===390)await entry.tap();else {await entry.focus();await page.keyboard.press('Enter');}
      await expect.poll(async()=>(await snapshot(page)).displayMode).toBe('dissection');await ready(page);
      const after=await snapshot(page);expect(after.dissection).toBe(66);
      expect(after.camera).toEqual(before.camera);expect(after.markers).toBe(before.markers);expect(after.alpha).toEqual(before.alpha);
      await expect(page.locator('.depth-heading')).toContainText('66.0% · 장기 노출');
      await expect(entry).toHaveCount(0);
      await page.locator('canvas').focus();await page.keyboard.press('Alt+ArrowDown');
      await expect.poll(async()=>(await snapshot(page)).dissection).toBe(66.5);
      if(width===390){
        const labels=await page.locator('.depth-steps').boundingBox(),panel=await page.locator('.explore-sidebar').boundingBox();
        expect(labels!.y+labels!.height).toBeLessThanOrEqual(panel!.y+panel!.height);
      }
      await page.screenshot({path:`${captures}/peel-mode-${sex}-${width}-peeling.png`});
      await page.reload();await ready(page);expect((await snapshot(page)).displayMode).toBe('dissection');
    } finally {await context.close();}
  }
});
