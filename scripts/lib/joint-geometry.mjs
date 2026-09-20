import {Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices} from './surface-containment.mjs';

// Unsigned one-way vertex-to-triangle minimum and a separate triangle-surface
// intersection flag. Neither measures cartilage or verifies articular contact;
// intersections cannot detect one closed bone fully enclosed in another.
export function jointSurfaceRelation(a,b){
  const first=a.clone(),second=b.clone(),treeA=new MeshBVH(first),treeB=new MeshBVH(second);
  const positions=first.getAttribute('position');let distance=Infinity;
  for(const index of referencedVertices(first,Infinity)){
    distance=Math.min(distance,treeB.closestPointToPoint(new Vector3().fromBufferAttribute(positions,index)).distance);
  }
  second.boundsTree=treeB;
  const triangleSurfacesIntersect=Boolean(treeA.intersectsGeometry(second,new Matrix4()));
  first.dispose();second.dispose();
  return {vertexSurfaceMinimumMm:distance*1000,triangleSurfacesIntersect};
}
