import counterpartData from "../data/female-comparison-counterparts.json" with {type:"json"};
type Structure = {id:string;group?:string};
type Group = {id:string;sex:string;ids:string[]};

// A link to a different source is not permission to merge its coordinates
// into a whole-body comparison. Alternatives require an explicit UI choice.
const femaleAlternatives: Record<string,string> = {stomach:"stomach-ct"};
// Male meshes without an organ group map to the same scope in a female group.
const counterparts: Record<string,{group:string;ids?:string[]}> = counterpartData.counterparts;
export function comparisonReference(sex:"male"|"female", ids:string[], structures:Structure[], groups:Group[]) {
  if (sex === "male") return {overviewIds:[...ids],separateGroupIds:[] as string[]};
  const requested = [...new Set(ids.map(id=>structures.find(s=>s.id===id)?.group).filter((g):g is string=>Boolean(g)))];
  const native = requested.map(id=>groups.find(g=>g.sex==="female"&&g.id===id));
  const female = (id:string) => groups.find(g=>g.sex==="female"&&g.id===counterparts[id]?.group);
  const resolved = ids.map(id=>structures.some(s=>s.id===id&&s.group) || Boolean(female(id)));
  const complete = ids.length>0 && resolved.every(Boolean) && native.every(Boolean);
  const matched = () => ids.filter(id=>!structures.some(s=>s.id===id&&s.group)).flatMap(id=>counterparts[id].ids ?? female(id)!.ids);
  return {
    overviewIds:complete ? [...new Set([...native.flatMap(g=>g!.ids),...matched()])] : [],
    // A separate CT detail stays offered even where a carried overview organ exists.
    separateGroupIds:requested.flatMap(id=>{
      const alternative=femaleAlternatives[id];
      return alternative&&groups.some(g=>g.sex==="female"&&g.id===alternative) ? [alternative] : [];
    }),
  };
}
