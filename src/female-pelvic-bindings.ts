import spec from '../data/catalog/female-pelvic-bindings.json' with {type:'json'};
import brainBindings from '../data/catalog/female-brain-bindings.json' with {type:'json'};

export const femalePelvicBindings=spec;
const records=new Map(spec.records.map(record=>[record.id,record]));

export function pelvicStructureDisplay<T extends {id:string;name:string;sex:string}>(part:T):T & {label?:string;description?:string}{
  const record=part.sex==='female' ? records.get(part.id) : undefined;
  if(!record)return part;
  if(part.name!==record.name)throw new Error(`여성 골반 좌우 표기 원본 불일치: ${part.id}`);
  return {...part,label:record.label,
    description:`${record.name} · 여성 HRA 원본에서 이 한 쌍의 좌우 표기가 주변 난소·자궁주인대와 반대입니다. 원문 ID·영문 이름은 유지하고 반대쪽 원본 ${record.partnerId} (${record.partnerName}) 형상을 연결했습니다. 자궁 부착·주행과 다른 장기의 위치 검증은 미완료입니다.`};
}

// The source GLB itself labels these two complete one-sided meshes opposite
// to the rest of its female pelvis. Exchange existing buffers, never mirror or
// deform them; retain the official concept IDs and English names for search.
export function resolveFemalePelvicGeometryPart<T extends {id:string;name:string;system:string}>(part:T,dataset:string,parts:Map<string,T>):T{
  if(dataset!=='female')return part;
  const record=records.get(part.id);
  if(!record)return part;
  const partner=parts.get(record.partnerId);
  if(part.system!=='reproductive'||part.name!==record.name||!partner||partner.system!=='reproductive'||partner.name!==record.partnerName)
    throw new Error(`여성 골반 좌우 연결 원본 불일치: ${part.id}`);
  return partner;
}

export function verifyFemalePelvicManifestVersion(dataset:string){
  if(dataset==='female'&&spec.atlasSha256!==brainBindings.atlasSha256)
    throw new Error('여성 골반 좌우 연결의 원본 버전이 다릅니다. 재검증이 필요합니다.');
}
