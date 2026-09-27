// Offline, source-derived collision-avoidance candidate. Not an anatomy approval.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Vector3,Ray,DoubleSide} from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {surfaceProbe,referencedVertices} from './lib/surface-containment.mjs';
import {shearPoint,shearBasis,minimumQuadraticInequalities} from './lib/cord-shear.mjs';
const seeded=process.argv.includes('--section-seed'),tag=seeded?'cord-shear-seeded':'cord-shear';
const out=`.cache/${tag}`;fs.mkdirSync(out,{recursive:true});
const files=new Map(),hash=b=>createHash('sha256').update(b).digest('hex');
const read=file=>{const b=fs.readFileSync(file);files.set(file,hash(b));return b;};
const reference=JSON.parse(read('docs/anatomy-alignment/neural-component-source.json'));
const data=JSON.parse(gunzipSync(read(reference.geometryFile)));
assert.equal(files.get(reference.geometryFile),reference.files.find(f=>f.file===reference.geometryFile).sha256);
const cords=data.filter(p=>p.kind==='cord'),bones=data.filter(p=>p.kind==='bone');assert.equal(cords.length,29);assert.equal(bones.length,26);
function geometry(part){const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(Float32Array.from(part.positions),3));g.setIndex(part.indices);g.computeBoundingBox();return g;}
const fixed=bones.map(p=>{const g=geometry(p.source),tree=new MeshBVH(g);return {id:p.id,g,tree,probe:surfaceProbe(g,1e-6)};});
const clearance=.0001,spacing=.01,coefficientBound=.004;
const point=new Vector3();
const seeds=new Map();
function sectionSeed(part,y){
  const bin=Math.round(y/.001),key=`${part.id}/${bin}`;
  if(!seeds.has(key)){
    let count=0,x=0,z=0;const a=part.source.positions;
    for(const i of new Set(part.source.indices))if(Math.abs(a[3*i+1]-bin*.001)<=.001){x+=a[3*i];z+=a[3*i+2];count++;}
    assert.ok(count);seeds.set(key,[x/count,z/count]);
  }
  const [x,z]=seeds.get(key);return new Vector3(x,y,z);
}
function collect(field){
  const rows=[],ambiguous=[],unavailableSeeds=[];let inside=0,maxDistance=0,minY=Infinity,maxY=-Infinity;
  for(const p of cords){
    const used=[...new Set(p.source.indices)];
    for(const b of fixed){
      const box=b.g.boundingBox.clone().expandByScalar(clearance);
      for(const vertex of used){
        const original=p.source.positions.slice(3*vertex,3*vertex+3),candidate=field?shearPoint(original,field):original;point.fromArray(candidate);
        if(!box.containsPoint(point))continue;
        const r=b.probe.classify(point);
        if(r.kind==='ambiguous'){ambiguous.push({cordId:p.id,boneId:b.id,vertex,point:candidate,distance:r.distance});continue;}
        if(r.kind==='outside'&&r.distance>=clearance)continue;
        if(r.kind==='surface-band')continue; // Record separately during final audit; do not guess an outward side.
        const nearest=b.tree.closestPointToPoint(point),direction=r.kind==='inside'?nearest.point.clone().sub(point):point.clone().sub(nearest.point);
        if(direction.length()<1e-12)continue;direction.normalize();
        if(r.kind==='inside'){inside++;maxDistance=Math.max(maxDistance,r.distance);minY=Math.min(minY,original[1]);maxY=Math.max(maxY,original[1]);}
        let required=clearance+(r.kind==='inside'?r.distance:-r.distance),seedRecord=null;
        if(seeded&&r.kind==='inside'){
          const seed=sectionSeed(p,original[1]),classification=b.probe.classify(seed);
          if(classification.kind!=='outside'){unavailableSeeds.push({cordId:p.id,boneId:b.id,vertex,seed:seed.toArray(),kind:classification.kind});continue;}
          const trace=seed.clone().sub(point),distance=trace.length();trace.normalize();
          const hit=b.tree.raycastFirst(new Ray(point.clone(),trace),DoubleSide,0,distance);
          assert.ok(hit);direction.copy(hit.face.normal);if(direction.dot(trace)<0)direction.negate();
          required=clearance+direction.dot(hit.point.clone().sub(point));
          seedRecord={seed:seed.toArray(),seedDistanceMm:classification.distance*1000,hit:hit.point.toArray(),face:[hit.face.a,hit.face.b,hit.face.c]};
        }
        rows.push({cordId:p.id,boneId:b.id,vertex,kind:r.kind,original,point:candidate,normal:direction.toArray(),required,seedRecord});
      }
    }
  }
  return {rows,inside,maxDistance,minY,maxY,ambiguous,unavailableSeeds};
}
let measured=collect(null);assert.ok(measured.inside>0);
// Forty-millimetre numerical taper margins, rounded outward to the 10 mm grid.
const lower=Math.floor((measured.minY-.04)/spacing)*spacing,upper=Math.ceil((measured.maxY+.04)/spacing)*spacing;
const centres=Array.from({length:Math.round((upper-lower)/spacing)-3},(_,i)=>lower+(i+2)*spacing);
let field={centres,spacing,coefficients:Array(centres.length*2).fill(0)};
const n=field.coefficients.length,H=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
for(let i=0;i<centres.length-2;i++)for(const axis of [0,1])for(let a=0;a<3;a++)for(let b=0;b<3;b++)H[2*(i+a)+axis][2*(i+b)+axis]+=4*[1,-2,1][a]*[1,-2,1][b];
const history=[],allConstraints=[];let termination='iteration-limit';
for(let iteration=0;iteration<6;iteration++){
  if(measured.unavailableSeeds.length){termination='source-section-seed-not-outside-bone';break;}
  const activeRows=measured.rows.filter(row=>row.original[1]>lower&&row.original[1]<upper);
  assert.ok(measured.rows.filter(row=>row.kind==='inside').every(row=>activeRows.includes(row)));
  const constraints=activeRows.map(row=>{
    const weights=shearBasis(row.original[1],centres,spacing),a=weights.flatMap(w=>[w*row.normal[0],w*row.normal[2]]);
    return {...row,a,b:row.required+a.reduce((s,v,i)=>s+v*field.coefficients[i],0)};
  });
  if(constraints.some(r=>r.a.reduce((s,v)=>s+v*v,0)<1e-12)){termination='unsupported-height-only-direction';break;}
  allConstraints.push(...constraints);
  const bounds=Array.from({length:n},(_,i)=>[1,-1].map(sign=>({a:Array.from({length:n},(_,j)=>i===j?sign:0),b:-coefficientBound}))).flat();
  const solve=minimumQuadraticInequalities(H,[...allConstraints,...bounds],{sweeps:1500,tolerance:1e-8});
  const next={...field,coefficients:solve.coefficients},after=collect(next);
  history.push({iteration,constraints:allConstraints.length,converged:solve.converged,sweeps:solve.sweeps,maximumViolation:solve.maximumViolation,maximumUpdate:solve.maximumUpdate,
    beforeInside:measured.inside,afterInside:after.inside,afterMaximumDistanceMm:after.maxDistance*1000,ambiguous:after.ambiguous.length});
  console.log(JSON.stringify(history.at(-1)));field=next;measured=after;
  if(!solve.converged){termination='quadratic-sweep-limit-or-infeasible';break;}
  if(after.inside===0){termination='source-vertex-inside-count-zero';break;}
}
const candidate=data.map(p=>({...p,...Object.fromEntries(['source','runtime'].map(mode=>{
  const original=p[mode],positions=Float32Array.from(original.positions);
  if(p.kind==='cord')for(let i=0;i<positions.length;i+=3)positions.set(shearPoint(original.positions.slice(i,i+3),field),i);
  return [mode,{positions:[...positions],indices:original.indices}];
}))}));
const changed=[];
for(const p of cords)for(const mode of ['source','runtime']){
  const a=p[mode].positions,b=candidate.find(q=>q.id===p.id)[mode].positions;let moved=0,maxMm=0;
  for(let i=0;i<a.length;i+=3){const d=Math.hypot(...a.slice(i,i+3).map((v,k)=>v-b[i+k]));if(d>0)moved++;maxMm=Math.max(maxMm,d*1000);assert.equal(a[i+1],b[i+1]);}
  if(['HRAF0353','HRAF0381'].includes(p.id))assert.equal(moved,0);
  changed.push({id:p.id,mode,vertices:a.length/3,moved,maximumDisplacementMm:maxMm});
}
const geometryFile=`${out}/candidate.json.gz`,constraintsFile=`${out}/constraints.json.gz`;
fs.writeFileSync(geometryFile,gzipSync(JSON.stringify(candidate)));read(geometryFile);
fs.writeFileSync(constraintsFile,gzipSync(JSON.stringify(allConstraints)));read(constraintsFile);
for(const f of ['scripts/fit-cord-shear.mjs','scripts/lib/cord-shear.mjs','scripts/lib/surface-containment.mjs'])read(f);
const report={createdAt:new Date().toISOString(),strategy:seeded?'First exit toward validated bone-exterior source section mean':'Nearest surface tangent',status:'OFFLINE CANDIDATE, NOT APPLIED; source-derived collision objective is not anatomical ground truth',field,
  supportY:[centres[0]-2*spacing,centres.at(-1)+2*spacing],clearanceMm:clearance*1000,coefficientBoundMm:coefficientBound*1000,smoothingSecondDifferenceWeight:4,
  termination,history,changed,remainingAmbiguous:measured.ambiguous,unavailableSeeds:measured.unavailableSeeds,geometryFile,constraintsFile,
  limitations:['Fit uses original cord vertices versus original 26 bone meshes, not CT-segmented neural boundaries.',
    'Cubic height-only shear is globally invertible and has unit determinant as a continuous map; straight triangles between transformed vertices are only an approximation.',
    'All 29 cord pieces use one field; matching coordinates stay matched, but existing gaps/overlaps and nearby fixed neural structures require separate audits.',
    'Numerical margin, support width, coefficient bounds and smoothing weight are not clinical tolerances.',
    'Optional seed is an unweighted source-vertex mean in a 2 mm height band, checked outside this bone; not a verified anatomical canal centre or neural landmark.',
    'Surface-band and ambiguous points are not fitting targets; final triangle, containment, topology and surrounding-tissue checks are required.'],
  files:[...files].map(([file,sha256])=>({file,sha256}))};
fs.writeFileSync(`docs/anatomy-alignment/${tag}-fit.json`,JSON.stringify(report,null,2)+'\n');
fixed.forEach(b=>{b.g.dispose();b.probe.dispose();});
