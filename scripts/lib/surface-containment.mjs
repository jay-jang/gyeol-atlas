import {DoubleSide, Ray, Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';

// A geometry diagnostic, not an anatomical registration or clinical validator.
// Multiple oblique rays avoid most edge-aligned degeneracies. Disagreement is
// reported rather than turning an open/ambiguous surface into an inside pass.
export function surfaceProbe(sourceGeometry, tolerance = .002) {
  const geometry=sourceGeometry.clone();
  const bvh=new MeshBVH(geometry);
  const directions=[[1,.137,.071],[.117,1,.193],[.073,.127,1]].map(v=>new Vector3(...v).normalize());
  return {
    classify(point) {
      const nearest=bvh.closestPointToPoint(point);
      if(!nearest)throw new Error('Empty skin surface');
      const distance=nearest.distance;
      if(distance<=tolerance)return {kind:'surface-band',distance};
      const parity=directions.map(direction=>{
        const hits=bvh.raycast(new Ray(point,direction),DoubleSide).sort((a,b)=>a.distance-b.distance);
        let crossings=0,last=-Infinity;
        for(const hit of hits)if(hit.distance-last>1e-7){crossings++;last=hit.distance;}
        return crossings%2;
      });
      return {kind:parity.every(p=>p===1)?'inside':parity.every(p=>p===0)?'outside':'ambiguous',distance};
    },
    dispose(){geometry.dispose();},
  };
}

export function surfaceTopology(geometry) {
  const positions=geometry.getAttribute('position'),index=geometry.getIndex();
  const welded=new Map(),vertices=[];
  for(let i=0;i<positions.count;i++){
    const key=[positions.getX(i),positions.getY(i),positions.getZ(i)].join('/');
    if(!welded.has(key))welded.set(key,welded.size);
    vertices.push(welded.get(key));
  }
  const roots=Array.from({length:welded.size},(_,i)=>i);
  const root=i=>{while(roots[i]!==i){roots[i]=roots[roots[i]];i=roots[i];}return i;};
  const edges=new Map();let degenerateTriangles=0;
  for(let i=0;i<(index?.count??positions.count);i+=3){
    const ids=[0,1,2].map(j=>vertices[index?index.getX(i+j):i+j]);
    if(new Set(ids).size<3){degenerateTriangles++;continue;}
    roots[root(ids[1])]=root(ids[0]);roots[root(ids[2])]=root(ids[0]);
    for(let j=0;j<3;j++){
      const a=ids[j],b=ids[(j+1)%3],key=a<b?`${a}/${b}`:`${b}/${a}`;
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  return {weldedVertices:welded.size,connectedComponents:new Set(vertices.map(root)).size,boundaryEdges:[...edges.values()].filter(n=>n===1).length,
    nonManifoldEdges:[...edges.values()].filter(n=>n>2).length,degenerateTriangles};
}

export function referencedVertices(geometry,limit) {
  const index=geometry.getIndex();
  const used=index?[...new Set(index.array)].sort((a,b)=>a-b):Array.from({length:geometry.getAttribute('position').count},(_,i)=>i);
  if(used.length<=limit)return used;
  return Array.from({length:limit},(_,i)=>used[Math.floor(i*(used.length-1)/(limit-1))]);
}
