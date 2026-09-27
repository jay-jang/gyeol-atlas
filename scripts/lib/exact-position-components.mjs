import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute} from 'three';

// Position-only diagnostic copy. Exact coordinate equality, no epsilon welding,
// simplification, anatomical naming, or inference that a component is one bone.
// Original triangle order/winding is retained; unused positions are omitted.
export function exactPositionComponents(source) {
  const position=source.getAttribute('position'),index=source.getIndex();
  assert.ok(position && position.itemSize===3);
  const count=index?.count??position.count;assert.ok(count>0 && count%3===0);
  const lookup=new Map(),points=[],indices=[],parents=[];
  const root=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(let i=0;i<count;i++){
    const vertex=index?index.getX(i):i;
    assert.ok(Number.isInteger(vertex)&&vertex>=0&&vertex<position.count);
    const p=[position.getX(vertex),position.getY(vertex),position.getZ(vertex)];
    assert.ok(p.every(Number.isFinite));
    const key=p.join('/');
    if(!lookup.has(key)){lookup.set(key,parents.length);parents.push(parents.length);points.push(...p);}
    indices.push(lookup.get(key));
    if(i%3===2){const a=root(indices[i-2]);parents[root(indices[i-1])]=a;parents[root(indices[i])]=a;}
  }
  const groups=new Map();
  for(let i=0;i<indices.length;i+=3){
    const r=root(indices[i]);
    if(!groups.has(r))groups.set(r,{triangles:0,vertices:new Set(),firstTriangle:i/3});
    const g=groups.get(r);g.triangles++;for(let k=0;k<3;k++)g.vertices.add(indices[i+k]);
  }
  const components=[...groups.values()].map(g=>({
    triangles:g.triangles,vertices:g.vertices.size,firstTriangle:g.firstTriangle,
    bounds:[0,1].map(end=>[0,1,2].map(axis=>{
      let value=end?-Infinity:Infinity;for(const i of g.vertices)value=end?Math.max(value,points[3*i+axis]):Math.min(value,points[3*i+axis]);return value;
    })),
  })).sort((a,b)=>b.triangles-a.triangles||a.firstTriangle-b.firstTriangle);
  const geometry=new BufferGeometry();
  // Preserve the source scalar representation (STLLoader uses Float32).
  geometry.setAttribute('position',new BufferAttribute(new position.array.constructor(points),3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(indices),1));
  return {geometry,components};
}
