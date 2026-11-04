import concepts from '../data/concepts.json' with { type: 'json' };
import conceptData from '../data/point-concepts.json' with { type: 'json' };
import theoryData from '../data/acupoint-theory.json' with { type: 'json' };
import meridians from '../data/meridians.json' with { type: 'json' };
import { comparisonReference } from './comparison-reference.ts';
import type { Point } from './types';

export type MarkerColorMode = 'meridian' | 'category' | 'organ';
const pointConcepts = conceptData as Record<string, { categories: string[]; traditionalChannel: string | null; traditionalName: string | null; organIds: string[]; shuType: string | null }>;
const theory = theoryData as Record<string, { traditionalOrgan: string | null; xiMeridian: string | null }>;
export const organChoices = meridians.filter(m => !['CV', 'GV', 'EX'].includes(m.id)).map(m => ({
  id: m.id, name: theory[`${m.id}1`].traditionalOrgan!, color: m.color,
}));
export const isOrganChoice = (id: string) => organChoices.some(o => o.id === id);
// 신(腎) reads like 신경 (nerve) on its own; the other names stay plain.
export const organLabel = (id: string) => id === 'KI' ? '신(腎)' : organChoices.find(o => o.id === id)?.name ?? id;
export const UNASSIGNED_COLOR = '#a9bcc5';
// A Mu or Back-Shu relation is independent of the point's own channel.
// Return the explicit relation first for colour, preserving both for filtering.
export function pointOrgans(point: Pick<Point, 'id' | 'meridian'>): string[] {
  const c = pointConcepts[point.id];
  return [...new Set([c?.traditionalChannel, organChoices.some(o => o.id === point.meridian) ? point.meridian : null]
    .filter((id): id is string => Boolean(id)))];
}
export const pointCategories = (id: string) => concepts.filter(c => pointConcepts[id]?.categories.includes(c.id));
export function organText(point: Pick<Point, 'id' | 'meridian'>): string {
  const ids = pointOrgans(point), direct = pointConcepts[point.id]?.traditionalChannel;
  return ids.map(id => `${organChoices.find(o => o.id === id)!.name}(${id === direct && pointCategories(point.id).some(c => ['mu', 'back-shu'].includes(c.id)) ? '분류 대응' : '소속 경맥'})`).join(' · ') || '장부 배속 없음';
}
export function pointColor(point: Pick<Point, 'id' | 'meridian'>, mode: MarkerColorMode, category = 'all', organ = 'all'): string {
  if (mode === 'category') {
    const categories = pointCategories(point.id);
    return (categories.find(c => c.id === category) || categories[0])?.color || UNASSIGNED_COLOR;
  }
  if (mode === 'organ') {
    const ids = pointOrgans(point);
    return organChoices.find(o => o.id === (ids.includes(organ) ? organ : ids[0]))?.color || UNASSIGNED_COLOR;
  }
  return meridians.find(m => m.id === point.meridian)?.color || UNASSIGNED_COLOR;
}

export const xiMeridian = (id: string) => theory[id]?.xiMeridian || null;

