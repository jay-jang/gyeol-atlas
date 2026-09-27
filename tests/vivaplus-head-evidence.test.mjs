import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const read=name=>JSON.parse(fs.readFileSync(`docs/anatomy-alignment/vivaplus-head-${name}.json`));
test('VIVA head evidence distinguishes source partitions, failed groups and internal faces',()=>{
  const inventory=read('inventory'),initial=read('extraction'),diagnostic=read('boundary-failures');
  const diagonals=read('diagonals'),candidate=read('consistent-extraction');
  assert.equal(inventory.declaredParts,73);assert.equal(inventory.nonemptyParts,73);
  assert.deepEqual(inventory.elementCounts,{'*ELEMENT_SHELL_THICKNESS':5272,'*ELEMENT_SOLID':36650,'*ELEMENT_SHELL':6380});
  assert.equal(initial.failures.length,12);assert.equal(initial.groups.length,64);
  const failedFaces=diagnostic.records.flatMap(r=>r.failures);
  assert.equal(failedFaces.length,45);
  for(const f of failedFaces){
    assert.equal(f.canonical.passes,false);assert.equal(f.alternate.passes,true);
    assert.equal(f.jacobianSamples.length,17);assert.ok(f.minimumSampledJacobianMm3>0);
    assert.equal(f.minimumSampledJacobianMm3,Math.min(...f.jacobianSamples.map(v=>v.determinantMm3)));
  }
  assert.equal(diagonals.failures.length,14);
  assert.equal(diagonals.failures.filter(f=>f.withinSinglePart).length,6);
  assert.equal(diagonals.failures.filter(f=>!f.withinSinglePart).length,8);
  for(const f of diagonals.failures){
    assert.equal(f.elementIds.length,2);assert.equal(f.sourcePartIds.length,2);
    assert.equal(f.withinSinglePart,new Set(f.sourcePartIds).size===1);
    for(const checks of f.candidateChecks)assert.ok(!checks.every(c=>c.passes)||checks[0].orientation*checks[1].orientation>=0);
  }
  assert.equal(candidate.groups.length,69);assert.equal(candidate.failures.length,7);
  assert.equal(candidate.groups.reduce((sum,r)=>sum+r.triangles,0),80012);
  assert.deepEqual(candidate.failures.map(f=>f.id),['105000','105003','106003','155000','155003','156003','brain-tissue-union']);
  for(const failure of candidate.failures)assert.ok(!candidate.groups.some(r=>r.id===failure.id));
  const successfulParts=candidate.groups.filter(r=>!r.id.endsWith('union')).map(r=>Number(r.id));
  const failedParts=candidate.failures.filter(r=>!r.id.endsWith('union')).map(r=>Number(r.id));
  assert.deepEqual([...successfulParts,...failedParts].sort((a,b)=>a-b),inventory.parts.map(r=>r.id).sort((a,b)=>a-b));
});
test('VIVA head source readback and topology evidence do not assert full brain or HRA fit',()=>{
  const candidate=read('consistent-extraction'),proof=read('coordinate-readback'),audit=read('surface-audit'),captures=read('captures');
  for(const r of [proof,audit,captures])assert.equal(r.geometrySha256,candidate.geometrySha256);
  assert.equal(proof.totalReferencedVertices,41320);assert.ok(proof.maxSourceCoordinateErrorMm<1e-9);
  assert.equal(proof.groups.length,candidate.groups.length);
  for(const group of proof.groups){
    const original=candidate.groups.find(g=>g.id===group.id);
    assert.equal(group.vertices,original.vertices);assert.equal(group.triangles,original.triangles);
    assert.ok(group.maxSourceCoordinateErrorMm<1e-9);
  }
  const skull=audit.topology.find(r=>r.id==='skull-trabecular-union');
  assert.equal(skull.connectedComponents,1);
  for(const key of ['boundaryEdges','nonManifoldEdges','duplicateTriangles','sourceIdTwoFaceWindingConflicts'])assert.equal(skull[key],0);
  assert.equal(audit.topology.find(r=>r.id==='head-skin-union').boundaryEdges,48);
  assert.equal(audit.pairs.length,1);assert.equal(audit.pairs[0].intersectingTrianglePairs,0);
  assert.equal(audit.deployed,false);assert.equal(audit.hraRegistered,false);assert.equal(audit.anatomicallyValidated,false);
  assert.deepEqual(captures.displayedGroupIds,['skull-trabecular-union','head-skin-union']);
  assert.equal(captures.appMounted,false);assert.deepEqual(captures.errors,[]);
});
