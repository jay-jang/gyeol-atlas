import assert from 'node:assert/strict';
import {Vector3} from 'three';

// Greedy one-to-one triangle matching under a supplied transform. Success
// proves a bijection within tolerance; failure need not prove no bijection
// exists when duplicate/near-duplicate triangles make the greedy choice ambiguous.
export function matchTriangles(a,b,matrix,toleranceMeters){
  assert.ok(Number.isFinite(toleranceMeters)&&toleranceMeters>0);
  const permutations=[[0,1,2],[1,2,0],[2,0,1],[0,2,1],[2,1,0],[1,0,2]];
  const read=(g,i,m)=>[0,1,2].map(j=>{
    const p=new Vector3().fromBufferAttribute(g.attributes.position,g.index.getX(3*i+j));
    return m?p.applyMatrix4(m):p;
  });
  const center=points=>points.reduce((sum,p)=>sum.add(p),new Vector3()).multiplyScalar(1/3);
  const cell=p=>p.toArray().map(v=>Math.floor(v/toleranceMeters));
  const countA=a.index.count/3,countB=b.index.count/3,grid=new Map(),targets=[];
  assert.ok(Number.isInteger(countA)&&Number.isInteger(countB));
  for(let i=0;i<countB;i++){
    const points=read(b,i),key=cell(center(points)).join(',');targets.push(points);
    if(!grid.has(key))grid.set(key,[]);grid.get(key).push(i);
  }
  const used=new Set(),unmatched=[],matches=[],sameWindingExamples=[];let maxVertexError=0,sameWinding=0,reversedWinding=0;
  for(let i=0;i<countA;i++){
    const points=read(a,i,matrix),c=cell(center(points));let best=null;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      for(const j of grid.get([c[0]+x,c[1]+y,c[2]+z].join(','))||[]){
        if(used.has(j))continue;
        for(let k=0;k<permutations.length;k++){
          const error=Math.max(...permutations[k].map((v,n)=>points[n].distanceTo(targets[j][v])));
          if(error<=toleranceMeters&&(!best||error<best.error))best={source:i,target:j,permutation:k,error};
        }
      }
    }
    if(!best){unmatched.push(i);continue;}
    used.add(best.target);matches.push(best);maxVertexError=Math.max(maxVertexError,best.error);
    if(best.permutation<3){
      sameWinding++;
      const cross=points=>points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0]));
      const aNormal=cross(points),bNormal=cross(targets[best.target]);
      sameWindingExamples.push({...best,sourceAreaMm2:aNormal.length()*500000,targetAreaMm2:bNormal.length()*500000,
        normalDot:aNormal.length()&&bNormal.length()?aNormal.normalize().dot(bNormal.normalize()):null});
    }else reversedWinding++;
  }
  return {sourceTriangles:countA,targetTriangles:countB,matched:used.size,complete:used.size===countA&&used.size===countB,
    unmatchedSourceCount:unmatched.length,unmatchedSourceExamples:unmatched.slice(0,20),unmatchedTargetCount:countB-used.size,
    maxMatchedVertexErrorMm:maxVertexError*1000,sameWinding,reversedWinding,sameWindingExamples,
    worstMatch:matches.reduce((best,m)=>!best||m.error>best.error?m:best,null)};
}