// A zang-fu's own special points by class (Q44): its source, connecting,
// xi-cleft and five-shu points lie on its channel; its front-mu and back-shu
// points are the ones explicitly assigned to it. The four extra-vessel xi
// points (KI8, BL59, KI9, GB35) belong to their vessels, not to the zang-fu of
// the channel they lie on.
const ownedBy = (point: Pick<Point, 'id' | 'meridian'>, organ: string, category: string) => {
  const c = pointConcepts[point.id];
  if (!c?.categories.includes(category)) return false;
  if (category === 'mu' || category === 'back-shu') return c.traditionalChannel === organ;
  if (category === 'xi') return point.meridian === organ && !theory[point.id]?.xiMeridian;
  return point.meridian === organ;
};
// Five-shu points read in their traditional order 정·형·수·경·합.
const shuOrder = (id: string) => '정형수경합'.indexOf(pointConcepts[id]?.shuType?.[0] ?? '');
export function organClassPoints<P extends Pick<Point, 'id' | 'meridian'>>(organ: string, list: readonly P[]) {
  if (!isOrganChoice(organ)) return [];
  return concepts.map(concept => {
    const points = list.filter(p => ownedBy(p, organ, concept.id));
    return { concept, points: concept.id === 'five-shu' ? points.sort((a, b) => shuOrder(a.id) - shuOrder(b.id)) : points };
  }).filter(g => g.points.length);
}
// SP21 is the spleen's great connecting point (비의 대락, the 15th luo in
// data/concepts.json), named apart from its channel luo SP4.
export const luoNote = (id: string) => id === 'SP21' ? '비의 대락' : '';
// What a point is also found by besides its name and code (Q46): whole class
// words (원혈, 原穴, 배수혈, 락혈; the five-shu type 정혈·형혈·수혈·합혈 only on
// that point, so 수혈 is never 배수혈 or every 오수혈; 경혈 is the generic word
// and is left out), the related zang-fu by its exact name (심 is not 심포) and
// an extra vessel's name. A class word may be typed partly (원 → 원혈).
const classWords = (id: string) => [
  ...pointCategories(id).flatMap(c => [...c.name.split(/[()]/), c.hanja]),
  ...(pointConcepts[id]?.shuType ? [pointConcepts[id].shuType!] : []).flatMap(t => t[0] === '경' ? [] : [`${t[0]}혈`, `${t[2]}穴`]),
].filter(Boolean);
export function pointTermsMatch(point: Pick<Point, 'id' | 'meridian'>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return classWords(point.id).some(w => w.startsWith(q))
    || pointOrgans(point).some(id => organChoices.find(o => o.id === id)!.name === q)
    || Boolean(xiMeridian(point.id)?.startsWith(q));
}
// 원·모·유·극·락: the points a zang-fu view names on the body.
export const KEY_CLASSES = ['yuan', 'mu', 'back-shu', 'xi', 'luo'];
export const organKeyPointIds = (organ: string, list: readonly Pick<Point, 'id' | 'meridian'>[]) =>
  organClassPoints(organ, list).filter(g => KEY_CLASSES.includes(g.concept.id)).flatMap(g => g.points.map(p => p.id));

// Which zang-fu an anatomical organ view stands for: the meshes the
// traditional comparison of that zang-fu uses (comparison-reference.ts), or
// else their organ group: an opened detail, or the group of one picked mesh
// when that group is a single organ concept (the whole heart FMA7088, not a
// rectum inside the two-concept female intestine). The exact meshes win, so a
// colon part is the large intestine alone while the whole female intestine is
// both. The pericardium and triple burner have no organ mesh and never match;
// nothing is inferred from position.
type ScopeStructure = { id: string; group?: string };
type ScopeGroup = { id: string; sex: string; ids: string[]; sourceConcepts?: string[] | readonly string[] };
// The male 4.3 lung detail names the right and left lung (FMA7309, FMA7310);
// both are the one organ concept lung (FMA7195) of the overview group.
const ORGAN_CONCEPT: Record<string, string> = { FMA7309: 'FMA7195', FMA7310: 'FMA7195' };
const oneOrgan = (group?: ScopeGroup) => new Set((group?.sourceConcepts ?? []).map(c => ORGAN_CONCEPT[c] ?? c)).size === 1;
const organIdsOf = (organ: string) =>
  Object.values(pointConcepts).find(c => c.categories.includes('yuan') && c.traditionalChannel === organ)?.organIds ?? [];
export function organScopes(sex: 'male' | 'female', structures: ScopeStructure[], groups: ScopeGroup[]) {
  return organChoices.flatMap(o => {
    const organIds = organIdsOf(o.id);
    if (!organIds.length) return [];
    const { overviewIds, separateGroupIds } = comparisonReference(sex, organIds, structures, groups);
    const groupOf = (id: string) => structures.find(s => s.id === id)?.group;
    const groupIds = [...new Set([...overviewIds, ...organIds].map(groupOf).filter((g): g is string => Boolean(g)).concat(separateGroupIds))]
      .filter(id => groups.some(g => g.sex === sex && g.id === id));
    return [{ organ: o.id, ids: overviewIds, groupIds }];
  });
}
// `detailId` is given only while the whole detail is the selection; one part
// picked inside it maps by its own id/FMA id or its single-concept group, so a
// ureter in the kidney detail or a rectum in the female intestine gets none.
export function organsOfView(scopes: ReturnType<typeof organScopes>, groups: ScopeGroup[], sex: string,
  ids: readonly string[], view: { detailId?: string; pickedGroup?: string; fmaIds?: readonly string[] }) {
  const exact = scopes.filter(s => [...ids, ...(view.fmaIds ?? [])].some(id => s.ids.includes(id)));
  if (exact.length) return exact.map(s => s.organ);
  const single = view.pickedGroup && oneOrgan(groups.find(g => g.sex === sex && g.id === view.pickedGroup));
  const groupIds = [view.detailId, single ? view.pickedGroup : undefined].filter((g): g is string => Boolean(g));
  return scopes.filter(s => groupIds.some(g => s.groupIds.includes(g))).map(s => s.organ);
}
