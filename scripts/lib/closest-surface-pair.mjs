import {Matrix4,Vector3} from 'three';

// This installed BVH version returns traversal triangle indices for indirect
// closestPointToGeometry. Resolve them before claiming original mesh membership.
export function closestSurfacePair(a,b){
  if(!a.boundsTree?.indirect||!b.boundsTree?.indirect)throw new Error('Expected indirect BVHs');
  const pa={},pb={};a.boundsTree.closestPointToGeometry(b,new Matrix4(),pa,pb);
  if(!Number.isFinite(pa.distance))throw new Error('No finite closest surface pair');
  const faceA=a.boundsTree.resolveTriangleIndex(pa.faceIndex),faceB=b.boundsTree.resolveTriangleIndex(pb.faceIndex);
  const triangle=(g,face)=>[0,1,2].map(k=>new Vector3().fromBufferAttribute(g.attributes.position,g.index.getX(3*face+k)).toArray());
  return {minimumDistanceMm:pa.distance*1000,closest:{a:pa.point.toArray(),b:pb.point.toArray(),faceA,faceB,triangleA:triangle(a,faceA),triangleB:triangle(b,faceB)}};
}
