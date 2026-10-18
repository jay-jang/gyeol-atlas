import {test,expect} from '@playwright/test';
import {ready,snapshot,settledCamera} from './helpers';

for(const [name,width,height,hasTouch] of [['desktop',1440,900,false],['mobile',390,844,true]] as const){
  test.describe(name,()=>{
    test.use({viewport:{width,height},hasTouch});

    test('search shortcut returns to its trigger and idle Escape leaves canvas focus alone',async({page})=>{
      await page.goto('/#atlas/CV12');await ready(page);await settledCamera(page);
      const before=await snapshot(page);
      const trigger=page.getByRole('button',{name:'도움말',exact:true});
      await trigger.focus();await page.keyboard.press('/');
      const search=page.getByLabel('경혈·구조 검색');
      await expect(search).toBeFocused();await search.fill('stomach');
      // Moving the caret in an already open search preserves its / trigger.
      if(hasTouch)await search.tap();else await search.click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toHaveCount(0);
      await expect(trigger).toBeFocused();
      // Escape with no panel must not move keyboard control away from the model.
      const canvas=page.locator('canvas');await canvas.focus();await canvas.press('Escape');
      await expect(canvas).toBeFocused();await expect(page.locator('.ax-panel')).toHaveCount(0);
      // A pointer-opened search returns to the search field without reopening it.
      if(hasTouch)await search.tap();else await search.click();
      await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
      await page.keyboard.press('Escape');await expect(search).toBeFocused();
      await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toHaveCount(0);
      // A click/tap can reopen search even when focus was restored to it.
      if(hasTouch)await search.tap();else await search.click();
      await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
      await page.keyboard.press('Escape');await expect(search).toBeFocused();
      // Deliberately refocusing the field also reopens it.
      await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');
      await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
      await page.keyboard.press('Escape');
      expect((await snapshot(page)).camera).toEqual(before.camera);
      expect((await snapshot(page)).dissection).toBe(before.dissection);
      expect((await snapshot(page)).markers).toBe(before.markers);
    });

    test('acupoint detail tabs support arrows, Home/End and labelled content',async({page})=>{
      await page.goto('/#atlas/CV12');await ready(page);await settledCamera(page);
      const before=await snapshot(page),trigger=page.locator('.point-summary');
      if(hasTouch)await trigger.tap();else await trigger.click();
      const tabs=page.getByRole('tablist',{name:'경혈 정보'});
      const overview=tabs.getByRole('tab',{name:'개요',exact:true});await overview.focus();
      await overview.press('ArrowRight');
      const tradition=tabs.getByRole('tab',{name:'효능·오행',exact:true});
      await expect(tradition).toBeFocused();await expect(tradition).toHaveAttribute('aria-selected','true');
      await expect(page.getByRole('tabpanel',{name:'효능·오행',exact:true})).toBeVisible();
      await tradition.press('End');
      const sources=tabs.getByRole('tab',{name:'근거',exact:true});await expect(sources).toBeFocused();
      await sources.press('ArrowRight');await expect(overview).toBeFocused();
      await overview.press('ArrowLeft');await expect(sources).toBeFocused();
      await sources.press('Home');await expect(overview).toBeFocused();
      const anatomy=tabs.getByRole('tab',{name:'해부 구조',exact:true});
      if(hasTouch)await anatomy.tap();else await anatomy.click();
      await expect(anatomy).toHaveAttribute('aria-selected','true');
      const panel=page.getByRole('tabpanel',{name:'해부 구조',exact:true});await expect(panel).toBeVisible();
      expect(await anatomy.getAttribute('aria-controls')).toBe(await panel.getAttribute('id'));
      await expect(tabs.locator('[tabindex="0"]')).toHaveCount(1);
      await anatomy.focus();await anatomy.press('Tab');await expect(panel).toBeFocused();
      await page.keyboard.press('Escape');await expect(page.locator('.detail-panel')).toHaveCount(0);
      await expect(trigger).toBeFocused();
      const after=await snapshot(page);
      expect(after.camera).toEqual(before.camera);expect(after.dissection).toBe(before.dissection);
      expect(after.pointId).toBe('CV12');expect(after.markers).toBe(before.markers);
    });
  });
}

