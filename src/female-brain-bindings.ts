import spec from '../data/catalog/female-brain-bindings.json' with {type:'json'};
export const femaleBrainBindings=spec;
const records=new Map(spec.records.map(r=>[r.id,r]));

// A source-version-specific selection correction, never a spatial transform.
// Keep each source part's position, normal and index buffers together.
export function resolveFemaleBrainGeometryPart<T extends {id:string;name:string;system:string}>(part:T,dataset:string,parts:Map<string,T>):T{
  if(dataset!=='female')return part;
  const record=records.get(part.id);
  if(!record){
    if(part.system==='brain'&&(part.id!=='HRAF0070'||part.name!=='Optic chiasm'))throw new Error(`미검증 뇌 좌우 연결: ${part.id}`);
    return part;
  }
  const partner=parts.get(record.partnerId);
  if(part.system!=='brain'||part.name!==record.name||!partner||partner.system!=='brain'||partner.name!==record.partnerName)
    throw new Error(`뇌 좌우 연결 원본 불일치: ${part.id}`);
  return partner;
}

export async function verifyFemaleBrainManifest(dataset:string,text:string){
  if(dataset!=='female')return;
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==spec.atlasSha256)throw new Error('여성 뇌 좌우 연결의 원본 버전이 다릅니다. 재검증이 필요합니다.');
}
