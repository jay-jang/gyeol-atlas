import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {Matrix4,Vector3} from 'three';
const root='docs/anatomy-alignment/';
const read=p=>JSON.parse(fs.readFileSync(p));
const report=read(`${root}calf-knee-provenance.json`);
const source=read(`${root}donor-source-comparison.json`);
const previous=read(`${root}calf-shank-candidate.json`);
const fits=read(`${root}hierarchy-joint-bone-surface-fits.json`);
const matrix=f=>new Matrix4().set(...f.rows[0].map(v=>v*f.scale),f.offset[0],...f.rows[1].map(v=>v*f.scale),f.offset[1],...f.rows[2].map(v=>v*f.scale),f.offset[2],0,0,0,1);
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');

test('calf knee source audit keeps bounded scope and reproduces all 14 old new-crossing pairs at full muscle resolution',()=>{
  assert.match(report.status,/no runtime changes/);
  assert.deepEqual(report.sides.map(s=>s.id),['VHF0005','VHF0043']);
  assert.deepEqual(report.sides.map(s=>[s.rawVertices,s.packedVertices]),[[9931,2186],[9542,2100]]);
  let pairs=0,confirmed=0;
  for(const side of report.sides){
    assert.equal(side.sourceRelations.length,10);
    assert.equal(side.sourceRelations.filter(p=>p.kind==='ligament').length,4);
    for(const p of side.sourceRelations){assert.equal(p.raw.crossing,false);assert.equal(p.packed.crossing,false);assert.ok(p.rawToTarget.minimumMm>1);}
    assert.equal(side.frames.length,5);
    for(const f of side.frames){assert.equal(f.pairs.length,12);pairs+=f.pairs.length;assert.deepEqual(f.rawCrossingIds,f.packedCrossingIds);}
    assert.equal(side.confirmedLegacyNewCrossings.length,7);
    for(const p of side.confirmedLegacyNewCrossings){assert.equal(p.packedCrossing,true);assert.equal(p.fullSourceCrossing,true);confirmed++;}
    assert.deepEqual(side.frames.find(f=>f.name==='hierarchy-shank').rawCrossingIds,[]);
  }
  assert.equal(pairs,120);assert.equal(confirmed,14);
});

test('five saved frames preserve source composition and distinguish remaining skin failures from mesh resolution',()=>{
  let skinReferences=0;
  for(const side of report.sides){
    const base=matrix(source.fits[`${side.side}-thigh`]);
    for(const f of side.frames){
      const expected=f.name==='current-thigh'?base:f.name==='original-shank'?matrix(source.fits[`${side.side}-shank`]):new Matrix4().fromArray(fits.fits.find(r=>r.side===side.side&&r.mode===f.name.slice('hierarchy-'.length)).sourceToAtlasMatrix);
      const saved=new Matrix4().fromArray(f.sourceToAtlasMatrix);
      assert.deepEqual(saved.toArray(),expected.toArray());
      const delta=saved.clone().multiply(base.clone().invert());
      for(const p of [[0,0,0],[.1,.5,-.3],[-.2,-.5,.1]])assert.ok(new Vector3(...p).applyMatrix4(base).applyMatrix4(delta).distanceTo(new Vector3(...p).applyMatrix4(saved))<1e-12);
      for(const [key,count] of [['rawSkin',side.rawVertices],['packedSkin',side.packedVertices]]){
        const s=f[key];assert.equal(s.vertices,count);assert.equal(s.inside+s.outside+s['surface-band']+s.ambiguous,count);assert.equal(s.ambiguous,0);skinReferences+=count;
      }
    }
    const baseline=previous.comparisons.find(p=>p.id===side.id);
    for(const [name,key] of [['current-thigh','skinBefore'],['original-shank','skinAfter']]){
      const {vertices,...counts}=side.frames.find(f=>f.name===name).packedSkin;assert.deepEqual(counts,baseline[key]);
    }
    const shank=side.frames.find(f=>f.name==='hierarchy-shank');assert.equal(shank.packedSkin.outside,126);assert.ok(shank.rawSkin.outside>0);
  }
  assert.equal(skinReferences,118795);
});

