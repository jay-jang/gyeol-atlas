// Independent arithmetic/index readback of the cached placements and witnesses.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Triangle,Vector3} from 'three';
import {transverseTriangleWitness} from './lib/triangle-witness.mjs';
const folder='.cache/vivaplus-head-fit',read=p=>JSON.parse(fs.readFileSync(p));
const sha=b=>createHash('sha256').update(b).digest('hex');
const report=read(`${folder}/report.json`),source=read('.cache/vivaplus-head/consistent-surfaces.json');
for(const f of report.files)assert.equal(sha(fs.readFileSync(f.file)),f.sha256);
const raw=fs.readFileSync(report.visualization.path);assert.equal(sha(raw),report.visualization.sha256);
const meshes=JSON.parse(gunzipSync(raw)).meshes;
// BVH construction can reorder triangles, but must retain every oriented triple.
function triangles(indices){const result=[];for(let i=0;i<indices.length;i+=3)result.push(indices.slice(i,i+3).join('/'));return result.sort();}
const rows=[];
for(const fit of report.fits)for(const [kind,id] of [['skin','head-skin-union'],['skull','skull-trabecular-union']]){
  const original=source.meshes.find(m=>m.id===id),candidate=meshes.find(m=>m.id===`${fit.mode}-${kind}`),m=fit.matrix;
  assert.equal(candidate.positions.length,original.positions.length);assert.deepEqual(triangles(candidate.indices),triangles(original.indices));
  let maximumErrorM=0;
  for(let i=0;i<original.positions.length;i+=3){
    const [x,y,z]=original.positions.slice(i,i+3).map(Math.fround);
    for(let axis=0;axis<3;axis++){
      const expected=Math.fround(m[axis]*x+m[axis+4]*y+m[axis+8]*z+m[axis+12]);
      const error=Math.abs(expected-candidate.positions[i+axis]);maximumErrorM=Math.max(error,maximumErrorM);
    }
  }
  assert.equal(maximumErrorM,0);
  const columns=[0,1,2].map(i=>new Vector3(...m.slice(4*i,4*i+3)));
  for(const col of columns)assert.ok(Math.abs(col.length()-fit.scale)<1e-10);
  for(const [a,b] of [[0,1],[0,2],[1,2]])assert.ok(Math.abs(columns[a].dot(columns[b]))<1e-10);
  assert.ok(columns[0].dot(columns[1].clone().cross(columns[2]))>0);
  if(fit.mode!=='similarity')assert.ok(Math.abs(fit.scale-1)<1e-10);
  rows.push({mode:fit.mode,kind,vertices:original.positions.length/3,triangles:original.indices.length/3,maximumErrorM});
}
const prior=read('docs/anatomy-alignment/female-neural-source.json');
const oldIds=[...new Set(prior.pairs.filter(p=>report.borrowedIds.includes(p.boneId)&&p.runtime).map(p=>p.neuralId))].sort();
assert.deepEqual(report.results[0].crossings.map(c=>c.id).sort(),oldIds);
let witnesses=0;
for(const result of report.results){
  assert.equal(result.vertices,result.containment.inside+result.containment.outside+result.containment['surface-band']+result.containment.ambiguous);
  for(const {witness:w} of result.crossings){
    const triangle=p=>new Triangle(...p.map(v=>new Vector3(...v)));
    assert.ok(transverseTriangleWitness(triangle(w.a),triangle(w.b)));witnesses++;
  }
}
const proof={reportSha256:sha(fs.readFileSync(`${folder}/report.json`)),rows,totalReferencedVertices:rows.reduce((s,r)=>s+r.vertices,0),witnessesReplayed:witnesses,
  previousAuditBaselineIdsMatch:true,baselineDistinctNeuralMeshes:oldIds.length,
  limitations:['Arithmetic and oriented-index readback, not an independent nearest-surface optimizer or clinical check.',
    'Witness replay reuses the segment-triangle predicate but not the BVH traversal; no-witness outcomes are not certified.']};
fs.writeFileSync(`${folder}/readback.json`,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
