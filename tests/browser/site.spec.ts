import {test,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import anchors from '../../data/anchors.json' with {type:'json'};
import wiki from '../../data/wiki.json' with {type:'json'};
import sources from '../../data/sources.json' with {type:'json'};
import {ready,openTool,choosePoint,closeTool,snapshot,openFilters} from './helpers';
test('model-first scene, actual marker click, search, bookmarks and source-linked wiki',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);
 await expect(page.getByRole('button',{name:/경혈 선택/})).toBeVisible();await expect(page.locator('.point-label')).toHaveCount(0);
 const box=await page.locator('canvas').boundingBox();expect(box!.y).toBeLessThan(100);expect(box!.height).toBeGreaterThan(700);
 await openTool(page,'레이어 조절');await page.getByLabel('경혈 표식',{exact:true}).selectOption('filtered');await closeTool(page);
 const pose=(await snapshot(page)).camera;const camera=new PerspectiveCamera(39,box!.width/box!.height,.01,20);camera.position.fromArray(pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld();const point=anchors.find(a=>a.pointId==='CV17')!;const projected=new Vector3(...point.position as [number,number,number]).project(camera);
 await page.locator('canvas').click({position:{x:(projected.x+1)*box!.width/2,y:(1-projected.y)*box!.height/2}});await expect(page.locator('.point-summary')).toContainText('단중');
 await choosePoint(page,'LI 4');await expect(page.locator('.point-summary')).toContainText('합곡');await page.locator('.point-summary').click();await page.getByRole('button',{name:'북마크 저장',exact:true}).click();await page.reload();await ready(page);await page.locator('.point-summary').click();await expect(page.getByRole('button',{name:'북마크 해제',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'위키에서 더 알아보기'}).click();await expect(page.locator('article h1')).toHaveText('합곡 LI4');await expect(page.locator('.backlinks a').first()).toBeVisible();
 await expect(page.locator('.article-meta')).toContainText(wiki.find(d=>d.id==='points/LI4')!.reviewStatus);await expect(page.getByRole('link',{name:'이 경혈을 3D에서 보기'})).toHaveAttribute('href','#atlas/LI4');
 await page.getByRole('link',{name:'지식 위키',exact:true}).first().click();await expect(page.locator('.wiki-saved')).toContainText('합곡');await page.getByLabel('위키 질문').fill('내관과 외관');await page.getByRole('button',{name:'질문 보내기'}).click();await expect(page.locator('.answer')).toContainText('PC6');await expect(page.locator('.answer')).toContainText('TE5');
 await page.getByRole('link',{name:'출처와 자료'}).click();await expect(page.locator('.source-cards article')).toHaveCount(14);expect(errors).toEqual([]);
});
test('mobile canvas and overlay coexist, filtered lists, keyboard dismissal and deep links',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await ready(page);const canvas=await page.locator('canvas').boundingBox();expect(canvas!.y).toBeLessThan(100);expect(canvas!.y+canvas!.height).toBeLessThanOrEqual(844);
 await openTool(page,'경혈 찾기');const dock=await page.locator('.ax-panel').boundingBox();expect(dock!.height).toBeLessThan(canvas!.height*.45);expect(dock!.y-canvas!.y).toBeGreaterThan(canvas!.height*.35);expect(dock!.y+dock!.height).toBeLessThanOrEqual((await page.locator('.ax-depth').boundingBox())!.y);await page.getByLabel('경혈 검색').fill('없는경혈');await expect(page.getByText('일치하는 경혈이 없습니다')).toBeVisible();await page.getByRole('button',{name:'전체 경혈 보기'}).click();await expect(page.locator('.point-item')).toHaveCount(409);await openFilters(page);await page.getByLabel('경혈 분류',{exact:true}).selectOption('yuan');await expect(page.locator('.point-item')).toHaveCount(12);await expect(page.locator('.point-item [data-category="yuan"]')).toHaveCount(12);await expect(page.locator('.point-item [data-category="yuan"]').first()).toContainText('원혈');await page.getByLabel('경혈 분류',{exact:true}).selectOption('mu');await expect(page.locator('.point-item')).toHaveCount(12);
 await page.keyboard.press('Escape');await expect(page.locator('.ax-panel')).toHaveCount(0);await expect(page.getByRole('button',{name:'경혈 찾기',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/#wiki/points/ST36');await expect(page.locator('article h1')).toHaveText('족삼리 ST36');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goto('/#wiki/not-found');await expect(page.getByRole('heading',{name:'문서를 찾지 못했습니다'})).toBeVisible();
});
test('failed GLB leaves wiki access and retry available',async({page})=>{
 await page.route('**/models/skin.glb',r=>r.abort());await page.goto('/');await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');await expect(page.getByRole('button',{name:'3D 다시 시도'})).toBeVisible();await choosePoint(page,'ST36');await page.locator('.point-summary').click();await page.getByRole('link',{name:'위키에서 더 알아보기'}).click();await expect(page.locator('article h1')).toHaveText('족삼리 ST36');
});
// Every visible text element on a reading page: at least 12px and 4.5:1 on its rendered surface.
const measureText=(root:Element)=>{
 const rgb=(s:string)=>s.match(/[\d.]+/g)?.map(Number)||[255,255,255];
 const luminance=(v:number[])=>v.slice(0,3).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4}).reduce((sum,x,i)=>sum+x*[.2126,.7152,.0722][i],0);
 return [...root.querySelectorAll('p,label,small,strong,button,summary,dt,dd,a,span,h1,h2,h3,li')].filter(el=>{
  const r=el.getBoundingClientRect(),s=getComputedStyle(el);
  return r.width&&r.height&&s.visibility!=='hidden'&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent!.trim());
 }).map(el=>{
  const c=getComputedStyle(el);let bg=[255,255,255],node:Element|null=el;
  while(node){const b=rgb(getComputedStyle(node).backgroundColor);if((b[3]??1)>.99){bg=b;break;}node=node.parentElement;}
  const a=luminance(rgb(c.color)),b=luminance(bg);
  return {text:el.textContent!.trim().slice(0,40),font:parseFloat(c.fontSize),contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
 }).filter(s=>s.font<12||s.contrast<4.5);
};
test('wiki and sources open without 3D or web fonts, read clearly at 390 and 1440, and keep a skip link',async({page})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:width>700?900:844});
  await page.goto('/#wiki');await expect(page.getByRole('heading',{name:'질문으로 문서 찾기'})).toBeVisible();
  await expect(page.locator('.wiki-status')).toContainText(`경혈 문서 ${wiki.filter(d=>d.pointId).length}개`);
  const guide=page.locator('.wiki-sidebar').getByRole('link',{name:'골도분촌과 해부학적 기준점',exact:true});
  if(width<=700){
   // Phones reach the document list through an explicit disclosure, not focus tricks.
   await expect(guide).toBeHidden();await page.locator('.wiki-toc > summary').click();await expect(guide).toBeVisible();
  } else await expect(page.locator('.wiki-toc > summary')).toBeHidden();
  expect(await page.locator('.wiki-layout').evaluate(measureText)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await guide.click();await expect(page.locator('article h1')).toHaveText('골도분촌과 해부학적 기준점');
  if(width<=700){await expect(guide).toBeHidden();await page.getByLabel('위키 문서 검색').fill('음양');await expect(page.locator('.wiki-sidebar').getByRole('link',{name:'경혈의 전통적 용도와 음양오행',exact:true})).toBeVisible();}
  await page.goto('/#wiki/points/CV12');await expect(page.locator('article h1')).toHaveText('중완 CV12');
  await expect(page.locator('.article-meta')).toContainText(wiki.find(d=>d.id==='points/CV12')!.reviewStatus);
  const body=await page.locator('.prose p').first().evaluate(e=>{const s=getComputedStyle(e);return {size:parseFloat(s.fontSize),line:parseFloat(s.lineHeight)/parseFloat(s.fontSize)};});
  expect(body.size).toBeGreaterThanOrEqual(16);expect(body.line).toBeGreaterThanOrEqual(1.7);
  expect(await page.locator('.wiki-layout').evaluate(measureText)).toEqual([]);
  await page.goto('/#sources');await expect(page.locator('.source-cards article')).toHaveCount(sources.length);
  await expect(page.getByRole('link',{name:'원문 열기'})).toHaveCount(sources.length);await expect(page.getByRole('link',{name:'대조한 재현본'})).toHaveCount(sources.filter(s=>s.accessUrl).length);
  // A year cell that only records an access date is shown as the access date; no publication year is invented.
  await expect(page.locator('.source-cards dt',{hasText:'발행·버전'})).toHaveCount(sources.filter(s=>!s.year.startsWith('열람')).length);
  const kmcric=page.locator('.source-cards article').filter({hasText:'표준경혈 DB'});await expect(kmcric.locator('dt')).toHaveText(['열람']);await expect(kmcric.locator('dd')).toHaveText([sources.find(s=>s.id==='kmcric-points')!.year.replace('열람 ','')]);
  expect(await page.locator('.sources-page').evaluate(measureText)).toEqual([]);expect(await page.locator('.site-footer').evaluate(measureText)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
 expect(requests.filter(u=>/fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([]);
 expect(requests.filter(u=>/\.glb|\.bin\.gz|\/Atlas(\.tsx|-[\w-]+\.js)/.test(u))).toEqual([]);
 // The skip control is the first stop and hands focus to the page's main region.
 await page.setViewportSize({width:1440,height:900});await page.goto('about:blank');await page.goto('/#sources');await page.keyboard.press('Tab');
 await expect(page.getByRole('button',{name:'본문으로 건너뛰기'})).toBeFocused();await page.keyboard.press('Enter');await expect(page.locator('main')).toBeFocused();
});
// Touch mode: the same reading checks with the coarse-pointer rules applied, and their controls at least 44px tall.
const shortTargets=(root:Element)=>[...root.querySelectorAll('.search-box,.wiki-toc > summary,.wiki-assistant input,.wiki-assistant form > button,.question-examples button,.wiki-nav,.wiki-download,.point-index a,.doc-list a,.atlas-return,.article-actions a,.backlinks a,.source-links a,.source-footer a')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&r.height<44;}).map(el=>el.textContent!.trim().slice(0,30));
for(const [width,height,isMobile] of [[390,844,true],[1440,900,false]] as const){
 test.describe(`touch reading pages at ${width}`,()=>{
  test.use({viewport:{width,height},hasTouch:true,isMobile});
  test('wiki and sources read clearly and keep 44px touch targets',async({page})=>{
   await page.goto('/#wiki');await expect(page.getByRole('heading',{name:'질문으로 문서 찾기'})).toBeVisible();
   expect(await page.evaluate(()=>matchMedia('(pointer: coarse)').matches)).toBe(true);
   if(width<=700){await page.locator('.wiki-toc > summary').tap();await expect(page.locator('.wiki-sidebar').getByRole('link',{name:'골도분촌과 해부학적 기준점',exact:true})).toBeVisible();}
   for(const route of ['/#wiki','/#wiki/points/CV12']){
    if(route!=='/#wiki'){await page.goto(route);await expect(page.locator('article h1')).toHaveText('중완 CV12');}
    expect(await page.locator('.wiki-layout').evaluate(measureText)).toEqual([]);
    expect(await page.locator('.wiki-layout').evaluate(shortTargets)).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
   await page.goto('/#sources');await expect(page.locator('.source-cards article')).toHaveCount(sources.length);
   expect(await page.locator('.sources-page').evaluate(measureText)).toEqual([]);expect(await page.locator('.site-footer').evaluate(measureText)).toEqual([]);
   expect(await page.locator('.sources-page').evaluate(shortTargets)).toEqual([]);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
 });
}
