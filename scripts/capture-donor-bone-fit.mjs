// Standalone diagnostic renderer: source STL vs packed native HRA femur.
// Does not load or change application state or export runtime geometry.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {BufferGeometry,BufferAttribute,Matrix4,Vector3} from 'three';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {MeshBVH} from 'three-mesh-bvh';
import {referencedVertices} from './lib/surface-containment.mjs';
import {chromium} from '@playwright/test';

const root=process.argv[2];assert.ok(root,'Pass extracted STL directory');
const hierarchyTargets=process.argv.includes('--hierarchy-targets');
for(const arg of process.argv.slice(3))assert.equal(arg,'--hierarchy-targets');
const read=file=>JSON.parse(fs.readFileSync(file));
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source=read('docs/anatomy-alignment/donor-source-comparison.json');
const fitFile=`docs/anatomy-alignment/${hierarchyTargets?'hierarchy-':''}joint-bone-surface-fits.json`;
const fits=read(fitFile);
const atlas=read('public/models/female/atlas-female.json');
for(const f of read('data/catalog/female-atlas-source.json').files)assert.equal(hash(f.path),f.sha256);
const out=`.cache/joint-bone-visual${hierarchyTargets?'/hierarchy':''}`;fs.mkdirSync(out,{recursive:true});
const parts=[],measurements=[];
for(const side of ['left','right']){
  const file=source.files.find(f=>f.side===side&&f.kind==='bone'&&f.structure==='Femur');
  assert.equal(hash(path.join(root,file.file)),file.sha256);
  const bytes=fs.readFileSync(path.join(root,file.file));
  const raw=new STLLoader().parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  raw.scale(.001,.001,.001);raw.deleteAttribute('normal');
  const donor=mergeVertices(raw,1e-8);raw.dispose();
  donor.applyMatrix4(new Matrix4().fromArray(fits.fits.find(f=>f.side===side&&f.mode==='thigh').sourceToAtlasMatrix));
  const p=atlas.parts.find(p=>p.name===`Femur (${side})`);
  const members=hierarchyTargets?fits.targetMembership.targets.find(t=>t.side===side&&t.bone==='Femur').members:[p];
  const geometries=members.map(m=>{
    const part=atlas.parts.find(p=>p.id===m.id),packed=gunzipSync(fs.readFileSync(`public/models/female/${atlas.chunks[part.chunk].gzip.split('/').pop()}`));
    const g=new BufferGeometry();
    g.setAttribute('position',new BufferAttribute(Float32Array.from({length:part.vertexCount*3},(_,i)=>packed.readFloatLE(part.positions+4*i)),3));
    g.setIndex(new BufferAttribute(Uint32Array.from({length:part.indexCount},(_,i)=>packed.readUInt32LE(part.indices+4*i)),1));return g;
  });
  const target=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
  target.boundsTree=new MeshBVH(target);
  const point=new Vector3(),far=[];let max;
  for(const i of referencedVertices(donor,Infinity)){
    point.fromBufferAttribute(donor.attributes.position,i);
    const nearest=target.boundsTree.closestPointToPoint(point),distanceMm=nearest.distance*1000;
    const record={vertex:i,pointMetres:point.toArray(),nearestMetres:nearest.point.toArray(),distanceMm};
    if(!max||max.distanceMm<distanceMm)max=record;
    if(distanceMm>10)far.push(record);
  }
  const bound=points=>[0,1,2].map(axis=>[Math.min(...points.map(p=>p.pointMetres[axis])),Math.max(...points.map(p=>p.pointMetres[axis]))]);
  const row={side,id:p.id,targetIds:members.map(m=>m.id),source:file.file,sourceSha256:file.sha256,vertices:referencedVertices(donor,Infinity).length,over10mm:far.length,over10mmBounds:far.length?bound(far):null,maximum:max};
  if(hierarchyTargets){
    const previous=read('.cache/joint-bone-visual/report.json').measurements.find(m=>m.side===side).maximum;
    row.previousWitnessWithSameCoordinates={...previous,compositeDistanceMm:target.boundsTree.closestPointToPoint(new Vector3(...previous.pointMetres)).distance*1000};
  }
  measurements.push(row);
  for(const [kind,g] of [['donor',donor],['target',target]])parts.push({side,kind,positions:Array.from(g.attributes.position.array),indices:Array.from(g.index.array)});
  donor.dispose();target.dispose();
}
// Serve only a blank diagnostic page and Three's two ESM files on loopback.
const server=http.createServer((req,res)=>{
  const allowed={'/three.module.js':'node_modules/three/build/three.module.js','/three.core.js':'node_modules/three/build/three.core.js'};
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><title>Bone fit diagnostic</title></head><body style="margin:0"></body></html>');}
  else if(allowed[req.url]){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync(allowed[req.url]));}
  else{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;const captures=[],errors=[];
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async parts=>{
    const T=await import('/three.module.js');
    const scene=new T.Scene(),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(1200,1000);renderer.setClearColor('#071820');document.body.append(renderer.domElement);
    scene.add(new T.AmbientLight(0xffffff,2));const light=new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
    const camera=new T.PerspectiveCamera(30,1.2,.001,10);
    for(const p of parts){
      const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(p.positions),3));g.setIndex(p.indices);g.computeVertexNormals();
      const m=new T.Mesh(g,new T.MeshStandardMaterial({color:p.kind==='donor'?'#ff9540':'#35cbed',wireframe:p.kind==='donor',side:T.DoubleSide}));
      m.userData={side:p.side,kind:p.kind};scene.add(m);
    }
    window.diagnostic={T,scene,renderer,camera};
  },parts);
  for(const side of ['left','right'])for(const view of ['anterior','lateral']){
    const png=await page.evaluate(({side,view})=>{
      const {T,scene,renderer,camera}=window.diagnostic,box=new T.Box3();
      for(const m of scene.children)if(m.isMesh){m.visible=m.userData.side===side;if(m.visible)box.expandByObject(m);}
      const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),distance=size.length()/2/Math.sin(camera.fov*Math.PI/360)*1.12;
      camera.position.copy(center).add(view==='anterior'?new T.Vector3(0,0,distance):new T.Vector3(side==='left'?distance:-distance,0,0));camera.lookAt(center);renderer.render(scene,camera);
      return renderer.domElement.toDataURL('image/png').split(',')[1];
    },{side,view});
    const file=`${out}/femur-${side}-${view}.png`;fs.writeFileSync(file,Buffer.from(png,'base64'));captures.push({side,view,file,sha256:hash(file)});
  }
  assert.deepEqual(errors,[]);
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
const report={status:'DIAGNOSTIC ONLY; independently fitted source donor femur vs packed HRA target; not app UI or runtime correction',hierarchyTargets,colorKey:{donor:'orange wireframe',target:'cyan solid'},measurements,captures,errors,provenance:['scripts/capture-donor-bone-fit.mjs',fitFile,'public/models/female/atlas-female.json'].map(file=>({file,sha256:hash(file)}))};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
