// Independent serialized-candidate check plus bilateral frame diagnostics.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Matrix4,Quaternion,Vector3} from 'three';
const sha=b=>createHash('sha256').update(b).digest('hex');
const file='.cache/donor-envelope-fit/report.json',reportBytes=fs.readFileSync(file),report=JSON.parse(reportBytes);
const sourceMetaPath='docs/anatomy-alignment/donor-fidelity-packing.json',sourceMetaBytes=fs.readFileSync(sourceMetaPath),packing=JSON.parse(sourceMetaBytes).unsimplifiedAlternative;
const sourceZip=fs.readFileSync('.cache/donor-fidelity/source-full.bin.gz'),candidateZip=fs.readFileSync(report.binary.path);
assert.equal(sha(sourceZip),packing.sha256);assert.equal(sha(candidateZip),report.binary.sha256);
const source=gunzipSync(sourceZip),candidate=gunzipSync(candidateZip);assert.equal(source.length,packing.bytes);assert.equal(candidate.length,source.length);
assert.deepEqual(report.binary.parts,packing.parts);
const matrix=new Matrix4().fromArray(report.sourceToAtlasMatrix),point=new Vector3();let vertices=0,triangles=0;
for(const p of packing.parts){
  assert.deepEqual(candidate.subarray(p.indices,p.indices+4*p.indexCount),source.subarray(p.indices,p.indices+4*p.indexCount));
  for(let i=0;i<p.vertexCount;i++){
    point.set(...[0,1,2].map(k=>source.readFloatLE(p.positions+4*(i*3+k)))).applyMatrix4(matrix);
    for(let k=0;k<3;k++){
      const actual=candidate.readFloatLE(p.positions+4*(i*3+k));assert.ok(Number.isFinite(actual));assert.equal(actual,Math.fround(point.getComponent(k)));
    }
  }
  vertices+=p.vertexCount;triangles+=p.indexCount/3;
}
assert.equal(vertices,652173);assert.equal(triangles,1304042);
const fitPath='docs/anatomy-alignment/hierarchy-joint-bone-surface-fits.json',fitBytes=fs.readFileSync(fitPath),fits=JSON.parse(fitBytes);
const bilateralFrameRotationDisagreement=['thigh','shank','whole-leg'].map(mode=>{
  const quaternions=['left','right'].map(side=>{
    const f=fits.fits.find(f=>f.mode===mode&&f.side===side),q=new Quaternion(),s=new Vector3();assert.equal(f.converged,true);
    new Matrix4().fromArray(f.sourceToAtlasMatrix).decompose(new Vector3(),q,s);assert.ok(s.x>0&&Math.abs(s.x-s.y)<1e-10&&Math.abs(s.x-s.z)<1e-10);return q;
  });
  return {mode,degrees:quaternions[0].angleTo(quaternions[1])*180/Math.PI};
});
const result={status:'SERIALIZATION VERIFIED; CANDIDATE REMAINS REJECTED',reportSha256:sha(reportBytes),candidateSha256:sha(candidateZip),sourceSha256:sha(sourceZip),vertices,triangles,
  unchangedTriangleIndicesAndWinding:true,allPositionsEqualFloat32CommonSimilarity:true,bilateralFrameRotationDisagreement,
  limitations:['Rotation differences describe independently estimated source-to-target frames, not measured clinical joint angles.',
    'Different estimated left/right rotations motivate articulated correspondence; they are not proof of global impossibility or uniquely correct anatomy.',
    'Serialization and transform checks do not approve the failed skin/bone candidate.'],
  provenance:[{file:sourceMetaPath,sha256:sha(sourceMetaBytes)},{file:fitPath,sha256:sha(fitBytes)},{file:'scripts/verify-donor-envelope-fit.mjs',sha256:sha(fs.readFileSync('scripts/verify-donor-envelope-fit.mjs'))}]};
fs.writeFileSync('.cache/donor-envelope-fit/readback.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
