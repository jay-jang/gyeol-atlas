export function structureForSexId<T extends {id:string;sex:'male'|'female'}>(
  structures:readonly T[],sex:'male'|'female',id:string,
):T|undefined {
  return structures.find(structure=>structure.sex===sex&&structure.id===id);
}
