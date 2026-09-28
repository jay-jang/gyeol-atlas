import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';

const url='https://lifesciencedb.jp/bp3d/get-info.cgi?version=4.0&cmd=concept-objfiles-list';
const file='.cache/bp4-official/v40-FMA2Obj.zip';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
let zipped;
try {zipped=await fs.readFile(file);}catch(error){
  if(error.code!=='ENOENT')throw error;
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.status,200,`Official 4.0 relation HTTP ${response.status}`);
  zipped=Buffer.from(await response.arrayBuffer());
  await fs.mkdir('.cache/bp4-official',{recursive:true});
  await fs.writeFile(file,zipped,{flag:'wx'});
}
const text=execFileSync('unzip',['-p',file,'FMA2Obj.txt'],{encoding:'utf8',maxBuffer:4*1024*1024});
assert.match(text,/^# Data Version\s+4\.0\s*$/m);
assert.match(text,/^# Objects set\s+4\.0\s*$/m);
const concepts=['FMA7203','FMA9704','FMA14751','FMA70494','FMA70485','FMA70488','FMA14334'];
const source=JSON.parse(await fs.readFile('.cache/male-details/atlas.json'));
const rows=concepts.map(id=>{
  const official=text.split(/\r?\n/).filter(line=>line.startsWith(`${id}\t`)).map(line=>{
    const [concept,relation,members]=line.split('\t');
    return {concept,relation,members:members.split('+')};
  });
  const upstream=source.concepts.find(row=>row.id===id);
  assert.ok(upstream,`Missing pinned source ${id}`);
  assert.equal(official.length,1,`Unexpected official relation count ${id}`);
  assert.equal(official[0].relation,'is_a',`Unexpected official relation kind ${id}`);
  assert.deepEqual([...official[0].members].sort(),[...upstream.elements].sort(),`Source membership differs from official 4.0 ${id}`);
  return {id,sourceName:upstream.name,sourceMembers:upstream.elements,official};
});
const report={url,version:'4.0',zipSha256:sha(zipped),zipBytes:zipped.length,listingSha256:sha(Buffer.from(text)),
  note:'Official version-stamped concept/OBJ membership compared with pinned Human-Atlas concept map. This does not verify geometry, cross-part continuity, or registration to overview.',rows};
await fs.writeFile('docs/anatomy-alignment/male-kidney-official-v40.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(row=>({id:row.id,source:row.sourceMembers.length,official:row.official.map(item=>[item.relation,item.members.length])}))));
