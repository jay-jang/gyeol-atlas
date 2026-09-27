// Full saved-vertex and triangle diagnostics for all common-rigid candidates.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
assert.ok(process.argv.slice(2).length===0||process.argv.slice(2).length===1&&process.argv[2]==='--all-vertices');
const out=process.argv[2]?'.cache/brain-pose-full':'.cache/brain-pose',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex'),read=f=>JSON.parse(fs.readFileSync(f));
const anchorsPath='.cache/brain-pose/anchors.json',fit=read(`${out}/fit.json`),anchors=read(anchorsPath),headAudit=read('.cache/bonehub-head/audit.json');
for(const r of [fit,anchors,headAudit])for(const f of r.files)assert.equal(hash(f.file),f.sha256,f.file);
const original=JSON.parse(gunzipSync(fs.readFileSync(anchors.parts))),snapshots=JSON.parse(gunzipSync(fs.readFileSync(fit.parts)));
const native=JSON.parse(gunzipSync(fs.readFileSync(headAudit.placedFile))).filter(p=>p.variant==='rigid');assert.equal(native.length,2);
function geometry(p){const g=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3)).setIndex(p.indices);g.computeBoundingBox();return g;}
function withTree(p){const g=geometry(p);g.boundsTree=new MeshBVH(g);return {...p,g};}
const skin=geometry(original.find(p=>p.kind==='skin')),probe=surfaceProbe(skin,.002);
const bones=[...original.filter(p=>p.kind==='borrowed').map(p=>({...p,group:'current-borrowed-skull'})),...native.map(p=>({...p,group:'native-rigid-skull'})),...original.filter(p=>p.kind==='target').map(p=>({...p,group:'fixed-cervical'}))].map(withTree);
assert.equal(bones.length,27);
const fixedTargets=new Map([...new Set(anchors.interfaces.map(p=>p.fixedId))].map(id=>[id,withTree(original.find(p=>p.id===id))]));
const variants=[];
for(const snapshot of snapshots){
  assert.equal(snapshot.parts.length,282);const parts=[],crossings=[],interfaces=[];let evaluatedPairs=0;
  for(const p of snapshot.parts){
    const g=geometry(p),counts={inside:0,'surface-band':0,outside:0,ambiguous:0},point=new Vector3();let maxOutsideMm=0;
    for(const index of referencedVertices(g,Infinity)){point.fromBufferAttribute(g.attributes.position,index);const c=probe.classify(point);counts[c.kind]++;if(c.kind==='outside')maxOutsideMm=Math.max(maxOutsideMm,c.distance*1000);}
    for(const pair of anchors.interfaces.filter(a=>a.movingId===p.id)){
      const fixed=fixedTargets.get(pair.fixedId),records=pair.anchors.map(a=>{
        const point=new Vector3().fromBufferAttribute(g.attributes.position,a.vertex),q=fixed.g.boundsTree.closestPointToPoint(point);
        return {vertex:a.vertex,beforePoint:a.point,point:point.toArray(),baselineNearestDistanceMm:a.distanceMm,nearestDistanceMm:q.distance*1000,
          nearestTargetPoint:q.point.toArray(),anchorDisplacementMm:point.distanceTo(new Vector3(...a.point))*1000,
          pairedDistanceIncreaseMm:point.distanceTo(new Vector3(...a.targetPoint))*1000-a.distanceMm};
      });
      interfaces.push({movingId:p.id,fixedId:pair.fixedId,records,maxDisplacementMm:Math.max(...records.map(r=>r.anchorDisplacementMm)),
        maxPairedDistanceIncreaseMm:Math.max(...records.map(r=>r.pairedDistanceIncreaseMm)),maxNearestDistanceIncreaseMm:Math.max(...records.map(r=>r.nearestDistanceMm-r.baselineNearestDistanceMm)),
        minimumTrackedNearestDistanceMm:Math.min(...records.map(r=>r.nearestDistanceMm))});
    }
    g.boundsTree=new MeshBVH(g);
    for(const b of bones){evaluatedPairs++;if(!g.boundingBox.intersectsBox(b.g.boundingBox))continue;const witness=meshCrossingWitness(g,b.g);if(witness)crossings.push({brainId:p.id,boneId:b.id,boneGroup:b.group,witness});}
    parts.push({id:p.id,counts,vertices:Object.values(counts).reduce((a,b)=>a+b,0),maxOutsideMm});g.dispose();
  }
  const groups={};
  for(const group of ['current-borrowed-skull','native-rigid-skull','fixed-cervical']){
    const ids=[...new Set(crossings.filter(p=>p.boneGroup===group).map(p=>p.brainId))].sort(),before=new Set(variants[0]?.groups[group].intersectingBrainIds||[]);
    groups[group]={intersectingBrainIds:ids,intersectingBrainMeshes:ids.length,crossingPairs:crossings.filter(p=>p.boneGroup===group).length,
      newlyIntersectingBrainIds:snapshot.mode==='baseline'?[]:ids.filter(id=>!before.has(id)),resolvedBrainIds:snapshot.mode==='baseline'?[]:[...before].filter(id=>!ids.includes(id))};
  }
  const summary={vertices:parts.reduce((n,p)=>n+p.vertices,0),outside:parts.reduce((n,p)=>n+p.counts.outside,0),ambiguous:parts.reduce((n,p)=>n+p.counts.ambiguous,0),
    maxOutsideMm:Math.max(...parts.map(p=>p.maxOutsideMm)),maxAnchorDisplacementMm:Math.max(...interfaces.map(p=>p.maxDisplacementMm)),maxPairedDistanceIncreaseMm:Math.max(...interfaces.map(p=>p.maxPairedDistanceIncreaseMm)),
    maxNearestDistanceIncreaseMm:Math.max(...interfaces.map(p=>p.maxNearestDistanceIncreaseMm))};
  variants.push({mode:snapshot.mode,evaluatedPairs,summary,groups,parts,interfaces,crossings});console.log(JSON.stringify({mode:snapshot.mode,summary,groups}));
}
probe.dispose();
fs.writeFileSync(`${out}/audit.json`,JSON.stringify({status:'Offline full saved reference-brain candidate audit; not runtime or anatomical approval',variants,
  scope:'282 moving Allen reference meshes versus current borrowed skull18, native rigid skull2 and fixed cervical7; fixed native chiasm/cord interface witnesses67; all referenced brain vertices versus current skin2mm band',
  limitations:['Other fixed neural meshes, vessels and attachments are not exhaustively paired with the moved reference brain in this audit.',
    'Nearest tracked-vertex distances are neither sealed tissue connectivity nor anatomical landmarks; paired baselines already have nonzero gaps.',
    'No strict transverse surface witness does not prove absence of contained overlap, contact or near-coincident surfaces.',
    'All skin checks are referenced vertices, not complete triangle interiors or expert clinical registration.'],
  files:[`${out}/fit.json`,anchorsPath,fit.parts,anchors.parts,'.cache/bonehub-head/audit.json',headAudit.placedFile,'scripts/audit-reference-brain-pose.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');
