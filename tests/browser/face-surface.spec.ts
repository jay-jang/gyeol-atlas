import {test,expect,type Page} from '@playwright/test';
import {ready,snapshot} from './helpers';

// At 0% the face is one skin: the auricle, lips and eye surface take the skin
// (and eye-white) look, and Z-Anatomy's own eyeball parts stay hidden behind
// the BodyParts3D eyeball. Peeled or selected, they show their own colours.
const fiber=(page:Page)=>{let url='';page.on('request',r=>{if(/\/@react-three_fiber\.js\?/.test(r.url()))url=r.url();});return ()=>url;};
const colours=(page:Page,url:string,ids:string[])=>page.evaluate(async({url,ids})=>{
  const {_roots}=await import(/* @vite-ignore */url),st=_roots.get(document.querySelector('canvas')!).store.getState();
  return Object.fromEntries(ids.map(id=>{const m=st.scene.getObjectByName(id);return [id,m?'#'+m.material.color.getHexString():null];}));
},{url,ids});
const visible=async(page:Page)=>new Set(((await page.locator('canvas').getAttribute('data-visible-structure-ids'))||'').split(','));
const face=['FMA52780','FMA59815nsn','FMA12513','FMA46782','FMA46783','FMA71704'];
const eyeParts=['ZA_nerve_cornea_l','ZA_nerve_sclera_r','ZA_nerve_iris_l','ZA_nerve_lens_r'];

test('the face reads as skin at 0% and shows its own systems once peeled',async({page})=>{
  test.setTimeout(180000);
  const url=fiber(page),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width:1440,height:900});
  await page.goto('/');await ready(page);
  let c=await colours(page,url(),face);
  expect(c).toEqual({FMA52780:'#b9826f',FMA59815nsn:'#b9826f',FMA12513:'#e2dbcf',FMA46782:'#b9826f',FMA46783:'#b9826f',FMA71704:'#b9826f'});
  let ids=await visible(page);
  for(const id of eyeParts)expect(ids.has(id),id).toBe(false);
  // The user's three-quarter view of the face.
  await page.evaluate(()=>{const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!);s.camera={target:[0,1.56,.03],position:[.32,1.66,.62]};s.markers='hidden';sessionStorage.setItem('gyeol-view-v2',JSON.stringify(s));});
  await page.reload();await ready(page);
  await page.screenshot({path:'docs/anatomy-alignment/face-surface-desktop.png'});
  // Skin peeled: the ear is an organ again and the muscles are muscle-red.
  await page.getByLabel('연속 해부 박리 깊이').fill('30');await ready(page);
  c=await colours(page,url(),face);
  expect(c.FMA52780).toBe('#a94d60');expect(c.FMA46782).toBe('#b43f3f');expect(c.FMA12513).toBe('#a94d60');
  ids=await visible(page);
  for(const id of eyeParts)expect(ids.has(id),id).toBe(false);
  // Organs peeled: Z-Anatomy's eye shows the eye.
  await page.getByLabel('연속 해부 박리 깊이').fill('90');await ready(page);
  await expect.poll(async()=>{const now=await visible(page);return eyeParts.every(id=>now.has(id));}).toBe(true);
  // A selected ear is the selection colour, even with the skin drawn.
  await page.getByLabel('연속 해부 박리 깊이').fill('0');await ready(page);
  const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('FMA52780');
  await page.locator('.structure-item').filter({hasText:'FMA52780'}).first().click();await ready(page);
  expect((await snapshot(page)).selection.ids).toEqual(['FMA52780']);
  c=await colours(page,url(),['FMA52780']);
  expect(c.FMA52780).toBe('#238b91');
  expect(errors).toEqual([]);
});
