import {BufferAttribute,BufferGeometry} from "three";
import restoration from "../data/catalog/female-knee-source-restoration.json" with {type:"json"};

export const femaleKneeSourceRestoration=restoration;
const records=new Map(restoration.records.map(record=>[record.id,record]));

// A native-source fidelity patch, not an anatomical registration. Disjoint
// from the earlier ilium patch; applied once before any view-state rendering.
export function applyFemaleKneeSourceRestoration(geometry:BufferGeometry,dataset:string,id:string,system:string,buffer:ArrayBuffer|null){
  if(dataset!=="female")return false;
  const record=records.get(id);if(!record)return false;
  if(system!==record.system)throw new Error(`무릎 원본 출처 불일치: ${id}`);
  const version=`${restoration.version}/${id}`;
  if(geometry.userData.femaleKneeSourceRestoration){
    if(geometry.userData.femaleKneeSourceRestoration===version)return false;
    throw new Error(`무릎 원본 중복 버전: ${id}`);
  }
  if(!buffer||buffer.byteLength!==restoration.bytes)throw new Error(`무릎 원본 파일 크기 오류: ${id}`);
  if(geometry.getAttribute("position").count!==record.originalVertexCount||geometry.getIndex()?.count!==record.originalIndexCount)throw new Error(`무릎 원본 기준 모형 불일치: ${id}`);
  geometry.setAttribute("position",new BufferAttribute(new Float32Array(buffer,record.positions,record.vertexCount*3),3));
  geometry.setAttribute("normal",new BufferAttribute(new Float32Array(buffer,record.normals,record.vertexCount*3),3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(buffer,record.indices,record.indexCount),1));
  geometry.userData.femaleKneeSourceRestoration=version;return true;
}
