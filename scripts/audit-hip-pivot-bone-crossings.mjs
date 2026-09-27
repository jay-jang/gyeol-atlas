import fs from 'node:fs';
import {Matrix4} from 'three';
import {hipPivotContext} from './lib/hip-pivot-context.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
import {closestSurfacePair} from './lib/closest-surface-pair.mjs';
const ctx=hipPivotContext(process.argv[2]),{read,sha,finish,pivotBones:bones,frames}=ctx,out='.cache/hip-pivot-bone-crossings';fs.mkdirSync(out,{recursive:true});
const placed=new Map(bones.map(b=>[b.name,finish(b.source.clone().applyMatrix4(frames.find(f=>f.name===b.frame).matrix))])),identity=new Matrix4(),rows=[];
for(let i=0;i<bones.length;i++)for(let j=i+1;j<bones.length;j++){
  const a=bones[i],b=bones[j],row={names:[a.name,b.name],kinds:[a.kind,b.kind],frames:[a.frame,b.frame],anchors:[a.anchor,b.anchor]};
  for(const [state,ga,gb] of [['source',a.source,b.source],['prescribed',placed.get(a.name),placed.get(b.name)]]){
    const crossing=ga.boundingBox.intersectsBox(gb.boundingBox)&&ga.boundsTree.intersectsGeometry(gb,identity),witness=crossing?meshCrossingWitness(ga,gb):null;
    row[state]={crossing,witness};
    // Full triangle nearest pair for the two hip joint comparisons only.
    if(a.name.endsWith('Pelvis')&&b.name===`${a.side}-Femur`)row[state].closest=closestSurfacePair(ga,gb);
  }
  rows.push(row);if(row.source.crossing||row.prescribed.crossing)console.log(JSON.stringify(row));
}
for(const file of ['scripts/audit-hip-pivot-bone-crossings.mjs','scripts/lib/triangle-witness.mjs','scripts/lib/closest-surface-pair.mjs'])read(file);
const report={createdAt:new Date().toISOString(),status:'PRESCRIBED PIVOT BONE COMPATIBILITY DIAGNOSTIC; NO RUNTIME EXPORT',root:ctx.root.toArray(),frames:frames.map(f=>({name:f.name,matrix:f.matrix.toArray(),members:f.members})),rows,summary:{examinedPairs:rows.length,sourceBroadPairs:rows.filter(r=>r.source.crossing).length,prescribedBroadPairs:rows.filter(r=>r.prescribed.crossing).length,sourceWitnessPairs:rows.filter(r=>r.source.witness).length,prescribedWitnessPairs:rows.filter(r=>r.prescribed.witness).length,newBroadPairs:rows.filter(r=>r.prescribed.crossing&&!r.source.crossing).length,newWitnessPairs:rows.filter(r=>r.prescribed.witness&&!r.source.witness).length},limits:[
  'The16 diagnostic bones include10 same-coordinate Denver and6 approximately framed BoneHub lumbar surfaces. All120 pair combinations are examined, but these are not runtime HRA bones.',
  'Prescribed means source cartilage-pivot rotations applied exactly per bone frame, before any common muscle interpolation. Anatomical joint centres and pose accuracy are not certified.',
  'Strict witnesses exclude coplanar/edge-only contacts and require1micrometre plane straddle. Broad pair hits, witness pairs, triangle count, penetration depth and clinical meaning are distinct.',
  'Closest hip distances are geometric minima of source surfaces, not cartilage thickness or anatomical clearances.'
],files:[...ctx.files].map(([file,sha256])=>({file,sha256}))};fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary));
