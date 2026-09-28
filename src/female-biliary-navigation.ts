import groups from '../data/female-biliary-groups.json' with {type:'json'};

export const femaleBiliaryGroups=groups;
const groupById=new Map(groups.flatMap(group=>group.ids.map(id=>[id,group] as const)));

// A view-only label and scope; the pinned HRA source catalog and geometry stay
// unchanged. Its four members are independently named in the source concepts.
export function femaleBiliaryDisplay<T extends {id:string;sex:string;group?:string;hierarchy?:string[];label?:string}>(structure:T):T {
  if(structure.sex!=='female'||structure.group)return structure;
  const group=groupById.get(structure.id);
  if(!group)return structure;
  return {...structure,group:group.id,label:group.labels[structure.id as keyof typeof group.labels],
    hierarchy:[...(structure.hierarchy||[]),group.name,group.id]};
}
