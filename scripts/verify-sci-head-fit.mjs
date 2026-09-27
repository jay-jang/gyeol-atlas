import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3} from 'three';
import {surfaceProbe} from './lib/surface-containment.mjs';
const folder='.cache/sci-head-fit',read=p=>JSON.parse(fs.readFileSync(p)),sha=b=>createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(`${folder}/report.json`),report=JSON.parse(raw);
for(const f of report.files)assert.equal(sha(fs.readFileSync(f.path)),f.sha256);
const source=read('.cache/sci-head/shared-candidate.json'),binary=gunzipSync(fs.readFileSync(source.binary.path));
const atlas=read('public/models/female/atlas-female.json'),skinPart=atlas.parts.find(p=>p.id==='HRAF0003');
const skinBytes=gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[skinPart.chunk].gzip.split('/').at(-1)}`));
const skin=new BufferGeometry();skin.setAttribute('position',new BufferAttribute(new Float32Array(skinBytes.buffer,skinBytes.byteOffset+skinPart.positions,skinPart.vertexCount*3).slice(),3));
skin.setIndex(new BufferAttribute(new Uint32Array(skinBytes.buffer,skinBytes.byteOffset+skinPart.indices,skinPart.indexCount).slice(),1));
const probe=surfaceProbe(skin),rows=[];
for(const fit of report.fits){
  const matrix=fit.matrix,result=report.results.find(r=>r.mode===fit.mode),columns=[0,1,2].map(c=>new Vector3(...matrix.slice(4*c,4*c+3)));
  for(const c of columns)assert.ok(Math.abs(c.length()-fit.scale)<1e-10);
  for(const [a,b] of [[0,1],[0,2],[1,2]])assert.ok(Math.abs(columns[a].dot(columns[b]))<1e-10);
  assert.ok(columns[0].dot(columns[1].clone().cross(columns[2]))>0);
  const transform=p=>[0,1,2].map(a=>matrix[a]*p[0]+matrix[a+4]*p[1]+matrix[a+8]*p[2]+matrix[a+12]);
  const anchors=[...report.anchors.sourceEyes,report.anchors.sourceTop.point],targets=[...report.anchors.targetEyes,report.anchors.targetTop.point];
  const residuals=anchors.map((p,i)=>Math.hypot(...transform(p).map((v,a)=>v-targets[i][a]))*1000);
  residuals.forEach((v,i)=>assert.ok(Math.abs(v-result.anchorResidualsMm[i])<1e-9));
  for(const material of result.materials){
    assert.equal(Object.values(material.counts).reduce((a,b)=>a+b,0),material.vertices);
    const part=source.parts.find(p=>p.id===material.id);
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<part.vertexCount;i++){
      const point=transform([0,1,2].map(a=>binary.readFloatLE(part.positions+4*(i*3+a)))).map(Math.fround);
      point.forEach((v,a)=>{min[a]=Math.min(min[a],v);max[a]=Math.max(max[a],v);});
      if(material.witness?.vertex===i){
        assert.deepEqual(point,material.witness.point);const c=probe.classify(new Vector3(...point));
        assert.equal(c.kind,'outside');assert.ok(Math.abs(c.distance*1000-material.maximumOutsideMm)<1e-9);
      }
    }
    assert.deepEqual([min,max],material.bounds);rows.push({mode:fit.mode,id:part.id,vertices:part.vertexCount});
  }
}
const pairDistances=points=>[[0,1],[0,2],[1,2]].map(([a,b])=>Math.hypot(...points[a].map((v,i)=>v-points[b][i]))*1000);
const sourceDistances=pairDistances([...report.anchors.sourceEyes,report.anchors.sourceTop.point]);
const targetDistances=pairDistances([...report.anchors.targetEyes,report.anchors.targetTop.point]);
const proof={reportSha256:sha(raw),rows,totalVertexEvaluations:rows.reduce((s,r)=>s+r.vertices,0),
  anchorPairDistancesMm:{pairs:['right-left eye centers','right eye-superior patch','left eye-superior patch'],source:sourceDistances,target:targetDistances,requiredScaleByPair:targetDistances.map((v,i)=>v/sourceDistances[i])},
  limitations:['Independent matrix arithmetic and whole selected-buffer bounds, but not a separate optimizer or every-vertex containment rerun.',
    'Saved maximum-outside witnesses reuse the skin classifier. Ray ambiguity counts remain unresolved; no native neural connection check.']};
fs.writeFileSync(`${folder}/readback.json`,JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));probe.dispose();skin.dispose();
