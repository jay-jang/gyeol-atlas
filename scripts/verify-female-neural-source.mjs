// Independent GLB reader verifies all native source positions in the diagnostic.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NodeIO} from '@gltf-transform/core';
import {Matrix4,Vector3} from 'three';
const sha=b=>createHash('sha256').update(b).digest('hex');
const auditFile='.cache/neural-source/female.json',auditBytes=fs.readFileSync(auditFile),audit=JSON.parse(auditBytes);
const io=new NodeIO(),point=new Vector3(),shift=new Vector3(...audit.translationFromSkin),records=[];
for(const file of [...new Set(audit.records.map(r=>r.sourceFile).filter(Boolean))]){
  const bytes=fs.readFileSync(file);assert.equal(sha(bytes),audit.files.find(f=>f.file===file).sha256);
  const doc=await io.readBinary(bytes),nodes=doc.getRoot().listNodes();
  for(const r of audit.records.filter(r=>r.sourceFile===file)){
    const matches=nodes.filter(n=>n.getName()===r.sourceName);assert.equal(matches.length,1);
    const node=matches[0],primitives=node.getMesh().listPrimitives();assert.equal(primitives.length,1);
    const position=primitives[0].getAttribute('POSITION'),world=new Matrix4().fromArray(node.getWorldMatrix());
    assert.equal(position.getCount(),r.sourceVertices);assert.deepEqual(world.toArray(),r.worldMatrix);
    const values=new Float32Array(position.getCount()*3),source=position.getArray();
    for(let i=0;i<position.getCount();i++)point.fromArray(source,3*i).applyMatrix4(world).add(shift).toArray(values,3*i);
    const hash=sha(Buffer.from(values.buffer));assert.equal(hash,r.sourcePositionSha256,r.id);
    records.push({id:r.id,vertices:position.getCount(),positionSha256:hash});
  }
}
assert.equal(records.length,503);
const result={checkedAt:new Date().toISOString(),auditSha256:sha(auditBytes),nativeMeshes:records.length,
  nativeVertices:records.reduce((n,r)=>n+r.vertices,0),allNativeSourcePositionHashesMatch:true,records,
  scope:'Independent @gltf-transform/core reading of every native source position/world matrix; not independent anatomical approval or full collision algorithm verification.'};
fs.writeFileSync('.cache/neural-source/readback.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,records:undefined}));
