import {Matrix4,Vector3} from 'three';

// Independent segment/triangle Moller-Trumbore check. Units are metres.
// Only segment-interior / triangle-interior hits are accepted; coplanar and
// barycentric edge/vertex contacts are not witnesses.
export function segmentTriangleHit(start,end,triangle){
  const direction=end.clone().sub(start),e1=triangle.b.clone().sub(triangle.a),e2=triangle.c.clone().sub(triangle.a);
  const h=direction.clone().cross(e2),det=e1.dot(h);
  if(Math.abs(det)<1e-16)return null;
  const s=start.clone().sub(triangle.a),u=s.dot(h)/det,q=s.clone().cross(e1),v=direction.dot(q)/det,t=e2.dot(q)/det;
  if(u<=1e-8||v<=1e-8||u+v>=1-1e-8||t<=1e-8||t>=1-1e-8)return null;
  return {point:start.clone().addScaledVector(direction,t).toArray(),segmentFraction:t,barycentric:[1-u-v,u,v]};
}
export function transverseTriangleWitness(a,b,tolerance=1e-6){
  if(!Number.isFinite(tolerance)||tolerance<0)throw new Error('Invalid triangle witness tolerance');
  const normalA=a.getNormal(new Vector3()),normalB=b.getNormal(new Vector3());
  const da=[b.a,b.b,b.c].map(p=>normalA.dot(p.clone().sub(a.a))),db=[a.a,a.b,a.c].map(p=>normalB.dot(p.clone().sub(b.a)));
  const extent=Math.min(-Math.min(...da),Math.max(...da),-Math.min(...db),Math.max(...db));
  if(extent<=tolerance)return null;
  for(const [from,onto,direction] of [[a,b,'a-to-b'],[b,a,'b-to-a']]){
    const vertices=[from.a,from.b,from.c];
    for(let i=0;i<3;i++){
      const hit=segmentTriangleHit(vertices[i],vertices[(i+1)%3],onto);
      if(hit)return {...hit,direction,edge:i,planeStraddleExtentMm:extent*1000,a:[a.a.toArray(),a.b.toArray(),a.c.toArray()],b:[b.a.toArray(),b.b.toArray(),b.c.toArray()]};
    }
  }return null;
}
export function meshCrossingWitness(a,b){
  let witness=null;
  a.boundsTree.bvhcast(b.boundsTree,new Matrix4(),{intersectsTriangles(ta,tb){
    witness=transverseTriangleWitness(ta,tb);return Boolean(witness);
  }});
  return witness;
}
