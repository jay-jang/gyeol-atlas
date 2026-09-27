import {BufferAttribute,BufferGeometry} from "three";
import restoration from "../data/catalog/female-source-restoration.json" with {type:"json"};

export const femaleSourceRestoration = restoration;
const records=new Map(restoration.records.map(record=>[record.id,record]));

// Restore the pinned native HRA surface once at load time. No registration,
// selection, clipping or peel control path is introduced here.
export function applyFemaleSourceRestoration(geometry:BufferGeometry,dataset:string,id:string,system:string,buffer:ArrayBuffer|null){
  if(dataset!=="female")return false;
  const record=records.get(id);if(!record)return false;
  if(system!==record.system)throw new Error(`원본 복원 출처 불일치: ${id}`);
  const version=`${restoration.version}/${id}`;
  if(geometry.userData.femaleSourceRestoration){
    if(geometry.userData.femaleSourceRestoration===version)return false;
    throw new Error(`원본 복원 중복 버전: ${id}`);
  }
  if(!buffer||buffer.byteLength!==restoration.bytes)throw new Error(`원본 복원 파일 크기 오류: ${id}`);
  if(geometry.getAttribute("position").count!==record.originalVertexCount||geometry.getIndex()?.count!==record.originalIndexCount)
    throw new Error(`원본 복원 기준 모형 불일치: ${id}`);
  geometry.setAttribute("position",new BufferAttribute(new Float32Array(buffer,record.positions,record.vertexCount*3),3));
  geometry.setAttribute("normal",new BufferAttribute(new Float32Array(buffer,record.normals,record.vertexCount*3),3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(buffer,record.indices,record.indexCount),1));
  geometry.userData.femaleSourceRestoration=version;
  return true;
}
