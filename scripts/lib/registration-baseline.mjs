// Offline historical baseline, independent of future runtime refinements.
// Position-only: callers create private geometry and recompute bounds/BVH.
export function applyBaselinePositions(geometry, part, registration) {
  const record=registration.records.find(r=>r.id===part.id);
  if(!record)return;
  if(part.system!=='borrowed'||geometry.attributes.position.count!==record.vertexCount||geometry.index.count!==record.indexCount)
    throw new Error(`Baseline metadata mismatch: ${part.id}`);
  const positions=geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
    const point=[positions.getX(i),positions.getY(i),positions.getZ(i)];
    positions.setXYZ(i,...record.translation.map((v,j)=>v+point.reduce((s,x,k)=>s+x*record.linear[k][j],0)));
  }
}
