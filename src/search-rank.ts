// Unified search ranking (docs/review-2026-10-16/CONSENSUS.md G-06). Which
// items match is unchanged from the original filters; this only orders them:
// exact 0 < prefix 1 < substring 2 of a name/code < 3 found elsewhere.
type PointLike = { id: string; name: string; hanja: string; pinyin: string; landmarks: readonly string[] };
type StructureLike = { id: string; name: string; label?: string; fmaId?: string; latin?: string; hierarchy?: readonly string[] };
type GroupLike = { id: string; name: string; ids: readonly string[] };
export type Score = 0 | 1 | 2 | 3;

// "st 36" finds ST36. Structure search keeps the trimmed query, as before.
export const normalizeQuery = (q: string) => q.trim().toLowerCase().replace(/([a-z]+)\s+(\d+)/g, "$1$2");
const plain = (q: string) => q.trim().toLowerCase();
const values = (fields: readonly (string | undefined)[]) => fields.map((value) => (value || "").toLowerCase());
const tier = (fields: readonly (string | undefined)[], q: string): Score => {
  const direct = values(fields);
  return direct.some((v) => v === q) ? 0 : direct.some((v) => v.startsWith(q)) ? 1 : direct.some((v) => v.includes(q)) ? 2 : 3;
};
const pointFields = (p: PointLike) => [p.id, p.name, p.hanja, p.pinyin];
const structureFields = (s: StructureLike) => [s.label, s.name, s.id, s.fmaId];

export function pointScore<T extends PointLike>(p: T, query: string, meridianName: (p: T) => string | undefined): Score | null {
  const q = normalizeQuery(query);
  if (!`${p.id} ${p.name} ${p.hanja} ${p.pinyin} ${p.landmarks.join(" ")} ${meridianName(p)}`.toLowerCase().includes(q)) return null;
  return q ? tier(pointFields(p), q) : 3;
}
export function structureScore(s: StructureLike, query: string): Score | null {
  const q = plain(query);
  if (!q || !`${s.label || ""} ${s.name} ${s.id} ${s.fmaId || ""} ${s.latin || ""} ${(s.hierarchy || []).join(" ")}`.toLowerCase().includes(q)) return null;
  return tier(structureFields(s), q);
}
// Besides today's Korean group name, a group matches its English organ key
// (heart, liver, uterine-tube …; three letters start a prefix match) and any
// member mesh whose code, FMA ID or name is exactly the query, so "stomach",
// "liver" and "FMA7148" open the details "위" and "간" do. Member names are
// not prefix-matched: "위혀구역 폐실질" or "Left …" would list unrelated organs.
export function organScore<S extends StructureLike>(group: GroupLike, query: string, structureById: (id: string) => S | undefined): 0 | 1 | null {
  const q = plain(query), name = group.name.toLowerCase(), key = group.id.toLowerCase().replace(/-/g, " "), spaced = q.replace(/-/g, " ");
  if (!q) return null;
  const member = (id: string) => { const s = structureById(id); return s ? values([s.id, s.fmaId, s.label, s.name]) : []; };
  if (name === q || key === spaced || group.ids.some((id) => member(id).includes(q))) return 0;
  return name.includes(q) || (q.length >= 3 && key.startsWith(spaced)) ? 1 : null;
}

// An empty query keeps every point (the list view); ties keep data order.
export function rankPoints<T extends PointLike>(points: readonly T[], query: string, meridianName: (p: T) => string | undefined): T[] {
  return points.map((p, i) => ({ p, i, score: pointScore(p, query, meridianName) }))
    .filter((r) => r.score !== null).sort((a, b) => a.score! - b.score! || a.i - b.i).map((r) => r.p);
}
// One ordered list, not regrouped by system; ties by displayed name.
export function rankStructures<T extends StructureLike>(structures: readonly T[], query: string): T[] {
  return structures.map((s) => ({ s, score: structureScore(s, query) }))
    .filter((r) => r.score !== null).sort((a, b) => a.score! - b.score! || (a.s.label || a.s.name).localeCompare(b.s.label || b.s.name)).map((r) => r.s);
}
// An empty query lists every group, as the search panel does before typing.
export function matchOrgans<G extends GroupLike, S extends StructureLike>(groups: readonly G[], query: string, structureById: (id: string) => S | undefined): G[] {
  if (!plain(query)) return [...groups];
  return groups.map((g, i) => ({ g, i, score: organScore(g, query, structureById) }))
    .filter((r) => r.score !== null).sort((a, b) => a.score! - b.score! || a.i - b.i).map((r) => r.g);
}

export const isExactPoint = (p: PointLike, query: string) => Boolean(normalizeQuery(query)) && values(pointFields(p)).includes(normalizeQuery(query));
export const isExactStructure = (s: StructureLike, query: string) => Boolean(plain(query)) && values(structureFields(s)).includes(plain(query));
export const isExactOrgan = <S extends StructureLike>(group: GroupLike, query: string, structureById: (id: string) => S | undefined) =>
  organScore(group, query, structureById) === 0;
// Moves exact matches out of a ranked list so the UI shows each row once.
export function splitExact<T>(ranked: readonly T[], isExact: (item: T) => boolean) {
  const exact: T[] = [], rest: T[] = [];
  for (const item of ranked) (isExact(item) ? exact : rest).push(item);
  return { exact, rest };
}
