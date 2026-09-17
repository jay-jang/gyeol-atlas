import {test,expect} from '@playwright/test';
import {PerspectiveCamera,Vector3} from 'three';
import anchors from '../../data/anchors.json' with {type:'json'};
import {ready,openTool,choosePoint,closeTool,snapshot} from './helpers';
test('model-first scene, actual marker click, search, bookmarks and source-linked wiki',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await ready(page);
 await expect(page.getByRole('button',{name:/경혈 선택/})).toBeVisible();await expect(page.locator('.point-label')).toHaveCount(0);
 const box=await page.locator('canvas').boundingBox();expect(box!.y).toBeLessThan(100);expect(box!.height).toBeGreaterThan(700);
 await openTool(page,'레이어 조절');await page.getByLabel('경혈 표식',{exact:true}).selectOption('filtered');await closeTool(page);
 const pose=(await snapshot(page)).camera;const camera=new PerspectiveCamera(39,box!.width/box!.height,.01,20);camera.position.fromArray(pose.position);camera.lookAt(new Vector3(...pose.target));camera.updateMatrixWorld();const point=anchors.find(a=>a.pointId==='CV17')!;const projected=new Vector3(...point.position as [number,number,number]).project(camera);
 await page.locator('canvas').click({position:{x:(projected.x+1)*box!.width/2,y:(1-projected.y)*box!.height/2}});await expect(page.locator('.point-summary')).toContainText('단중');
 await choosePoint(page,'LI 4');await expect(page.locator('.point-summary')).toContainText('합곡');await page.locator('.point-summary').click();await page.getByRole('button',{name:'북마크 저장',exact:true}).click();await page.reload();await ready(page);await page.locator('.point-summary').click();await expect(page.getByRole('button',{name:'북마크 해제',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'위키에서 더 알아보기'}).click();await expect(page.locator('article h1')).toHaveText('합곡 LI4');await expect(page.locator('.backlinks a').first()).toBeVisible();
 await page.getByRole('link',{name:'지식 위키',exact:true}).first().click();await page.getByLabel('위키 질문').fill('내관과 외관');await page.getByRole('button',{name:'질문 보내기'}).click();await expect(page.locator('.answer')).toContainText('PC6');await expect(page.locator('.answer')).toContainText('TE5');
 await page.getByRole('link',{name:'출처와 자료'}).click();await expect(page.locator('.source-cards article')).toHaveCount(12);expect(errors).toEqual([]);
});
test('mobile canvas and overlay coexist, filtered lists, keyboard dismissal and deep links',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await ready(page);const canvas=await page.locator('canvas').boundingBox();expect(canvas!.y).toBeLessThan(100);expect(canvas!.y+canvas!.height).toBeLessThanOrEqual(844);
 await openTool(page,'경혈 찾기');const dock=await page.locator('.floating-dock').boundingBox();expect(dock!.height).toBeLessThan(canvas!.height*.45);expect(dock!.y-canvas!.y).toBeGreaterThan(350);await page.getByLabel('경혈 검색').fill('없는경혈');await expect(page.getByText('일치하는 경혈이 없습니다')).toBeVisible();await page.getByRole('button',{name:'전체 경혈 보기'}).click();await expect(page.locator('.point-item')).toHaveCount(409);await page.getByLabel('경혈 분류',{exact:true}).selectOption('yuan');await expect(page.locator('.point-item')).toHaveCount(12);await expect(page.locator('.classification-text').first()).toContainText('원혈');await page.getByLabel('경혈 분류',{exact:true}).selectOption('mu');await expect(page.locator('.point-item')).toHaveCount(12);
 await page.keyboard.press('Escape');await expect(page.locator('.floating-dock')).toHaveCount(0);await expect(page.getByRole('button',{name:'경혈 찾기',exact:true})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.goto('/#wiki/points/ST36');await expect(page.locator('article h1')).toHaveText('족삼리 ST36');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goto('/#wiki/not-found');await expect(page.getByRole('heading',{name:'문서를 찾지 못했습니다'})).toBeVisible();
});
test('failed GLB leaves wiki access and retry available',async({page})=>{
 await page.route('**/models/skin.glb',r=>r.abort());await page.goto('/');await expect(page.getByRole('alert')).toContainText('3D 모델을 열지 못했습니다');await expect(page.getByRole('button',{name:'3D 다시 시도'})).toBeVisible();await choosePoint(page,'ST36');await page.locator('.point-summary').click();await page.getByRole('link',{name:'위키에서 더 알아보기'}).click();await expect(page.locator('article h1')).toHaveText('족삼리 ST36');
});
