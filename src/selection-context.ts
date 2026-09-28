import type { ViewState } from './view-state';

// A temporary visual aid, not tissue depth or a change to the user's alpha.
export function contextIsDimmed(state: Pick<ViewState, 'selection' | 'comparison' | 'isolated' | 'fadeContext'>) {
  return state.fadeContext && !state.isolated && !state.comparison &&
    state.selection?.kind === 'structure' && state.selection.ids.length === 1;
}

export function selectionOpacity(alpha: number, selected: boolean, dimmed: boolean) {
  return selected ? 1 : dimmed ? Math.min(alpha, .12) : alpha;
}

// Translucent layers must not stamp the depth buffer and erase anatomical
// structures rendered behind them. The same threshold controls transparency.
export function opacityWritesDepth(alpha:number) {
  return Number.isFinite(alpha) && alpha >= .995;
}

type HitObject = { name: string; parent?: { name: string } | null };
// A visibly emphasized selected surface wins over the translucent context at
// the same pixel. Else keep the normal frontmost hit, so other meshes work.
export function selectionHitId(fallback: string, hits: { object: HitObject }[], selectedIds: string[], dimmed: boolean) {
  if (dimmed) for (const {object} of hits) {
    if (selectedIds.includes(object.name)) return object.name;
    if (object.parent && selectedIds.includes(object.parent.name)) return object.parent.name;
  }
  return fallback;
}
