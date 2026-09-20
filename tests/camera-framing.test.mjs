import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3,PerspectiveCamera,Vector3} from 'three';
import {framedDistance} from '../src/camera-framing.ts';

test('camera fitting contains every corner in frontal, side and oblique observation windows without moving geometry',()=>{
  const boxes=[new Box3(new Vector3(-.1,.9,-.3),new Vector3(.15,1.15,.3)),
    new Box3(new Vector3(-.4,0,-.2),new Vector3(.4,1.8,.2))];
  const directions=[[0,0,1],[0,0,-1],[1,0,0],[-1,0,0],[.2,.9,.3],[-.8,-.5,.1],[0,1,0]];
  for(const box of boxes) for(const direction of directions) for(const [aspect,w,h] of [[1.8,1,.4],[.5,.58,.28],[2.6,1,.24]]) {
    const before=box.clone(), vector=new Vector3(...direction).normalize();
    const camera=new PerspectiveCamera(39,aspect,.01,20);
    const center=box.getCenter(new Vector3());
    const distance=framedDistance(box,vector,camera.fov,aspect,w,h);
    assert.ok(Number.isFinite(distance)&&distance>0);
    camera.position.copy(center).addScaledVector(vector,distance);
    camera.lookAt(center); camera.updateMatrixWorld(true);
    for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
      const p=new Vector3(x?box.max.x:box.min.x,y?box.max.y:box.min.y,z?box.max.z:box.min.z).project(camera);
      assert.ok(Math.abs(p.x)<=w&&Math.abs(p.y)<=h&&p.z<1,JSON.stringify({direction,aspect,w,h,p}));
    }
    assert.deepEqual(box,before);
  }
});
