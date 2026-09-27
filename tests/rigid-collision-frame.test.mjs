import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
test('inverse rigid query frame matches materialized moving-foot collision checks',()=>{
  const source=new BoxGeometry(1,2,3),tree=new MeshBVH(source);
  const matrix=new Matrix4().makeTranslation(2,-3,4).multiply(new Matrix4().makeRotationAxis(new Vector3(1,2,3).normalize(),.73));
  const moved=source.clone().applyMatrix4(matrix),worldTree=new MeshBVH(moved);
  for(const [local,expected] of [[[.5,0,0],true],[[5,4,3],false]]){
    const center=new Vector3(...local).applyMatrix4(matrix),target=new BoxGeometry(.3,.4,.5).translate(...center.toArray());
    const localHit=tree.intersectsGeometry(target,matrix.clone().invert()),worldHit=worldTree.intersectsGeometry(target,new Matrix4());
    assert.equal(Boolean(localHit),expected);assert.equal(Boolean(worldHit),expected);target.dispose();
  }
  source.dispose();moved.dispose();
});
