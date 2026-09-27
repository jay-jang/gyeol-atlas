import {BufferAttribute,BufferGeometry} from "three";
import registration from "../data/catalog/female-cord-registration.json" with {type:"json"};

const records=new Map(registration.records.map(record=>[record.id,record]));

function cubic(t:number){
  const a=Math.abs(t);
  return a>=2?0:a>=1?(2-a)**3/6:(4-6*a*a+3*a*a*a)/6;
}
function cubicDerivative(t:number){
  const a=Math.abs(t),sign=Math.sign(t);
  return a>=2?0:a>=1?-sign*(2-a)**2/2:sign*(-12*a+9*a*a)/6;
}
export function femaleCordShift(y:number){
  let dx=0,dz=0,dxdy=0,dzdy=0;
  for(const center of registration.centres){
    const t=(y-center)/registration.spacing;
    const weight=cubic(t),slope=cubicDerivative(t)/registration.spacing;
    dx+=weight*registration.dxMetres;dz+=weight*registration.dzMetres;
    dxdy+=slope*registration.dxMetres;dzdy+=slope*registration.dzMetres;
  }
  return {dx,dz,dxdy,dzdy};
}

// Static source-specific geometric correction. View, selection and peel state
// remain in view-state.ts; this never changes geometry on those transitions.
export function applyFemaleCordRegistration(geometry:BufferGeometry,dataset:string,id:string,system:string){
  if(dataset!=="female")return false;
  const record=records.get(id);if(!record)return false;
  if(system!=="nervous")throw new Error(`척수 원본 출처 불일치: ${id}`);
  const version=`${registration.version}/${id}`;
  if(geometry.userData.femaleCordRegistration){
    if(geometry.userData.femaleCordRegistration===version)return false;
    throw new Error(`척수 기하 교정 중복 버전: ${id}`);
  }
  const position=geometry.getAttribute("position"),normal=geometry.getAttribute("normal");
  if(position.count!==record.vertexCount||geometry.getIndex()?.count!==record.indexCount)
    throw new Error(`척수 원본 버전 불일치: ${id}`);
  const p=new Float32Array(position.array),n=normal?new Float32Array(normal.count*3):null;
  for(let i=0;i<position.count;i++){
    const y=position.getY(i),shift=femaleCordShift(y);
    p[3*i]=position.getX(i)+shift.dx;
    p[3*i+2]=position.getZ(i)+shift.dz;
    if(n&&normal){
      const nx=normal.getX(i),ny=normal.getY(i)-shift.dxdy*nx-shift.dzdy*normal.getZ(i),nz=normal.getZ(i);
      const length=Math.hypot(nx,ny,nz)||1;
      n.set([nx/length,ny/length,nz/length],3*i);
    }
  }
  geometry.setAttribute("position",new BufferAttribute(p,3));
  if(n)geometry.setAttribute("normal",new BufferAttribute(n,3));
  geometry.userData.femaleCordRegistration=version;
  return true;
}
