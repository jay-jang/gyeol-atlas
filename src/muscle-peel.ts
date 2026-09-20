import { musclePeelRelations } from "./muscle-peel-relations.ts";

export type MusclePeelInput = { id: string; score: number };
// Unknown relations retain a geometric ordering estimate. Known outer muscles
// finish fading before the corresponding inner muscle starts to peel.
// This does not move vertices, infer missing muscles or measure tissue depth.
export function musclePeelRanks(input: readonly MusclePeelInput[], relations = musclePeelRelations) {
  const sorted = [...input].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const ids = new Set(sorted.map(item => item.id));
  if (ids.size !== input.length || input.some(item => !Number.isFinite(item.score))) throw new Error("Invalid muscle peel inputs");
  const children = new Map(sorted.map(item => [item.id, new Set<string>()]));
  const parents = new Map(sorted.map(item => [item.id, new Set<string>()]));
  for (const [outer, inner] of relations) {
    // Other sexes and separate detail datasets are intentionally absent.
    if (!ids.has(outer) || !ids.has(inner)) continue;
    children.get(outer)!.add(inner); parents.get(inner)!.add(outer);
  }
  const pending = new Map([...parents].map(([id, set]) => [id, set.size]));
  const ordered: string[] = [];
  while (ordered.length < sorted.length) {
    const next = sorted.find(item => pending.get(item.id) === 0);
    if (!next) throw new Error("Cyclic muscle peel relations");
    ordered.push(next.id); pending.set(next.id, -1);
    for (const child of children.get(next.id)!) pending.set(child, pending.get(child)! - 1);
  }
  const below = new Map<string, number>();
  for (const id of [...ordered].reverse()) below.set(id, Math.max(0, ...[...children.get(id)!].map(child => 1 + below.get(child)!)));
  if ([...below.values()].some(value => value > 9)) throw new Error("Muscle relation chain exceeds the display interval");
  const baseline = new Map(sorted.map((item, index) => [item.id, 24 + index / Math.max(1, sorted.length - 1) * 36]));
  const starts = new Map<string, number>();
  for (const id of ordered) {
    const lower = Math.max(24, ...[...parents.get(id)!].map(parent => starts.get(parent)! + 4));
    const upper = 60 - below.get(id)! * 4;
    const start = Math.round(Math.max(lower, Math.min(upper, baseline.get(id)!)) * 2) / 2;
    starts.set(id, start);
  }
  return new Map([...starts].map(([id, start]) => [id, (start - 24) / 36]));
}
