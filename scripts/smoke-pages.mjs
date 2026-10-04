import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import { inflateSync } from 'node:zlib';
const origin = process.env.PAGES_ORIGIN || 'http://127.0.0.1:4184/gyeol-atlas/';
// Count bright (R>90) pixels of an 8-bit RGBA PNG screenshot.
const litPixels=png=>{let off=8,w,h;const idat=[];while(off<png.length){const len=png.readUInt32BE(off),type=png.toString('ascii',off+4,off+8),data=png.subarray(off+8,off+8+len);if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);}if(type==='IDAT')idat.push(data);off+=12+len;}
 const raw=inflateSync(Buffer.concat(idat)),stride=w*4,out=Buffer.alloc(h*stride);let lit=0;
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));for(let x=0;x<stride;x++){const a=x>=4?out[y*stride+x-4]:0,b=y?out[(y-1)*stride+x]:0,c=x>=4&&y?out[(y-1)*stride+x-4]:0;let v=line[x];if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?b:c;}out[y*stride+x]=v&255;}}
 for(let i=0;i<out.length;i+=4)if(out[i]>90)lit++;return lit;};
const browser = await chromium.launch({headless:true,args:process.env.PLAYWRIGHT_GPU==='1'?['--no-sandbox','--use-gl=angle','--use-angle=metal','--ignore-gpu-blocklist']:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 const requests=[],errors=[],failures=[];
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400) failures.push(`${r.status()} ${r.url()}`)});
 await page.goto(origin+'#wiki');
 await page.getByRole('heading',{name:'위키에 물어보기'}).waitFor();
 assert.equal(requests.filter(u=>u.endsWith('.glb')||u.endsWith('.bin.gz')||/\/assets\/Atlas-/.test(u)).length,0);
 await page.getByLabel('위키 질문').fill('내관과 외관');await page.getByRole('button',{name:'질문 보내기'}).click();
 await page.locator('.answer').waitFor();assert.match(await page.locator('.answer').innerText(),/PC6/);assert.match(await page.locator('.answer').innerText(),/TE5/);
 assert.equal(requests.filter(u=>u.includes('/api/')).length,0);
 await page.goto(origin+'#wiki/points/EX-UE11');
 await page.locator('article h1').waitFor();
 const download=await page.getByRole('link',{name:'Markdown'}).getAttribute('href');assert.ok(download.startsWith('/gyeol-atlas/wiki/'));
 assert.equal((await page.request.get(new URL(download,origin).href)).status(),200);
 await page.getByRole('link',{name:'3D 경혈 지도',exact:true}).click();await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
 assert.ok(requests.some(u=>u.includes('/gyeol-atlas/models/skin.glb')));
 await page.getByRole('button',{name:'경혈 찾기',exact:true}).click();assert.equal(await page.locator('.point-item').count(),409);
 await page.getByLabel('모델 부위 선택').selectOption('발목·발');await page.getByRole('button',{name:/필터 결과 .*모델에서 보기/}).click();
 await page.screenshot({path:'docs/acupoint-expansion/pages-desktop.png'});
 await (await (async()=>{const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('');return page.locator('.featured-anatomy > button');})()).filter({has:page.getByText('심장',{exact:true})}).click();
 await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.visibleStructureIds?.split(',').length===83);
 assert.ok(requests.some(u=>u.includes('/gyeol-atlas/models/male-detail/organs.bin.gz')));
 await page.locator('.ax-top').getByRole('button',{name:'여성',exact:true}).click();
 await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.femaleAtlasParts==='1220');
await page.waitForFunction(n=>document.querySelector('canvas')?.dataset.femaleTransportParts===String(n),JSON.parse(readFileSync('data/female-transport-structures.json','utf8')).length);
 assert.equal(new Set(requests.filter(u=>/\/female\/.*\.bin\.gz$/.test(u))).size,15);
 await (await (async()=>{const input=page.getByLabel('경혈·구조 검색');await input.click();await input.fill('');return page.locator('.featured-anatomy > button');})()).filter({has:page.getByText('뇌',{exact:true})}).click();
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.visibleStructureIds?.split(',').length===283);
 await page.screenshot({path:'docs/anatomy-alignment/pages-female-brain.png'});
 await page.locator('.ax-top').getByRole('button',{name:'남성',exact:true}).click();
 await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'경혈 찾기',exact:true}).click();
 const box=await page.locator('.ax-panel').boundingBox(),canvas=await page.locator('canvas').boundingBox();assert.ok(box.height<canvas.height*.45);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 // A resize clears the WebGL buffer; wait for a redrawn frame before the evidence shot.
 await page.waitForTimeout(1000);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:'docs/acupoint-expansion/pages-mobile.png'});
 // The body must stay drawn above the open list panel after the resize (a blank
 // canvas was once observed here on software WebGL).
 const bodyPixels=litPixels(await page.screenshot({clip:{x:60,y:250,width:270,height:150}}));
 assert.ok(bodyPixels>500,`scene above the open phone panel is blank (${bodyPixels} lit pixels)`);
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
 const result={origin,checkedAt:new Date().toISOString(),points:409,staticSearch:true,initialWikiModelRequests:0,femaleParts:1220,femaleTransportParts:JSON.parse(readFileSync('data/female-transport-structures.json','utf8')).length,femaleBrainParts:283,maleHeartParts:83,errors,failures};
 await fs.writeFile('docs/acupoint-expansion/pages-verification.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally {await browser.close();}
