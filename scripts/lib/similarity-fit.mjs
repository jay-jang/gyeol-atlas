import assert from 'node:assert/strict';
import {Matrix4,Quaternion,Vector3} from 'three';
// Largest algebraic eigenvector of a real symmetric matrix (Jacobi sweeps).
function largestEigenvector(matrix){
  const a=matrix.map(r=>[...r]),v=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>+(i===j)));
  for(let iteration=0;iteration<80;iteration++){
    let p=0,q=1;for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)if(Math.abs(a[i][j])>Math.abs(a[p][q])){p=i;q=j;}
    if(Math.abs(a[p][q])<1e-16)break;
    const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),s=Math.sin(angle);
    const app=a[p][p],aqq=a[q][q],apq=a[p][q];
    for(let k=0;k<4;k++)if(k!==p&&k!==q){const x=a[k][p],y=a[k][q];a[k][p]=a[p][k]=c*x-s*y;a[k][q]=a[q][k]=s*x+c*y;}
    a[p][p]=c*c*app-2*c*s*apq+s*s*aqq;a[q][q]=s*s*app+2*c*s*apq+c*c*aqq;a[p][q]=a[q][p]=0;
    for(let k=0;k<4;k++){const x=v[k][p],y=v[k][q];v[k][p]=c*x-s*y;v[k][q]=s*x+c*y;}
  }
  const best=[0,1,2,3].sort((i,j)=>a[j][j]-a[i][i])[0];return v.map(row=>row[best]);
}
export function fitSimilarity(from,onto){
  assert.ok(from.length>=3&&from.length===onto.length);
  assert.ok([...from,...onto].every(p=>p.toArray().every(Number.isFinite)));
  const mean=p=>p.reduce((s,p)=>s.add(p),new Vector3()).multiplyScalar(1/p.length),a=mean(from),b=mean(onto);
  const m=Array.from({length:3},()=>[0,0,0]);let denominator=0;
  for(let n=0;n<from.length;n++){
    const x=from[n].clone().sub(a).toArray(),y=onto[n].clone().sub(b).toArray();
    for(let i=0;i<3;i++){denominator+=x[i]*x[i];for(let j=0;j<3;j++)m[i][j]+=x[i]*y[j];}
  }
  assert.ok(denominator>0&&Number.isFinite(denominator));
  const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=m;
  const [w,x,y,z]=largestEigenvector([
    [xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],
    [zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]]);
  const q=new Quaternion(x,y,z,w).normalize();let numerator=0;
  for(let n=0;n<from.length;n++)numerator+=from[n].clone().sub(a).applyQuaternion(q).dot(onto[n].clone().sub(b));
  const scale=numerator/denominator;assert.ok(scale>0&&Number.isFinite(scale));
  return new Matrix4().compose(b.clone().sub(a.clone().applyQuaternion(q).multiplyScalar(scale)),q,new Vector3(scale,scale,scale));
}
