import {Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

// Counts non-coplanar intersecting triangle pairs whose vertices straddle both
// supporting planes by > tolerance. This is NOT a solid penetration depth/volume.
export function triangleCrossings(a,b,toleranceM=1e-6){
  if(!Number.isFinite(toleranceM)||toleranceM<0)throw new Error('Invalid tolerance');
  const first=a.clone(),second=b.clone(),treeA=new MeshBVH(first),treeB=new MeshBVH(second);
  const result={intersectingTrianglePairs:0,strictPlaneStraddlingPairs:0,toleranceMm:toleranceM*1000,
    maxTrianglePlaneStraddleExtentMm:0};
  const signed=(triangle,other)=>{
    const normal=triangle.getNormal(new Vector3());
    return [other.a,other.b,other.c].map(p=>normal.dot(p.clone().sub(triangle.a)));
  };
  treeA.bvhcast(treeB,new Matrix4(),{intersectsTriangles(t1,t2){
    if(!t1.intersectsTriangle(t2))return false;
    result.intersectingTrianglePairs++;
    const x=signed(t1,t2),y=signed(t2,t1);
    const extent=Math.min(-Math.min(...x),Math.max(...x),-Math.min(...y),Math.max(...y));
    if(extent>toleranceM){
      result.strictPlaneStraddlingPairs++;
      result.maxTrianglePlaneStraddleExtentMm=Math.max(result.maxTrianglePlaneStraddleExtentMm,extent*1000);
    }
    return false; // Enumerate all pairs, never short-circuit at the first one.
  }});
  first.dispose();second.dispose();return result;
}
