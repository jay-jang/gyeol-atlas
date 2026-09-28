import type {Layer} from './anatomy';

export const packedSystemLayer: Record<string,Layer> = {
  integumentary: 'skin', muscular: 'muscle', 'donor-muscle': 'muscle',
  skeletal: 'bone', borrowed: 'bone', connective: 'bone',
  digestive: 'organ', respiratory: 'organ', urinary: 'organ', reproductive: 'organ', pregnancy: 'organ', cardiac: 'organ',
  arterial: 'vessel', venous: 'vessel', lymphatic: 'lymph',
  brain: 'nerve', nervous: 'nerve', sensory: 'nerve',
};

type PackedPart = {id:string;system:string};
type CatalogPart = {id:string;sex:'male'|'female';layer:Layer};

// Validate before downloading geometry. A source-frame name or a plausible
// system label must never make an unknown or other-sex mesh renderable.
export function verifyPackedSourceManifest(
  source:string,sex:'male'|'female',parts:readonly PackedPart[],catalog:ReadonlyMap<string,CatalogPart>,
):void {
  const allowed=sex==='female' ? ['female','female-detail'] : ['male-detail'];
  if(!allowed.includes(source))throw new Error(`참조 모형 성별·출처 불일치: ${sex}/${source}`);
  if(!parts.length)throw new Error(`빈 참조 모형 목록: ${source}`);
  const seen=new Set<string>();
  for(const part of parts){
    if(seen.has(part.id))throw new Error(`참조 모형 ID 중복: ${source}/${part.id}`);
    seen.add(part.id);
    const record=catalog.get(part.id),expectedLayer=packedSystemLayer[part.system];
    if(!record||record.sex!==sex||!expectedLayer||record.layer!==expectedLayer)
      throw new Error(`참조 모형 성별·계통 불일치: ${source}/${part.id}/${part.system}`);
  }
}
