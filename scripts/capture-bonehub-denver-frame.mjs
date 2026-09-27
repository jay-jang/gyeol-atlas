import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {chromium} from '@playwright/test';
const hash = f => createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const out = '.cache/bonehub-denver-frame';
const stages = ['final', 'original'].map(stage => {
  const file = `.cache/bonehub-denver${stage === 'original' ? '-original' : ''}-frame/report.json`;
  const report = JSON.parse(fs.readFileSync(file));
  for (const f of report.files) assert.equal(hash(f.file), f.sha256, f.file);
  const parts = report.records.filter(r => !r.fitLandmark).flatMap(r => {
    const source = report.files.find(f => f.file.endsWith(`/${r.bonehubName}.stl`));
    const suffix = `/VHF_${r.side === 'left' ? 'Left' : 'Right'}_Bone_${r.name}${stage === 'final' ? '_smooth' : ''}.stl`;
    const target = report.files.find(f => f.file.endsWith(suffix));
    assert.ok(source && target);
    return [{...source, kind:'bonehub', side:r.side}, {...target, kind:'denver', side:r.side}];
  });
  return {stage, file, report, parts};
});
const routes = new Map([
  ['/three.module.js', 'node_modules/three/build/three.module.js'],
  ['/three.core.js', 'node_modules/three/build/three.core.js'],
  ['/STLLoader.js', 'node_modules/three/examples/jsm/loaders/STLLoader.js'],
]);
for (const s of stages) for (const [i, p] of s.parts.entries()) {p.url = `/${s.stage}/${i}.stl`; routes.set(p.url, p.file);}
const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Source frame comparison</title><script type="importmap">{"imports":{"three":"/three.module.js"}}</script><body style="margin:0"></body>');
  } else if (routes.has(req.url)) {
    res.setHeader('Content-Type', req.url.endsWith('.js') ? 'text/javascript' : 'application/octet-stream');
    fs.createReadStream(routes.get(req.url)).pipe(res);
  } else {res.writeHead(404);res.end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser; const errors = [], captures = [];
try {
  browser = await chromium.launch({headless:true, args:['--enable-unsafe-swiftshader']});
  const page = await browser.newPage({viewport:{width:1200,height:900}});
  page.on('pageerror', e => errors.push(e.message));
  for (const s of stages) {
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(async ({parts, matrix, stage}) => {
      const T = await import('three'), {STLLoader} = await import('/STLLoader.js');
      const scene = new T.Scene(), renderer = new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
      renderer.setSize(1200,900); renderer.setClearColor('#081d27'); document.body.append(renderer.domElement);
      const display = new T.Matrix4().set(-.001,0,0,0, 0,0,.001,0, 0,.001,0,0, 0,0,0,1);
      const sourceMatrix = new T.Matrix4().fromArray(matrix), loader = new STLLoader();
      scene.add(new T.AmbientLight(0xffffff,2)); const light = new T.DirectionalLight(0xffffff,3);light.position.set(1,2,3);scene.add(light);
      for (const p of parts) {
        const g = loader.parse(await fetch(p.url).then(r => {if(!r.ok)throw Error(p.url);return r.arrayBuffer();}));
        if (p.kind === 'bonehub') g.applyMatrix4(sourceMatrix);
        g.applyMatrix4(display);g.computeVertexNormals();
        const mesh = new T.Mesh(g,new T.MeshStandardMaterial({color:p.kind === 'bonehub'?'#ffa84e':'#48d9ee',transparent:true,opacity:.63,side:T.DoubleSide,depthWrite:false}));
        mesh.userData.side=p.side;scene.add(mesh);
      }
      const label=document.createElement('div');Object.assign(label.style,{position:'absolute',left:'20px',top:'20px',color:'#fff',font:'17px/1.6 sans-serif'});document.body.append(label);
      window.capture = side => {
        const box = new T.Box3();
        for (const o of scene.children) if(o.isMesh){o.visible=o.userData.side===side;if(o.visible)box.expandByObject(o);}
        const center=box.getCenter(new T.Vector3()), radius=box.getSize(new T.Vector3()).length()/2;
        const camera=new T.PerspectiveCamera(30,1200/900,.001,10);
        camera.position.copy(center).add(new T.Vector3(side==='left'?1:-1,.5,1).normalize().multiplyScalar(radius/Math.sin(Math.PI/12)*1.25));camera.lookAt(center);
        label.textContent=`${side} held-out tarsals / Denver ${stage}\nOrange: BoneHub; cyan: Denver. One common source-frame candidate. NOT HRA / NOT APPLIED.`;
        label.style.whiteSpace='pre-line';renderer.render(scene,camera);
        return {position:camera.position.toArray(),target:center.toArray(),visibleMeshes:14};
      };
    }, {parts:s.parts.map(({url,kind,side})=>({url,kind,side})), matrix:s.report.matrixColumnMajor, stage:s.stage});
    for (const side of ['left','right']) {
      const camera=await page.evaluate(side=>window.capture(side), side);
      const file=`${out}/${s.stage}-${side}.png`;await page.screenshot({path:file});captures.push({stage:s.stage,side,file,sha256:hash(file),camera});
    }
  }
  assert.deepEqual(errors,[]);
} finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
fs.writeFileSync(`${out}/visual.json`, JSON.stringify({status:'Held-out source surface comparison, not app or clinical validation',captures,errors,
  files:[...stages.map(s=>s.file),'scripts/capture-bonehub-denver-frame.mjs'].map(file=>({file,sha256:hash(file)}))},null,2)+'\n');
console.log(JSON.stringify({captures:captures.length,errors}));
