import assert from 'node:assert/strict';
// Select the largest residual in each spatial cell before filling remaining
// slots by residual. This is an outlier control set, not an unbiased sample.
export function spatialExtremes(records,limit,cellSize){
  assert.ok(Number.isInteger(limit)&&limit>0&&Number.isFinite(cellSize)&&cellSize>0);
  const ranked=records.map((p,index)=>{assert.ok(p.point.length===3&&p.point.every(Number.isFinite)&&Number.isFinite(p.distance)&&p.distance>=0);return {p,index};}).sort((a,b)=>b.p.distance-a.p.distance||a.index-b.index),cells=new Set(),selected=[],used=new Set();
  for(const {p,index} of ranked){const key=p.point.map(v=>Math.floor(v/cellSize)).join('/');if(cells.has(key))continue;cells.add(key);selected.push(p);used.add(index);if(selected.length===limit)return selected;}
  for(const {p,index} of ranked){if(used.has(index))continue;selected.push(p);if(selected.length===limit)break;}return selected;
}
