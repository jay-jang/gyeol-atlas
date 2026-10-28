import concepts from '../data/concepts.json' with { type: 'json' };
import conceptData from '../data/point-concepts.json' with { type: 'json' };
import theoryData from '../data/acupoint-theory.json' with { type: 'json' };
import meridians from '../data/meridians.json' with { type: 'json' };
import type { Point } from './types';

export type MarkerColorMode = 'meridian' | 'category' | 'organ';
const pointConcepts = conceptData as Record<string, { categories: string[]; traditionalChannel: string | null; traditionalName: string | null }>;
const theory = theoryData as Record<string, { traditionalOrgan: string | null; xiMeridian: string | null }>;
export const organChoices = meridians.filter(m => !['CV', 'GV', 'EX'].includes(m.id)).map(m => ({
  id: m.id, name: theory[`${m.id}1`].traditionalOrgan!, color: m.color,
}));
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
