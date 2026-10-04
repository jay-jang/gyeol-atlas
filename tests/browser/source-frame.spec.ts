import {test, expect} from '@playwright/test';
import {ready, snapshot, openTool, closeTool,organs,settledCamera} from './helpers';
import femaleStructures from '../../data/female-atlas-structures.json' with {type:'json'};
import femaleTransport from '../../data/female-transport-structures.json' with {type:'json'};
// The female overview counts its HRA structures and the structures carried from the male sources.
const transportLayer:Record<string,string>={nerve:'nerve',vessel:'vessel',muscle:'muscle',ligament:'bone',tendon:'muscle',lymph:'lymph',bone:'bone'};

test('leaving an independent detail frame for peeling fits the loaded overview and preserves later layer views', async ({page}) => {
  test.setTimeout(120000);
  let fiberUrl='';
  page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url())) fiberUrl=r.url();});
  await page.goto('/'); await ready(page);
  for (const [sex, organ] of [['남성','심장'],['여성','위 (여성 CT)']]) {
    await page.locator('.ax-top').getByRole('button',{name:sex,exact:true}).click(); await ready(page);
    for (const exit of ['peeling','stage','surface']) {
    await (await organs(page)).filter({has:page.getByText(organ,{exact:true})}).click(); await ready(page);
    if (exit === 'peeling') await page.getByLabel('연속 해부 박리 깊이').fill('0');
    else if (exit === 'stage') await page.getByRole('button',{name:'체표 빠른 보기',exact:true}).click();
    else {
      await openTool(page,'레이어 조절');
      await page.getByLabel('클릭 선택 대상').selectOption('skin');
      await closeTool(page);
    }
    await ready(page);
    expect((await snapshot(page)).detail).toBe(null);
    // Inspect actual loaded overview meshes through the camera, not only IDs.
    await expect.poll(()=>page.evaluate(async url=>{
      const module=await import(/* @vite-ignore */ url);
      const canvas=document.querySelector('canvas')!;
      const {scene,camera}=module._roots.get(canvas).store.getState();
      const ids=new Set(canvas.dataset.visibleStructureIds!.split(','));
      scene.updateMatrixWorld(true);
      let extent=0, count=0;
      scene.traverse((mesh:any)=>{
        if(!mesh.isMesh || !mesh.visible || !ids.has(mesh.name)) return;
        mesh.geometry.computeBoundingBox();
        const {min,max}=mesh.geometry.boundingBox;
        for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
          const p=camera.position.clone().set(x?max.x:min.x,y?max.y:min.y,z?max.z:min.z).applyMatrix4(mesh.matrixWorld).project(camera);
          extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y)); count++;
        }
      });
      return count ? extent : Infinity;
    },fiberUrl)).toBeLessThan(1);
    // The fit's pose is saved at once and again after the controls' debounce.
    await settledCamera(page);
    const pose=(await snapshot(page)).camera;
    await page.getByLabel('연속 해부 박리 깊이').fill('0.5'); await ready(page);
    expect((await snapshot(page)).camera).toEqual(pose);
    }
    await page.screenshot({path:`docs/anatomy-alignment/${sex === '남성' ? 'male' : 'female'}-detail-to-overview.png`});
  }
});

test('female help and layer descriptions use the female overview inventory', async ({page}) => {
  await page.goto('/'); await ready(page);
  await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click(); await ready(page);
  await expect(page.locator('.scope-source')).toContainText('남성 원본 정합 보완 1,774개');
  for (const [label,layer] of [['근육','muscle'],['골격','bone'],['신경','nerve']]) {
    await page.getByRole('button',{name:`${label} 빠른 보기`,exact:true}).click(); await ready(page);
    const count=femaleStructures.filter(s=>s.layer===layer).length+femaleTransport.filter(r=>transportLayer[r.system]===layer).length;
    await openTool(page,'레이어 조절');
    await expect(page.locator('.anatomy-scope-controls')).toContainText('별도 Visible Human Female 하체 근육은 검색할 때만 보입니다');
    await expect(page.locator('.anatomy-scope-controls')).not.toContainText('다른 여성 기증자');
    await expect(page.locator('.coverage-description')).toContainText(`여성 전신 참조의 ${label} 모형 ${count}개`);
    if(layer==='muscle')await expect(page.locator('.coverage-description')).toContainText('BodyParts3D 남성 근육을 옮긴 보완');
    if(layer==='bone'){
      await expect(page.locator('.coverage-description')).toContainText('같은 정합장으로 다시 놓았습니다');
      await expect(page.locator('.coverage-description')).toContainText('여성 고유 골격으로 해석하지 마세요');
    }
    await closeTool(page); await openTool(page,'도움말');
    await expect(page.locator('.viewer-help')).toContainText(`여성 전신 참조의 ${label} 모형 ${count}개`);
    await expect(page.locator('.viewer-help')).not.toContainText('다른 여성 기증자');
    await closeTool(page);
  }
  await page.setViewportSize({width:390,height:844});
  await openTool(page,'레이어 조절');
  await expect(page.locator('.coverage-description')).toContainText('말초신경·뇌신경은 남성 원본을 옮긴 보완');
  await page.locator('.coverage-description').scrollIntoViewIfNeeded();
  await expect(page.locator('.coverage-description')).toBeInViewport();
  await page.screenshot({path:'docs/anatomy-alignment/female-coverage-mobile.png'});
  const donorHint=page.locator('.anatomy-scope-controls .control-hint').filter({hasText:'Visible Human Female'});
  await donorHint.scrollIntoViewIfNeeded();await expect(donorHint).toBeInViewport();
  await page.screenshot({path:'docs/anatomy-alignment/female-donor-help-mobile.png'});
});
