import {expect,type Page} from '@playwright/test';
// Every system is preloaded, so a peel change commits without new loading;
// scene attributes are published one animation frame after the state change.
export async function ready(page:Page){
  for(let attempt=0;;attempt++){
    await expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:90000});
    try{await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));return;}
    // A navigation the test just started can replace the page mid-wait.
    catch(error){if(attempt>1||!/Execution context was destroyed/.test(String(error)))throw error;await page.waitForLoadState();}
  }
}
// Tool names from the earlier layout map onto the redesigned controls.
const PANELS:Record<string,{button:string;region:string}>={
  '경혈 찾기':{button:'경혈 찾기',region:'경혈 목록'},
  '레이어 조절':{button:'표시 설정',region:'표시 설정'},
  '표시 설정':{button:'표시 설정',region:'표시 설정'},
  '도움말':{button:'도움말',region:'도움말'},
};
export async function openSearch(page:Page){
  const input=page.getByLabel('경혈·구조 검색');
  if(!await page.getByRole('region',{name:'검색 결과',exact:true}).isVisible())await input.click();
  await expect(page.getByRole('region',{name:'검색 결과',exact:true})).toBeVisible();
  return input;
}
export async function openTool(page:Page,name:string){
  if(name==='구조 찾기'){await openSearch(page);return;}
  const tool=PANELS[name];
  if(!tool){await page.getByRole('button',{name,exact:true}).click();return;}
  if(!await page.getByRole('region',{name:tool.region,exact:true}).isVisible())await page.getByRole('button',{name:tool.button,exact:true}).click();
}
// Organ details are listed in the search panel when the query is empty.
export async function organs(page:Page){
  const input=await openSearch(page);
  if(await input.inputValue())await input.fill('');
  return page.locator('.featured-anatomy > button');
}
export async function choosePoint(page:Page,id:string){await openTool(page,'경혈 찾기');await page.getByLabel('경혈 검색').fill(id);await page.locator('.point-item').filter({hasText:id.replace(/\s/g,'')}).first().click();}
export async function compare(page:Page){if(await page.locator('.point-summary').getAttribute('aria-expanded')!=='true')await page.locator('.point-summary').click();await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await ready(page);}
export async function snapshot(page:Page){return page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null'));}
// A pick closes the search results, so an already-closed panel is fine.
export async function closeTool(page:Page){const close=page.getByRole('button',{name:'도구 패널 닫기',exact:true});if(await close.count())await close.first().click();}
// A resize can re-frame a selection; the new pose is saved after a short debounce.
export async function settledCamera(page:Page){
  let last='';
  await expect.poll(async()=>{const now=JSON.stringify((await snapshot(page))?.camera);const same=now===last;last=now;return same;},{intervals:[400,400,400,400,800]}).toBe(true);
}
// Screen positions of the acupoint markers currently drawn (facing the camera).
// A click meant for tissue must stay clear of their larger pointer targets.
export const markerScreenPoints=(page:Page,url:string)=>page.evaluate(async url=>{
  const {_roots}=await import(/* @vite-ignore */url),canvas=document.querySelector('canvas')!,s=_roots.get(canvas).store.getState(),rect=canvas.getBoundingClientRect();
  let mesh:any;s.scene.traverse((o:any)=>{if(o.isInstancedMesh&&o.userData.acupointMarkers)mesh=o;});
  const points:{x:number;y:number}[]=[];if(!mesh)return points;
  const matrix=s.camera.matrixWorld.clone(),v=s.camera.position.clone();
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);if(!matrix.elements[0])continue;v.setFromMatrixPosition(matrix).project(s.camera);points.push({x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2});}
  return points;
},url);
