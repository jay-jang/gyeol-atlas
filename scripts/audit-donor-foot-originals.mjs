// Inspect only the two downloaded Original Phalanges aggregate files.
// No segmentation, automatic anatomical component naming or runtime export.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {BufferGeometry,BufferAttribute} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {asciiStlSummary} from './audit-donor-original.mjs';
import {exactPositionComponents} from './lib/exact-position-components.mjs';
const [archive,root]=process.argv.slice(2);assert.ok(root);
const hash=b=>createHash('sha256').update(b).digest('hex');
const receipt=JSON.parse(fs.readFileSync('docs/anatomy-alignment/donor-original-receipt.json'));
const expected=receipt.archives.find(a=>a.file==='Original 3D STL Models-stl.zip');
assert.equal(hash(fs.readFileSync(archive)),expected.sha256);
const rows=[];
for(const side of ['Left','Right']){
  const entry=`Original 3D STL Models-stl/${side}/VHF_${side}_Bone_Phalanges.stl`;assert.ok(expected.entries.includes(entry));
  const bytes=fs.readFileSync(path.join(root,entry));
  // Confirm these extracted bytes actually belong to the hashed user archive.
  const inArchive=execFileSync('unzip',['-p',archive,entry],{maxBuffer:100*1024*1024});assert.equal(hash(bytes),hash(inArchive));
  const text=bytes.toString('utf8'),summary=await asciiStlSummary(text.split(/\r?\n/));
  const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  const float=exactPositionComponents(raw);assert.equal(summary.triangles,float.geometry.index.count/3);
  const points=[];for(const m of text.matchAll(/^\s*vertex\s+([^\r\n]+)/gm))points.push(...m[1].trim().split(/\s+/).map(Number));
  assert.equal(points.length,summary.triangles*9);
  // Ensure Float32 reader quantization did not create the observed connectivity.
  const doubles=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float64Array(points),3));
  const full=exactPositionComponents(doubles);
  const counts=c=>c.map(p=>({vertices:p.vertices,triangles:p.triangles}));assert.deepEqual(counts(float.components),counts(full.components));
  rows.push({side:side.toLowerCase(),entry,bytes:bytes.length,sha256:hash(bytes),ascii:summary,
    components:full.components,float32ComponentCountsAgree:true,vertices:full.geometry.attributes.position.count});
  raw.dispose();float.geometry.dispose();doubles.dispose();full.geometry.dispose();
}
const report={createdAt:new Date().toISOString(),status:'Original aggregate connectivity inspected; no separately named toe-bone segmentation supplied',
  archive:{file:expected.file,sha256:expected.sha256},parts:rows,
  limitations:['Only two Original STL files were inspected here; the remaining source meshes retain their prior verification scope.',
    'Connectivity is not a clinical or anatomical identity claim. Tiny components are not automatically individual bones.',
    'Both readers use the same component algorithm; ASCII grammar and Float32/Float64 parsing are separate checks.'],
  files:['scripts/audit-donor-foot-originals.mjs','scripts/lib/exact-position-components.mjs','scripts/audit-donor-original.mjs','docs/anatomy-alignment/donor-original-receipt.json'].map(file=>({file,sha256:hash(fs.readFileSync(file))}))};
fs.mkdirSync('.cache/donor-feet',{recursive:true});fs.writeFileSync('.cache/donor-feet/originals.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,parts:rows.map(p=>({...p,components:p.components.map(c=>({vertices:c.vertices,triangles:c.triangles}))}))},null,2));
