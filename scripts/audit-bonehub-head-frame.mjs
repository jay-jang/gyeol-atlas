// Evaluate every stored source head vertex after one common cervical transform.
// Strict triangle witnesses diagnose surface crossings, not solid penetration.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,surfaceTopology,referencedVertices} from './lib/surface-containment.mjs';
import {meshCrossingWitness} from './lib/triangle-witness.mjs';
const out='.cache/bonehub-head',hash=f=>createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const frame=JSON.parse(fs.readFileSync(`${out}/frame.json`));for(const f of frame.files)assert.equal(hash(f.file),f.sha256,f.file);
const rows=JSON.parse(gunzipSync(fs.readFileSync(frame.parts)));
function geometry(p,matrix){
  const g=new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(p.positions),3)).setIndex(p.indices);
  if(matrix)g.applyMatrix4(matrix);g.computeBoundingBox();return g;
}
function tree(g){g.boundsTree=new MeshBVH(g);return g;}
const skinRow=rows.find(p=>p.kind==='skin'),skin=geometry(skinRow),topology=surfaceTopology(skin),probe=surfaceProbe(skin);
assert.equal(topology.connectedComponents,1);assert.equal(topology.boundaryEdges,0);assert.equal(topology.nonManifoldEdges,0);
const neural=rows.filter(p=>p.kind==='neural').map(p=>({...p,g:tree(geometry(p))}));assert.equal(neural.length,362);
const brainIds=new Set(JSON.parse(fs.readFileSync('data/female-organ-groups.json')).find(p=>p.id==='brain').ids);
const neck=rows.filter(p=>p.kind==='target').map(p=>({...p,g:tree(geometry(p))}));assert.equal(neck.length,7);
const variants=[],placedRows=[];
for(const candidate of [{mode:'borrowed-baseline'},...frame.candidates]){
  const baseline=candidate.mode==='borrowed-baseline',matrix=baseline?null:new Matrix4().fromArray(candidate.matrixColumnMajor);
  const parts=rows.filter(p=>baseline?p.kind==='borrowed':p.kind==='source'&&p.id.startsWith('SKULL_'));
  assert.equal(parts.length,baseline?18:2);const results=[],crossings=[],neckCrossings=[];let testedNeuralPairs=0;
  for(const p of parts){
    const g=geometry(p,matrix),counts={inside:0,'surface-band':0,outside:0,ambiguous:0},point=new Vector3();let maxOutsideMm=0,maxOutsidePoint=null;
    for(const i of referencedVertices(g,Infinity)){
      point.fromBufferAttribute(g.attributes.position,i);const r=probe.classify(point);counts[r.kind]++;
      if(r.kind==='outside'&&r.distance*1000>maxOutsideMm){maxOutsideMm=r.distance*1000;maxOutsidePoint=point.toArray();}
    }
    // Save before BVH construction: direct construction may reorder indices.
    placedRows.push({id:p.id,kind:'head',variant:candidate.mode,positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});
    tree(g);
    for(const n of neural){testedNeuralPairs++;if(!g.boundingBox.intersectsBox(n.g.boundingBox))continue;const witness=meshCrossingWitness(n.g,g);if(witness)crossings.push({neuralId:n.id,neuralName:n.name,sourceGeometryId:n.sourceGeometryId,sourceSystem:n.sourceSystem,inBrainGroup:brainIds.has(n.id),boneId:p.id,witness});}
    for(const n of neck){if(!g.boundingBox.intersectsBox(n.g.boundingBox))continue;const witness=meshCrossingWitness(n.g,g);if(witness)neckCrossings.push({cervicalId:n.id,boneId:p.id,witness});}
    results.push({id:p.id,vertices:Object.values(counts).reduce((a,b)=>a+b,0),counts,maxOutsideMm,maxOutsidePoint,bounds:[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()]});g.dispose();
    console.log(JSON.stringify({mode:candidate.mode,id:p.id,counts,maxOutsideMm,crossingPairs:crossings.length}));
  }
  const baselineNeural=new Set(variants[0]?.crossings.map(p=>p.neuralId)||[]),intersectingNeural=[...new Set(crossings.map(p=>p.neuralId))].sort();
  variants.push({mode:candidate.mode,parts:results,neuralMeshes:neural.length,testedNeuralPairs,crossings,neckCrossings,intersectingNeural,
    summary:{vertices:results.reduce((n,p)=>n+p.vertices,0),outside:results.reduce((n,p)=>n+p.counts.outside,0),ambiguous:results.reduce((n,p)=>n+p.counts.ambiguous,0),maxOutsideMm:Math.max(...results.map(p=>p.maxOutsideMm)),
      crossingPairs:crossings.length,intersectingNeuralMeshes:intersectingNeural.length,intersectingBrainMeshes:new Set(crossings.filter(p=>p.inBrainGroup).map(p=>p.neuralId)).size,
      newIntersectingNeural:baseline?[]:intersectingNeural.filter(id=>!baselineNeural.has(id)),resolvedIntersectingNeural:baseline?[]:[...baselineNeural].filter(id=>!intersectingNeural.includes(id)),cervicalCrossingPairs:neckCrossings.length}});
  console.log(JSON.stringify({mode:candidate.mode,...variants.at(-1).summary}));
}
probe.dispose();const placedFile=`${out}/placed.json.gz`;fs.writeFileSync(placedFile,gzipSync(JSON.stringify(placedRows)));
fs.writeFileSync(`${out}/audit.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'OFFLINE full referenced-vertex and strict surface witness diagnostic; NOT anatomical approval',skinTopology:topology,skinToleranceMm:2,variants,placedFile,
  limitations:['Eighteen borrowed bones and two coarse source labels have different segmentation membership/resolution. Compare neural mesh sets, not pair counts as a quality score.',
    'A crossing witness proves a transverse surface intersection at one point; no witness does not rule out complete containment, touching or near-coincident surfaces.',
    'Neural display layer includes sensory structures/cavities and supporting tissue; counts are mesh counts, not numbers of nerves or injuries.',
    'Skin test checks vertices against a 2mm surface band, not all triangle interiors, foramina, joints, continuity or clinical placement.',
    'All source components remain, and HRA brain/skin/cervical targets are fixed. No public model is changed.'],
  files:[`${out}/frame.json`,frame.parts,placedFile,'data/female-organ-groups.json','scripts/audit-bonehub-head-frame.mjs','scripts/lib/surface-containment.mjs','scripts/lib/triangle-witness.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');
