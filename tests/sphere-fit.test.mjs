import test from 'node:test';
import assert from 'node:assert/strict';
import {fitSphere} from '../scripts/lib/sphere-fit.mjs';
const points=(centre,radius)=>Array.from({length:300},(_,i)=>{const z=1-2*(i+.5)/300,t=i*2.399963229728653,xy=Math.sqrt(1-z*z);return [xy*Math.cos(t),xy*Math.sin(t),z].map((v,k)=>centre[k]+radius*v);});
test('sphere fitting recovers translated scales without mistaking coordinates for a radius',()=>{for(const [c,r] of [[[.4,.8,-.2],.022],[[500,1000,-100],20]]){const fit=fitSphere(points(c,r));assert.ok(Math.hypot(...fit.centre.map((v,k)=>v-c[k]))<1e-8);assert.ok(Math.abs(fit.radius-r)<1e-8);assert.ok(fit.residual.maximumMm<1e-5);}});
test('a nonplanar spherical cap still recovers its centre, while planar inputs fail',()=>{const c=[.4,.6,.2],r=.025,fit=fitSphere(points(c,r).filter(p=>p[2]>c[2]+r*.3));assert.ok(Math.hypot(...fit.centre.map((v,k)=>v-c[k]))<1e-8);assert.throws(()=>fitSphere([[0,0,0],[1,0,0],[0,1,0],[1,1,0]]));assert.throws(()=>fitSphere([[NaN,0,0],[1,0,0],[0,1,0],[1,1,1]]));});
test('non-spherical surfaces retain nonzero residuals rather than claiming anatomical validation',()=>{const p=points([0,0,0],.02).map(p=>[p[0]*1.2,p[1],p[2]]),r=fitSphere(p);assert.ok(r.residual.rmsMm>.5);assert.ok(r.history.every(h=>Number.isFinite(h.rmsMetres)));});
