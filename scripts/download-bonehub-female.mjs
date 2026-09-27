// Pinned CC BY 4.0 source receipt only. Never writes public/runtime assets.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const repository='BoneHub/visible-human-3d-models',revision='ac8de2b38f5ae1a0996053ca0639dd6ae43358f1';
const out=`.cache/bonehub/${revision}`;fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const api=`https://huggingface.co/api/datasets/${repository}`,resolve=`https://huggingface.co/datasets/${repository}/resolve/${revision}/`;
async function response(url){const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw new Error(`${r.status}: ${url}`);return r;}
async function list(folder){
  const r=await response(`${api}/tree/${revision}/${folder}?recursive=true&limit=1000`);assert.equal(r.headers.get('link'),null,'Handle pagination explicitly before accepting an incomplete source list');
  return await r.json();
}
const [meshTree,segTree]=await Promise.all(['Mesh','Segmentation'].map(kind=>list(`visible_human_3d_models/CT/${kind}/02_Female`)));
const meshes=meshTree.filter(f=>f.type==='file'&&f.path.endsWith('.stl')),segmentations=segTree.filter(f=>f.type==='file'&&f.path.endsWith('.seg.nrrd'));
assert.equal(meshes.length,143);assert.equal(segmentations.length,11);
const receipt={createdAt:new Date().toISOString(),repository:`https://huggingface.co/datasets/${repository}`,revision,license:'CC-BY-4.0',doi:'10.57967/HF/10464',
  status:'SOURCE DOWNLOADED AND HASH CHECKED; no atlas registration or runtime replacement',files:[],sourceTrees:{mesh:meshTree,segmentation:segTree},
  limitations:['Dataset card describes model-assisted human-verified segmentation, not independently reproduced clinical validation.',
    'Source elbow is truncated; digits, cranium/maxilla, sternum, and sacrum/coccyx include compound labels.',
    'No muscles, nerves, vessels or costal cartilage supplied by this bone-only dataset.',
    'Shared Visible Human Female CT provenance does not establish HRA coordinate compatibility.']};
const documents=['README.md','visible_human_3d_models/CT/Mesh/README.md','visible_human_3d_models/CT/metadata.json'];
async function download(f){
  assert.ok(!f.path.includes('..')&&!path.isAbsolute(f.path));
  const local=path.join(out,f.path);let bytes;
  if(fs.existsSync(local))bytes=fs.readFileSync(local);
  else{bytes=Buffer.from(await(await response(resolve+f.path)).arrayBuffer());}
  const hash=sha(bytes);if(f.lfs){assert.equal(hash,f.lfs.oid,f.path);assert.equal(bytes.length,f.size);}
  else if(f.oid){const gitHash=createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');assert.equal(gitHash,f.oid,f.path);}
  else assert.ok(documents.includes(f.path),'Expected source hash for every mesh/mask');
  fs.mkdirSync(path.dirname(local),{recursive:true});if(!fs.existsSync(local))fs.writeFileSync(local,bytes);
  receipt.files.push({path:f.path,local,bytes:bytes.length,sha256:hash,publishedLfsSha256:f.lfs?.oid??null});
}
for(const file of documents)await download({path:file});
const readme=fs.readFileSync(path.join(out,'README.md'),'utf8');assert.match(readme,/license: cc-by-4\.0/);
const metadata=JSON.parse(fs.readFileSync(path.join(out,documents[2])));assert.equal(metadata['02_Female'].gender,'female');receipt.subject=metadata['02_Female'];
const queue=[...meshes,...segmentations];let finished=0;
await Promise.all(Array.from({length:3},async()=>{while(queue.length){const next=queue.shift();await download(next);finished++;if(finished%10===0)console.log(JSON.stringify({downloaded:finished,total:meshes.length+segmentations.length}));}}));
receipt.files.sort((a,b)=>a.path.localeCompare(b.path));receipt.downloadBytes=receipt.files.reduce((n,f)=>n+f.bytes,0);
receipt.scriptSha256=sha(fs.readFileSync(new URL(import.meta.url)));
fs.writeFileSync(`${out}/receipt.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({files:receipt.files.length,downloadBytes:receipt.downloadBytes,revision,subject:receipt.subject}));