test('saved 72 triangle witnesses independently reconstruct segment and barycentric points, not maximum penetration',()=>{
  let count=0;
  for(const side of report.sides)for(const frame of side.frames)for(const pair of frame.pairs)for(const key of ['raw','packed']){
    const r=pair[key];if(!r.crossing)continue;
    assert.ok(r.strictPlaneStraddlingPairs>0);assert.ok(r.witness);count++;
    const w=r.witness,a=w.a.map(p=>new Vector3(...p)),b=w.b.map(p=>new Vector3(...p));
    const [from,onto]=w.direction==='a-to-b'?[a,b]:[b,a];
    assert.ok(w.segmentFraction>0&&w.segmentFraction<1);assert.ok(w.barycentric.every(x=>x>0&&x<1));
    assert.ok(Math.abs(w.barycentric.reduce((a,b)=>a+b,0)-1)<1e-12);
    const segment=from[w.edge].clone().lerp(from[(w.edge+1)%3],w.segmentFraction);
    const triangle=onto.reduce((sum,p,i)=>sum.addScaledVector(p,w.barycentric[i]),new Vector3());
    const saved=new Vector3(...w.point);assert.ok(segment.distanceTo(saved)<1e-12);assert.ok(triangle.distanceTo(saved)<1e-10);
    const distances=(x,y)=>{const n=x[1].clone().sub(x[0]).cross(x[2].clone().sub(x[0])).normalize();return y.map(v=>n.dot(v.clone().sub(x[0])));};
    const x=distances(a,b),y=distances(b,a),extent=1000*Math.min(-Math.min(...x),Math.max(...x),-Math.min(...y),Math.max(...y));
    assert.ok(extent>.001);assert.ok(Math.abs(extent-w.planeStraddleExtentMm)<1e-9);
    assert.ok(w.planeStraddleExtentMm<=r.maxTrianglePlaneStraddleExtentMm+1e-9);
  }
  assert.equal(count,72);
});

test('same-side ligament cross-correspondence retains both directions without silently relabeling anatomy',()=>{
  for(const side of report.sides){
    const f=side.frames.find(f=>f.name==='hierarchy-shank'),rows=f.ligamentCrossCorrespondence;assert.equal(rows.length,16);
    assert.equal(new Set(rows.map(r=>`${r.source}/${r.target}`)).size,16);
    for(const key of ['ACL','PCL','MCL','LCL']){
      const group=rows.filter(r=>r.source===key),diagonal=group.find(r=>r.target===key),regular=f.ligamentResiduals.find(r=>r.structure===key);
      assert.equal(group.length,4);assert.deepEqual(diagonal.forward,regular.forward);assert.deepEqual(diagonal.reverse,regular.reverse);
      for(const direction of ['forward','reverse']){
        assert.equal(group.toSorted((a,b)=>a[direction].medianMm-b[direction].medianMm)[0].target,key);
        for(const row of group){const d=row[direction];assert.ok(d.vertices>0&&d.minimumMm<=d.medianMm&&d.medianMm<=d.p95Mm&&d.p95Mm<=d.maximumMm);}
      }
    }
  }
});

test('offline audit inputs and eight diagnostic captures retain provenance, without claiming app UI checks',()=>{
  for(const f of report.files.filter(f=>!f.path.endsWith('.stl')))assert.equal(sha(f.path),f.sha256,f.path);
  const c=read(`${root}calf-knee-captures.json`);assert.equal(c.auditSha256,sha(`${root}calf-knee-provenance.json`));
  assert.equal(c.scriptSha256,sha('scripts/capture-calf-knee-provenance.mjs'));assert.match(c.status,/not app UI/);assert.deepEqual(c.errors,[]);assert.equal(c.captures.length,8);
  assert.equal(new Set(c.captures.map(p=>`${p.side}/${p.frame}/${p.view}`)).size,8);
  for(const p of c.captures)assert.equal(sha(`${root}${p.file}`),p.sha256,p.file);
});