for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]] as const){
  test(`${name}: home and history keep the saved comparison's acupoint`,async({page})=>{
    await page.setViewportSize({width,height});await page.goto('/#atlas');await ready(page);
    await page.getByRole('button',{name:'경혈 찾기',exact:true}).click();
    await page.getByLabel('경혈 검색').fill('KI3');await page.locator('.point-item').first().click();
    await page.locator('.point-summary').click();
    await page.getByRole('button',{name:'대응 장부의 해부 구조 비교',exact:true}).click();
    await ready(page);await settledCamera(page);const before=await snapshot(page);
    await page.getByRole('link',{name:'결 홈',exact:true}).click();
    await expect(page.locator('.point-summary')).toContainText('KI3');
    await expect(page.locator('.comparison-note')).toContainText('태계');
    await expect(page.locator('.comparison-note')).not.toContainText('족삼리');
    await page.goBack();await expect(page).toHaveURL(/#atlas\/KI3$/);
    await page.goBack();await expect(page).toHaveURL(/#atlas$/);
    await expect(page.locator('.point-summary')).toContainText('KI3');
    await expect(page.locator('.comparison-note')).toContainText('태계');
    const after=await snapshot(page);expect(after.comparison).toEqual(before.comparison);
    expect(after.camera).toEqual(before.camera);
    await page.reload();await ready(page);
    await expect(page.locator('.point-summary')).toContainText('KI3');
    await expect(page.locator('.comparison-note')).toContainText('태계');
    // An unknown explicit ID keeps its no-selection UI, but the retained
    // comparison must still name its own acupoint rather than a placeholder.
    await page.evaluate(()=>{location.hash='atlas/FAKE';});
    await expect(page.locator('.ax')).toHaveAttribute('data-point','false');
    await expect(page.locator('.comparison-note')).toContainText('태계');
    await expect(page.locator('.comparison-note')).not.toContainText('족삼리');
  });
}

test('an atlas with no selected acupoint does not highlight the fallback ST36 structures',async({page})=>{
  let fiberUrl='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))fiberUrl=r.url();});
  await page.goto('/#atlas');await ready(page);
  await expect(page.locator('.ax')).toHaveAttribute('data-point','false');
  await page.getByLabel('연속 해부 박리 깊이').fill('30');await ready(page);
  const colours=await page.evaluate(async url=>{
    const {_roots}=await import(/* @vite-ignore */url),st=_roots.get(document.querySelector('canvas')!).store.getState();
    return ['FMA22544','FMA22545'].map(id=>{
      const m=st.scene.getObjectByName(id);return m?'#'+m.material.color.getHexString():null;
    });
  },fiberUrl);
  expect(colours).toEqual(['#b43f3f','#b43f3f']);
  expect((await snapshot(page)).pointId).toBe('');
});

test('a connective bundle keeps its own isolation label and tooltips describe icon actions',async({page})=>{
  await page.goto('/#atlas');await ready(page);
  await page.getByRole('button',{name:'표시 설정',exact:true}).click();
  await page.getByRole('button',{name:'인대·힘줄만 보기',exact:true}).click();await ready(page);
  const card=page.locator('.selection-card');
  await card.getByRole('button',{name:'전체 구조 보기',exact:true}).click();await ready(page);
  await expect(card.getByRole('button',{name:'인대·힘줄만 보기',exact:true})).toBeVisible();
  await expect(card.getByRole('button',{name:'비교 대상만 보기',exact:true})).toHaveCount(0);
  expect((await snapshot(page)).comparison).toBe(null);
  await expect(card.getByRole('button',{name:'구조 선택 해제',exact:true})).toHaveAttribute('data-tip',/선택 해제/);
  await page.getByRole('button',{name:'도움말',exact:true}).click();
  await expect(page.getByRole('button',{name:'도구 패널 닫기',exact:true})).toHaveAttribute('data-tip',/닫기/);
  await page.keyboard.press('Escape');await page.getByLabel('경혈·구조 검색').click();
  await expect(page.getByRole('button',{name:'도구 패널 닫기',exact:true})).toHaveAttribute('data-tip',/닫기/);
});
