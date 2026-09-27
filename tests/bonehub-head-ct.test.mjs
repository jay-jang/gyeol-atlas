import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../docs/anatomy-alignment/',import.meta.url),file=name=>new URL(`${name}.json`,root),read=name=>JSON.parse(fs.readFileSync(file(name)));
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const report=read('bonehub-head-ct'),readback=read('bonehub-head-ct-readback');

test('head CT evidence uses the full skull label payload and does not infer pure bone from its name',()=>{
  const full=report.fullSkullMask;
  assert.equal(full.voxels,778721570);assert.equal(full.fullGzipStreamsRead,true);
  assert.deepEqual(full.histogram,[777459906,1169213,92451]);assert.equal(full.histogram.reduce((a,b)=>a+b,0),full.voxels);
  for(const label of full.labels){const h=label.storedIntensityHistogram;assert.equal(h.reduce((n,p)=>n+p.count,0),full.histogram[label.value]);}
  const h=full.labels[0].storedIntensityHistogram;assert.equal(h[0].value,36);assert.equal(h.at(-1).value,3225);assert.equal(h.filter(p=>p.value<500).reduce((n,p)=>n+p.count,0),87792);
  assert.deepEqual(report.crop.minXYZ,[215,159,1500]);assert.deepEqual(report.crop.maxExclusiveXYZ,[445,455,1727]);assert.deepEqual(report.crop.shapeZYX,[227,296,230]);
  assert.match(report.limitations.join(' '),/not brain-tissue classification, penetration volume/);
});

test('nearest skull labels count per-mesh vertex occurrences, not unique voxels or clinical penetration',()=>{
  assert.equal(report.brainMeshes,283);assert.deepEqual(report.membership.map(m=>m.mode),['initial','rigid','similarity']);
  assert.deepEqual(report.membership.map(m=>m.summary.nearestLabelCounts[1]),[32849,32735,20621]);
  assert.deepEqual(report.membership.map(m=>m.summary.meshesWithNearestSkullLabel),[63,58,55]);
  for(const m of report.membership){
    assert.equal(m.rows.length,283);assert.equal(m.summary.referencedVertexOccurrences,239303);assert.equal(m.summary.outsideCrop,0);
    for(const p of m.rows)assert.equal(p.nearestLabelCounts.reduce((a,b)=>a+b,0)+p.outsideCrop,p.points);
    assert.equal(m.summary.referencedVertexOccurrences,m.rows.reduce((n,p)=>n+p.points,0));
    assert.equal(m.summary.nearestLabelCounts[1],m.rows.reduce((n,p)=>n+p.nearestLabelCounts[1],0));
  }
  assert.deepEqual(report.nativeSkullControls.map(p=>p.nearestLabelCounts),[[207060,208395,2],[18598,0,19328]]);
  assert.match(report.status,/not anatomical approval/);
});

test('independent source streaming and selected-plane completeness have explicit, bounded evidence',()=>{
  assert.equal(readback.maskReadback.sourceDecompressedBytes,778721570);assert.equal(readback.imageReadback.sourceDecompressedBytes,1557443492);
  assert.equal(readback.maskReadback.cropBytes,15454160);assert.equal(readback.imageReadback.cropBytes,30908320);
  assert.deepEqual(readback.maskReadback.histogram,report.fullSkullMask.histogram);
  assert.deepEqual(readback.maskReadback.bounds,report.fullSkullMask.labels.map(l=>l.boundsXYZ));
  assert.equal(readback.maskVoxelIntensitiesVerified,1261664);assert.equal(readback.vertexOccurrences,717909);
  assert.equal(readback.planes,8);assert.equal(readback.segments,44471);assert.equal(readback.pointContacts,0);assert.equal(readback.coplanarTriangles,0);
  assert.ok(readback.maximumEndpointDifferenceMm<1e-7);assert.equal(readback.segments,report.captures.reduce((n,c)=>n+c.segments,0));
  assert.equal(readback.files.find(f=>f.file==='.cache/bonehub-head-ct/report.json').sha256,hash(file('bonehub-head-ct')));
});

test('eight CT/mask/reference panels preserve source and script hashes without runtime assets',()=>{
  assert.deepEqual(report.captures.map(c=>c.sliceIndex),[1580,1610,1640,1670,260,340,300,350]);
  for(const c of report.captures){
    assert.equal(c.coordinateLpsMm,c.sliceIndex*report.crop.spacingXYZmm[c.axis]);
    assert.equal(hash(new URL(`bonehub-head-ct-${c.file.split('/').at(-1)}`,root)),c.sha256);
    assert.equal(c.verticalFlipped,c.axis!==2);
  }
  for(const r of [report,readback])for(const f of r.files.filter(f=>f.file.startsWith('scripts/')))assert.equal(hash(new URL(`../${f.file}`,import.meta.url)),f.sha256);
  assert.equal(report.files.find(f=>f.file==='.cache/bonehub-head/frame.json').sha256,hash(file('bonehub-head-frame')));
  assert.equal(report.files.find(f=>f.file.endsWith('02_Female.nii.gz')).sha256,read('bonehub-female-ct-receipt').sourceFile.sha256);
});
