// Independent scalar transform readback of cached positions and complete index
// arrays. Does not repeat fitting or claim independent surface classification.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const out='.cache/donor-foot-pose',sha=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(f));
const pose=read(`${out}/report.json`),input=read('.cache/donor-feet/visual-parts.json'),parts=read(`${out}/parts.json`);
for(const f of pose.files)assert.equal(sha(f.file),f.sha256,f.file);
const checks=[];
function verifyMatrix(m){
  assert.equal(m.length,16);assert.ok(m.every(Number.isFinite));assert.deepEqual([m[3],m[7],m[11],m[15]],[0,0,0,1]);
  for(let a=0;a<3;a++)for(let b=0;b<3;b++)assert.ok(Math.abs([0,1,2].reduce((n,k)=>n+m[a*4+k]*m[b*4+k],0)-(a===b?1:0))<1e-12);
  const determinant=m[0]*(m[5]*m[10]-m[9]*m[6])-m[4]*(m[1]*m[10]-m[9]*m[2])+m[8]*(m[1]*m[6]-m[5]*m[2]);
  assert.ok(Math.abs(determinant-1)<1e-12);
}
function verify(from,to,m,stage){
  assert.ok(from&&to);verifyMatrix(m);assert.deepEqual(to.indices,from.indices);assert.equal(to.positions.length,from.positions.length);
  let maximumResidualMetres=0;
  for(let i=0;i<from.positions.length;i+=3){
    const [x,y,z]=from.positions.slice(i,i+3);
    for(let k=0;k<3;k++){
      const expected=Math.fround(m[k]*x+m[4+k]*y+m[8+k]*z+m[12+k]),actual=to.positions[i+k];
      assert.ok(Number.isFinite(actual));maximumResidualMetres=Math.max(maximumResidualMetres,Math.abs(actual-expected));assert.equal(actual,expected);
    }
  }
  checks.push({stage,side:to.side,variant:to.variant,structure:to.structure,vertices:to.positions.length/3,triangles:to.indices.length/3,maximumResidualMetres});
}
for(const to of parts.filter(p=>p.kind==='donor')){
  const from=input.find(p=>p.kind==='donor'&&p.mode==='surface-shank'&&p.side===to.side&&p.structure===to.structure);
  const m=pose.sides.find(s=>s.side===to.side).finalists[to.variant].matrix;verify(from,to,m,'initial-pose');
}
for(const mode of ['refined','refined-full','refined-hard']){
  const report=read(`${out}/${mode}.json`),output=read(`${out}/${mode}-parts.json`);
  for(const f of report.files)assert.equal(sha(f.file),f.sha256,f.file);
  for(const to of output.filter(p=>p.kind==='donor')){
    const s=report.sides.find(s=>s.side===to.side),from=parts.find(p=>p.kind==='donor'&&p.side===to.side&&p.structure===to.structure&&p.variant===s.inputVariant);
    verify(from,to,s.rigidMatrix,mode);
  }
  // Same skin/target coordinates must be carried through; only donor foot moves.
  for(const to of output.filter(p=>p.kind!=='donor')){
    const from=parts.find(p=>p.kind===to.kind&&p.side===to.side&&p.structure===to.structure);assert.ok(from);
    assert.deepEqual(to.positions,from.positions);assert.deepEqual(to.indices,from.indices);
  }
}
assert.equal(checks.length,96);
const result={status:'Rigid coordinate/index serialization verified; no anatomical approval',checks,
  vertices:checks.reduce((n,r)=>n+r.vertices,0),triangleOccurrences:checks.reduce((n,r)=>n+r.triangles,0),
  limitations:['Arithmetic and matrix orthogonality/determinant verified independently of Three Matrix4, not clinical joint-axis validity.',
    'Does not independently verify containment or all triangle intersection counts.'],
  files:['scripts/verify-donor-foot-pose.mjs',`${out}/report.json`,`${out}/parts.json`,`${out}/refined.json`,`${out}/refined-parts.json`,`${out}/refined-full.json`,`${out}/refined-full-parts.json`,`${out}/refined-hard.json`,`${out}/refined-hard-parts.json`].map(file=>({file,sha256:sha(file)}))};
fs.writeFileSync(`${out}/readback.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({...result,checks:checks.length},null,2));
