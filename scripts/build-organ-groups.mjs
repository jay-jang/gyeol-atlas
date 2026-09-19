import fs from "node:fs";
const inputs = JSON.parse(fs.readFileSync("scripts/model-inputs.json")).assets;
const graph = new Map();
for (const file of ["conventional_part_of.txt", "composite_parts.txt"]) {
  for (const line of fs.readFileSync(`data/catalog/${file}`, "utf8").split("\n").slice(1)) {
    const [parent, , child] = line.trim().split("\t");
    if (!parent || !child) continue;
    graph.set(parent, [...(graph.get(parent) || []), child]);
  }
}
function descendants(root, found = new Set()) {
  if (found.has(root)) return found;
  found.add(root);
  for (const child of graph.get(root) || []) descendants(child, found);
  return found;
}
const definitions = [
  ["brain", "뇌", ["FMA50801"], ["FMA62004", "FMA67943", "FMA67944", "FMA61822", "FMA61993nsn"]],
  ["heart", "심장", ["FMA7088"], ["FMA7274"]],
  ["lung", "폐", ["FMA7195"], ["FMA7383", "FMA7333", "FMA7337", "FMA7370", "FMA7371"]],
  ["liver", "간", ["FMA7197"], ["FMA7197"]],
  ["stomach", "위", ["FMA7148"], ["FMA7148"]],
  ["kidney", "콩팥", ["FMA7203"], ["FMA7204", "FMA7205"]],
  ["pancreas", "췌장", ["FMA7198"], ["FMA7198nsn", "FMA10419"]],
  ["spleen", "비장", ["FMA7196"], ["FMA7196"]],
  ["bladder", "방광", ["FMA15900"], ["FMA15900"]],
];
const groups = definitions.map(([id, name, sourceConcepts, overviewIds]) => {
  const all = new Set(sourceConcepts.flatMap(root => [...descendants(root)]));
  const ids = [...new Set([...overviewIds, ...inputs.filter(item => all.has(item.id) || all.has(item.id.replace(/nsn$/, ""))).map(item => item.id)])];
  return { id, name, sex: "male", sourceConcepts, ids, overviewIds };
});
fs.writeFileSync("data/male-organ-groups.json", JSON.stringify(groups, null, 2) + "\n");
console.log(groups.map(g => `${g.name}: ${g.ids.length}`).join(", "));
