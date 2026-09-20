type Structure = {id:string;group?:string};
type Group = {id:string;sex:string;ids:string[]};

// A link to a different source is not permission to merge its coordinates
// into a whole-body comparison. Alternatives require an explicit UI choice.
const femaleAlternatives: Record<string,string> = {stomach:"stomach-ct"};
export function comparisonReference(sex:"male"|"female", ids:string[], structures:Structure[], groups:Group[]) {
  if (sex === "male") return {overviewIds:[...ids],separateGroupIds:[] as string[]};
  const requested = [...new Set(ids.map(id=>structures.find(s=>s.id===id)?.group).filter((g):g is string=>Boolean(g)))];
  const native = requested.map(id=>groups.find(g=>g.sex==="female"&&g.id===id));
  const complete = ids.length>0 && ids.every(id=>structures.some(s=>s.id===id&&s.group)) && native.every(Boolean);
  return {
    overviewIds:complete ? [...new Set(native.flatMap(g=>g!.ids))] : [],
    separateGroupIds:requested.filter((_,i)=>!native[i]).flatMap(id=>{
      const alternative=femaleAlternatives[id];
      return alternative&&groups.some(g=>g.sex==="female"&&g.id===alternative) ? [alternative] : [];
    }),
  };
}
