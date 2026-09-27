import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const file='.cache/cord-shear/visual-input.json',report=JSON.parse(fs.readFileSync(file));
const browser=await chromium.launch({headless:true});const images=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1260,height:740}});page.on('pageerror',e=>errors.push(e.message));
  for(const r of report.records){assert.equal(hash(r.svg),r.svgSha256);await page.setContent(fs.readFileSync(r.svg,'utf8'));
    const image=`docs/anatomy-alignment/cord-shear-${r.pair}.png`;await page.screenshot({path:image});images.push({file:image,sha256:hash(image)});
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
report.files.push(...[file,'scripts/capture-cord-shear.mjs'].map(file=>({file,sha256:hash(file)})));
fs.writeFileSync('docs/anatomy-alignment/cord-shear-visual.json',JSON.stringify({...report,images,errors},null,2)+'\n');
