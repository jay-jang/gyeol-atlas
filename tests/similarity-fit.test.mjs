import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4,Vector3,Quaternion} from 'three';
import {fitSimilarity} from '../scripts/lib/similarity-fit.mjs';
test('shared similarity solver recovers general rotation, translation and positive scale without mutating points',()=>{
  const source=[[0,0,0],[1,0,0],[0,2,0],[0,0,3],[1,2,3]].map(p=>new Vector3(...p)),saved=source.map(p=>p.toArray());
  for(const angle of [.7,2.5,-1.2])for(const scale of [.9,1,1.07]){
    const known=new Matrix4().compose(new Vector3(.1,.2,-.3),new Quaternion().setFromAxisAngle(new Vector3(1,2,3).normalize(),angle),new Vector3(scale,scale,scale));
    const fitted=fitSimilarity(source,source.map(p=>p.clone().applyMatrix4(known)));
    for(let i=0;i<16;i++)assert.ok(Math.abs(known.elements[i]-fitted.elements[i])<1e-10);
    assert.deepEqual(source.map(p=>p.toArray()),saved);
  }
});
test('shared similarity solver rejects empty, mismatched and coincident point sets',()=>{
  assert.throws(()=>fitSimilarity([],[]));
  assert.throws(()=>fitSimilarity([new Vector3(),new Vector3(),new Vector3()],[new Vector3()]));
  assert.throws(()=>fitSimilarity(Array.from({length:3},()=>new Vector3()),Array.from({length:3},()=>new Vector3())));
});
