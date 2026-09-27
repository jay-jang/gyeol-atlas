import fs from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const sectionFile='docs/anatomy-alignment/neural-component-sections.json',sections=JSON.parse(fs.readFileSync(sectionFile));
const browser=await chromium.launch({headless:true});const images=[],errors=[];
try{
  const page=await browser.newPage({viewport:{width:1100,height:800}});page.on('pageerror',e=>errors.push(e.message));
  for(const row of sections.records){
    assert.equal(hash(row.svg),row.svgSha256);await page.setContent(fs.readFileSync(row.svg,'utf8'));
    const file=`docs/anatomy-alignment/neural-section-${row.pair}.png`;
    await page.screenshot({path:file});images.push({pair:row.pair,file,sha256:hash(file)});
  }
  assert.deepEqual(errors,[]);
}finally{await browser.close();}
const report={scope:'Seven SVG-based geometric diagnostics, not application screenshots or medical images',viewport:{width:1100,height:800},images,errors,
  files:[sectionFile,'scripts/capture-neural-component-source.mjs','scripts/section-neural-component-source.py','scripts/lib/mesh_plane_sections.py'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync('docs/anatomy-alignment/neural-component-visual.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({images:images.length,errors}));
