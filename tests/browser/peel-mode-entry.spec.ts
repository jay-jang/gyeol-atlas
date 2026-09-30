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
  // Every system is present at 0%; the opaque skin covers the rest.
  expect(after.layers).toEqual({skin:true,muscle:true,bone:true,organ:true,vessel:true,lymph:true,nerve:true});
  // Same pose up to floating-point rounding.
  for(const key of ['position','target'])for(let i=0;i<3;i++)expect(Math.abs(after.camera[key][i]-before.camera[key][i])).toBeLessThan(1e-9);
  expect(after.markers).toBe(before.markers);
});

for(const sex of ['male','female'])test(`${sex}: layer view has an explicit peel entry on desktop and touch`,async({browser})=>{
  test.setTimeout(150000);
  for(const [width,height] of [[1440,900],[390,844]]){
    // Configure the layer using the desktop-only quick view, then exercise
    // the actual responsive entry control with touch enabled on mobile.
    const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:width===390});const page=await context.newPage();
    try {
      await page.goto(origin);await ready(page);
      if(sex==='female'){await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();await ready(page);}
      await page.getByRole('button',{name:'장기 빠른 보기',exact:true}).click();await ready(page);
      await page.setViewportSize({width,height});
      if(width===390){await page.reload();await ready(page);}
      const entry=page.getByRole('button',{name:'현재 기준 76.0%에서 연속 박리 시작',exact:true});
      await expect(entry).toBeInViewport();
      await expect(page.getByLabel('연속 해부 박리 깊이')).toHaveAttribute('aria-valuetext','계통별 보기 중 · 박리 시작 기준 76.0%');
      const metrics=await entry.evaluate(el=>{
        const s=getComputedStyle(el),rect=el.getBoundingClientRect();
        const lum=(c:string)=>c.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const fg=lum(s.color),bg=lum(s.backgroundColor);
        return {font:parseFloat(s.fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05),height:rect.height};
      });
      expect(metrics.font).toBeGreaterThanOrEqual(12);expect(metrics.contrast).toBeGreaterThanOrEqual(4.5);expect(metrics.height).toBeGreaterThanOrEqual(32);
      // Visible system names on the rail, measured on the rail's own surface.
      const labelMetrics=await page.locator('.depth-steps .ax-stop-name').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length>0).map(el=>{
        const s=getComputedStyle(el);let node:Element|null=el,background='rgb(0, 0, 0)';
        while(node){const b=getComputedStyle(node).backgroundColor;const a=b.match(/[\d.]+/g)!.map(Number);if(a.length<4||a[3]>.5){background=b;break;}node=node.parentElement;}
        const lum=(c:string)=>c.match(/[\d.]+/g)!.slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const fg=lum(s.color),bg=lum(background);
        return {font:parseFloat(s.fontSize),contrast:(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)};
      }));
      expect(labelMetrics.length).toBeGreaterThan(0);
      for(const m of labelMetrics){expect(m.font).toBeGreaterThanOrEqual(12);expect(m.contrast).toBeGreaterThanOrEqual(4.5);}
      if(width===390){
        const labels=await page.locator('.depth-steps').boundingBox(),panel=await page.locator('.depth-explorer').boundingBox();
        expect(labels!.y+labels!.height).toBeLessThanOrEqual(panel!.y+panel!.height);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await page.screenshot({path:`${captures}/peel-mode-${sex}-${width}-layers.png`});
      const before=await snapshot(page);
      if(width===390)await entry.tap();else {await entry.focus();await page.keyboard.press('Enter');}
      await expect.poll(async()=>(await snapshot(page)).displayMode).toBe('dissection');await ready(page);
      const after=await snapshot(page);expect(after.dissection).toBe(76);
      expect(after.camera).toEqual(before.camera);expect(after.markers).toBe(before.markers);expect(after.alpha).toEqual(before.alpha);
      await expect(page.locator('.depth-heading')).toContainText('76.0%');await expect(page.locator('.depth-heading')).toContainText('장기');
      await expect(entry).toHaveCount(0);
      await page.locator('canvas').focus();await page.keyboard.press('Alt+ArrowDown');
      await expect.poll(async()=>(await snapshot(page)).dissection).toBe(76.5);
      if(width===390){
        const labels=await page.locator('.depth-steps').boundingBox(),panel=await page.locator('.depth-explorer').boundingBox();
        expect(labels!.y+labels!.height).toBeLessThanOrEqual(panel!.y+panel!.height);
      }
      await page.screenshot({path:`${captures}/peel-mode-${sex}-${width}-peeling.png`});
      await page.reload();await ready(page);expect((await snapshot(page)).displayMode).toBe('dissection');
    } finally {await context.close();}
  }
});
