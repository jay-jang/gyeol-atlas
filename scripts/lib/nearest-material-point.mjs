import assert from 'node:assert/strict';
import {Triangle,Vector3} from 'three';
// Unlike closestPointToGeometry in the installed BVH, closestPointToPoint uses
// shapecast and already returns the ORIGINAL triangle index. Do not resolve twice.
export function nearestMaterialPoint(g,target){
  assert.ok(g.boundsTree?.indirect);const nearest=g.boundsTree.closestPointToPoint(target);assert.ok(nearest&&Number.isFinite(nearest.distance));
  const face=nearest.faceIndex,triangle=[0,1,2].map(k=>new Vector3().fromBufferAttribute(g.attributes.position,g.index.getX(face*3+k))),bary=new Triangle(...triangle).getBarycoord(nearest.point,new Vector3());assert.ok(bary&&bary.toArray().every(Number.isFinite));
  const rebuilt=triangle.reduce((p,v,k)=>p.addScaledVector(v,bary.getComponent(k)),new Vector3());assert.ok(rebuilt.distanceTo(nearest.point)<1e-10);assert.ok(bary.toArray().every(v=>v>=-1e-10&&v<=1+1e-10));
  return {point:nearest.point.toArray(),sourceFace:face,sourceBarycentric:bary.toArray(),distanceMm:1000*nearest.distance};
}
