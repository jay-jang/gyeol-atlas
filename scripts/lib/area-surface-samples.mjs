import assert from 'node:assert/strict';
import {Vector3} from 'three';

function radicalInverse(n,base){let value=0,factor=1/base;while(n){value+=(n%base)*factor;n=Math.floor(n/base);factor/=base;}return value;}
// Deterministic stratified triangle-area sampling; exact duplicate coordinate
// triangles are counted once regardless of winding. Does not union overlaps,
// remove interior surfaces, or identify anatomical landmarks.
export function areaSurfaceSamples(geometry,count){
  assert.ok(Number.isInteger(count)&&count>0);const p=geometry.attributes.position,index=geometry.index,n=index?.count??p.count;assert.equal(n%3,0);
  const seen=new Set(),triangles=[];let totalArea=0,duplicates=0,degenerate=0;
  for(let face=0;face<n/3;face++){
    const vertices=[0,1,2].map(k=>{const i=index?index.getX(3*face+k):3*face+k;assert.ok(Number.isInteger(i)&&i>=0&&i<p.count);const v=new Vector3().fromBufferAttribute(p,i);assert.ok(v.toArray().every(Number.isFinite));return v;}),key=vertices.map(v=>v.toArray().join(',')).sort().join('|');
    if(seen.has(key)){duplicates++;continue;}seen.add(key);const area=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).length()/2;
    if(area===0){degenerate++;continue;}totalArea+=area;triangles.push({face,vertices,cumulativeArea:totalArea});
  }
  assert.ok(totalArea>0&&Number.isFinite(totalArea));const samples=[];let cursor=0;
  for(let i=0;i<count;i++){const at=(i+.5)*totalArea/count;while(triangles[cursor].cumulativeArea<at)cursor++;const t=triangles[cursor],u=Math.sqrt(radicalInverse(i+1,2)),v=radicalInverse(i+1,3),weights=[1-u,u*(1-v),u*v],point=t.vertices.reduce((p,v,k)=>p.addScaledVector(v,weights[k]),new Vector3());samples.push({face:t.face,barycentric:weights,point:point.toArray()});}
  return {inputTriangles:n/3,uniquePositiveAreaTriangles:triangles.length,exactDuplicateTriangles:duplicates,zeroAreaTriangles:degenerate,totalAreaSquareMetres:totalArea,samples};
}
