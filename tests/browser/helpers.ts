import {expect,type Page} from '@playwright/test';
export async function ready(page:Page){await expect(page.getByText('해부 모델 로드 완료')).toBeVisible({timeout:60000});}
export async function openTool(page:Page,name:string){if(!await page.locator('.floating-dock').filter({has:page.getByText(name,{exact:true})}).isVisible())await page.getByRole('button',{name,exact:true}).click();}
export async function choosePoint(page:Page,id:string){await openTool(page,'경혈 찾기');await page.getByLabel('경혈 검색').fill(id);await page.locator('.point-item').filter({hasText:id.replace(/\s/g,'')}).first().click();}
export async function compare(page:Page){await page.locator('.point-summary').click();await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();await ready(page);}
export async function snapshot(page:Page){return page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')||'null'));}
export async function closeTool(page:Page){await page.getByRole('button',{name:'도구 패널 닫기',exact:true}).click();}
