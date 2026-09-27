// Four planar children per source triangle; shared edges share one midpoint.
import assert from 'node:assert/strict';
export function subdivideSourceTriangles(input){
  assert.ok(input.positions.length>0&&input.positions.length%3===0&&input.indices.length>0&&input.indices.length%3===0);
  assert.ok(input.positions.every(Number.isFinite));assert.ok(input.indices.every(i=>Number.isInteger(i)&&i>=0&&i<input.positions.length/3));
  const pos=Array.from(input.positions),indices=[],midpoints=new Map();
  const midpoint=(a,b)=>{const key=a<b?`${a}/${b}`:`${b}/${a}`;if(midpoints.has(key))return midpoints.get(key);const id=pos.length/3;for(let k=0;k<3;k++)pos.push((input.positions[3*a+k]+input.positions[3*b+k])/2);midpoints.set(key,id);return id;};
  for(let i=0;i<input.indices.length;i+=3){const [a,b,c]=input.indices.slice(i,i+3),ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);indices.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);}
  assert.equal(indices.length,4*input.indices.length);return {positions:Float64Array.from(pos),indices:Uint32Array.from(indices)};
}
