import assert from 'node:assert/strict';

// C2 compact cubic B-splines. A height-only X/Z translation has the exact
// inverse (x-dx(y), y, z-dz(y)); det DF=1. Stored triangle approximations are
// separate and do not inherit a blanket no-intersection guarantee.
export function cubicWeight(t){
  const a=Math.abs(t);return a>=2?0:a>=1?(2-a)**3/6:(4-6*a*a+3*a*a*a)/6;
}
export function shearBasis(y,centres,spacing){return centres.map(c=>cubicWeight((y-c)/spacing));}
export function shearPoint(point,field,inverse=false){
  const weights=shearBasis(point[1],field.centres,field.spacing),sign=inverse?-1:1;
  return [point[0]+sign*weights.reduce((s,w,i)=>s+w*field.coefficients[2*i],0),point[1],
    point[2]+sign*weights.reduce((s,w,i)=>s+w*field.coefficients[2*i+1],0)];
}

// Hildreth dual coordinate updates: minimize c' H c / 2 subject to A c >= b.
// Return convergence diagnostics; a sweep limit is NOT a successful fit.
export function minimumQuadraticInequalities(H,constraints,{sweeps=2000,tolerance=1e-9}={}){
  const n=H.length;assert.ok(n>0&&H.every(r=>r.length===n&&r.every(Number.isFinite)));
  const augmented=H.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)]);
  for(let i=0;i<n;i++){
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(augmented[j][i])>Math.abs(augmented[pivot][i]))pivot=j;
    [augmented[i],augmented[pivot]]=[augmented[pivot],augmented[i]];const d=augmented[i][i];assert.ok(Math.abs(d)>1e-14);
    for(let k=0;k<2*n;k++)augmented[i][k]/=d;
    for(let j=0;j<n;j++)if(j!==i){const f=augmented[j][i];for(let k=0;k<2*n;k++)augmented[j][k]-=f*augmented[i][k];}
  }
  const inv=augmented.map(r=>r.slice(n)),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const rows=constraints.map(({a,b})=>{assert.equal(a.length,n);assert.ok(a.every(Number.isFinite)&&Number.isFinite(b));const v=inv.map(r=>dot(r,a)),denom=dot(a,v);assert.ok(denom>1e-14);return {a,b,v,denom,lambda:0};});
  const c=Array(n).fill(0);let maximumViolation=Infinity,maximumUpdate=Infinity,iteration=0;
  for(;iteration<sweeps;iteration++){
    maximumUpdate=0;
    for(const r of rows){const next=Math.max(0,r.lambda+(r.b-dot(r.a,c))/r.denom),delta=next-r.lambda;r.lambda=next;
      for(let i=0;i<n;i++){const change=delta*r.v[i];c[i]+=change;maximumUpdate=Math.max(maximumUpdate,Math.abs(change));}
    }
    maximumViolation=Math.max(0,...rows.map(r=>r.b-dot(r.a,c)));
    if(maximumViolation<=tolerance&&maximumUpdate<=tolerance){iteration++;break;}
  }
  return {coefficients:c,sweeps:iteration,maximumViolation,maximumUpdate,converged:maximumViolation<=tolerance&&maximumUpdate<=tolerance};
}
