// Read-only deployed interaction check. Camera targets prove selected bounds,
// not all rendered vertices or anatomical accuracy (covered separately locally).
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';

const origin=process.env.PAGES_ORIGIN||'http://127.0.0.1:5174/';
const registration=JSON.parse(fs.readFileSync('data/catalog/female-arm-registration.json'));
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
const records=registration.records.filter(r=>/^(Left|Right) (humerus|third metacarpal bone)$/.test(r.name)||/^Distal phalanx of (left|right) thumb$/.test(r.name));
assert.equal(records.length,6);
const expected=records.map(r=>{
  const p=atlas.parts.find(p=>p.id===r.id);
  const bytes=gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[p.chunk].gzip.split('/').pop()}`));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  const rawMin=[...min],rawMax=[...max];
  for(let i=0;i<p.vertexCount;i++){
    const q=[0,1,2].map(j=>bytes.readFloatLE(p.positions+(i*3+j)*4));
    for(let j=0;j<3;j++){
      const v=Math.fround(r.translation[j]+q.reduce((s,x,k)=>s+x*r.linear[k][j],0));
      min[j]=Math.min(min[j],v);max[j]=Math.max(max[j],v);
      rawMin[j]=Math.min(rawMin[j],q[j]);rawMax[j]=Math.max(rawMax[j],q[j]);
    }
  }
  const target=min.map((v,j)=>(v+max[j])/2),rawTarget=rawMin.map((v,j)=>(v+rawMax[j])/2);
  assert.ok(Math.hypot(...target.map((v,j)=>v-rawTarget[j]))>.005,'Probe must distinguish the original pose');
  return {id:r.id,name:r.name,target,rawTarget};
});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],failures=[],checks=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  const ready=()=>page.getByText('해부 모델 로드 완료').waitFor({timeout:120000});
  const view=()=>page.evaluate(()=>JSON.parse(sessionStorage.getItem('gyeol-view-v2')));
  await page.goto(origin);await ready();
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();await ready();
  for(const row of expected){
    if(!await page.getByLabel('해부 구조 검색').isVisible())await page.getByRole('button',{name:'구조 찾기',exact:true}).click();
    await page.getByLabel('해부 구조 검색').fill(row.id);
    await page.locator('.structure-item').filter({hasText:row.id}).click();await ready();
    await page.getByRole('button',{name:'선택 구조 확대',exact:true}).click();
    await page.waitForFunction(target=>{
      const s=JSON.parse(sessionStorage.getItem('gyeol-view-v2'));
      return s?.camera&&Math.hypot(...target.map((v,j)=>v-s.camera.target[j]))<.001;
    },row.target);
    const actual=await view();assert.equal(actual.sex,'female');assert.equal(actual.layers.bone,true);
    checks.push({...row,actualTarget:actual.camera.target,errorMetres:Math.hypot(...row.target.map((v,j)=>v-actual.camera.target[j]))});
  }
  await page.getByRole('button',{name:'골격 빠른 보기',exact:true}).click();await ready();
  await page.getByLabel('전신 부위 선택').selectOption({label:'전신'});await ready();
  await page.getByRole('button',{name:'계통 전체 보기',exact:true}).click();
  await page.screenshot({path:'docs/anatomy-alignment/pages-female-arms-registered.png'});
  assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
  const report={origin,checkedAt:new Date().toISOString(),registrationVersion:registration.version,
    registrationSha256:createHash('sha256').update(fs.readFileSync('data/catalog/female-arm-registration.json')).digest('hex'),
    method:'Six real search/select/frame operations including refined thumb tips; camera target versus independent transformed bounding centre. Not a complete deployed vertex audit.',checks,errors,failures};
  fs.writeFileSync('docs/anatomy-alignment/pages-female-arm-verification.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await browser.close();}
