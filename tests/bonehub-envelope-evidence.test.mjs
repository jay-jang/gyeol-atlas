import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../docs/anatomy-alignment/',import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(`${name}.json`,root)));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const reportHash=name=>hash(new URL(`${name}.json`,root));

test('CT slice statistics count label occurrences, retain the source hash and do not assert HU',()=>{
  const r=read('bonehub-ct-inspection');
  assert.equal(r.labels.length,34);assert.equal(r.labelVoxels,764287);
  assert.equal(r.labels.reduce((n,l)=>n+l.voxels,0),r.labelVoxels);
  for(const l of r.labels){assert.equal(l.histogram.reduce((n,h)=>n+h.count,0),l.voxels);assert.equal(l.minimum,l.histogram[0].value);assert.equal(l.maximum,l.histogram.at(-1).value);}
  assert.equal(Math.min(...r.labels.map(l=>l.minimum)),885);assert.equal(Math.max(...r.labels.map(l=>l.maximum)),2774);
  assert.deepEqual(r.displayStoredRange,[0,2000]);assert.equal(r.footCrop.axisOrder,'ZYX');assert.equal(r.footCrop.zStopExclusive,200);
  assert.equal(r.files.find(f=>f.file.endsWith('02_Female.nii.gz')).sha256,read('bonehub-female-ct-receipt').sourceFile.sha256);
  assert.match(r.limitations.join(' '),/not HU calibration/);
});

test('three native envelope candidates keep voxel seeds distinct from STL checks and artificial caps',()=>{
  const r=read('bonehub-foot-envelope'),i=read('bonehub-ct-inspection');
  assert.deepEqual(r.thresholdsStored,[500,650,800]);assert.equal(r.connectivity,6);
  assert.equal(r.seedVoxelOccurrences,764287);assert.equal(r.seedUniqueVoxels,764098);
  assert.equal(r.sourceParts.length,34);assert.equal(r.sourceParts.reduce((n,p)=>n+p.vertices,0),242730);
  assert.equal(r.files.find(f=>f.file===i.footCrop.file).sha256,i.footCrop.sha256);
  assert.equal(r.files.find(f=>f.file.endsWith('/report.json')).sha256,reportHash('bonehub-ct-inspection'));
  assert.deepEqual(r.candidates.map(c=>c.envelopeVoxels),[3620903,3558066,3498175]);
  assert.deepEqual(r.candidates.map(c=>c.filledVoxelsAdded),[80,52,15]);
  for(const c of r.candidates){
    assert.equal(c.selectedVoxels+c.filledVoxelsAdded,c.envelopeVoxels);
    assert.equal(c.selectedComponents.length,1);assert.ok(c.selectedComponents[0].seededLeft&&c.selectedComponents[0].seededRight);
    assert.equal(c.stlMembership.length,34);assert.ok(c.stlMembership.every(p=>p.outsideUnfilled===0&&p.outsideFilled===0));
    assert.equal(c.stlMembership.reduce((n,p)=>n+p.vertices,0),242730);
    assert.equal(c.cropFacesTouched[0],0);assert.equal(c.cropFacesTouched[1]*2,c.artificialClosures.triangles);
  }
  assert.match(r.status,/not skin/);assert.match(r.limitations.join(' '),/by construction/);
});

test('serialized cell surfaces and unchanged bone triangles have bounded, explicit readback evidence',()=>{
  const r=read('bonehub-foot-envelope-readback'),c=read('bonehub-foot-envelope');
  assert.equal(r.sourceBones.length,34);assert.equal(r.sourceTriangleCornerOccurrences,1455972);
  assert.ok(r.sourceBones.every(b=>b.maximumCoordinateResidualMm===0));
  assert.deepEqual(r.rows.map(r=>r.triangles),[606080,598684,595396]);
  for(let i=0;i<3;i++){
    const row=r.rows[i],candidate=c.candidates[i];
    assert.equal(row.triangles,candidate.surface.triangles+candidate.artificialClosures.triangles);
    assert.equal(row.triangles,row.expectedBoundaryTriangles);assert.equal(row.gridVolume,row.sourceVoxels);
    assert.ok(row.maximumFloat32RoundtripMm<.00005&&row.uniqueTriangles&&row.allTriangleSidesMatchMask);
  }
  assert.equal(r.files[0].sha256,reportHash('bonehub-foot-envelope'));
  assert.match(r.limitations.join(' '),/No HRA fit, manifold topology/);
});

test('all five diagnostic captures retain hashes and source scripts match recorded provenance',()=>{
  const i=read('bonehub-ct-inspection'),v=read('bonehub-foot-envelope-visual');
  const pairs=[...i.captures.map(c=>[c,`bonehub-ct-${c.file.split('/').at(-1)}`]),
    ...v.captures.map(c=>[c,c.mode==='opaque-envelope'?'bonehub-foot-envelope-opaque.png':'bonehub-foot-envelope-transparent.png'])];
  assert.equal(pairs.length,5);
  for(const [capture,name] of pairs)assert.equal(hash(new URL(name,root)),capture.sha256);
  assert.deepEqual(v.errors,[]);assert.ok(v.captures.every(c=>c.views.length===6&&c.views.every(v=>v.visibleBones===34)));
  assert.equal(v.files[0].sha256,reportHash('bonehub-foot-envelope'));
  for(const report of [i,v,read('bonehub-foot-envelope'),read('bonehub-foot-envelope-readback')]){
    for(const f of report.files.filter(f=>f.file.startsWith('scripts/')))assert.equal(hash(new URL(`../${f.file}`,import.meta.url)),f.sha256);
  }
});
