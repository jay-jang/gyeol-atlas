import { initialView, restoreView, type ViewState } from './view-state.ts';

export const VIEW_KEY = 'gyeol-view-v2';
export const LAST_POINT_KEY = 'gyeol-last-point-v1';

export function lastPoint(raw: string | null, pointIds: string[]): string {
  try {
    const value = JSON.parse(raw || 'null');
    return value?.version === 1 && typeof value.pointId === 'string' && pointIds.includes(value.pointId)
      ? value.pointId : '';
  } catch { return ''; }
}

// A saved tab, including an explicit empty selection, takes precedence over
// the last point from another visit. Durable storage holds only that point ID.
export function storedView(raw: string | null, remembered: string | null, pointIds: string[], assets: Parameters<typeof restoreView>[2]): ViewState {
  return raw !== null ? restoreView(raw, pointIds, assets) : initialView(lastPoint(remembered, pointIds));
}

const read = (get: () => string | null) => { try { return get(); } catch { return null; } };
export function readBrowserView(pointIds: string[], assets: Parameters<typeof restoreView>[2]): ViewState {
  return storedView(read(() => sessionStorage.getItem(VIEW_KEY)), read(() => localStorage.getItem(LAST_POINT_KEY)), pointIds, assets);
}
export function saveTabView(view: ViewState): void {
  try { sessionStorage.setItem(VIEW_KEY, JSON.stringify(view)); } catch {}
}
export function rememberPoint(pointId: string): void {
  // Deselecting never erases the last actual choice. Storage can be disabled.
  if (!pointId) return;
  try {
    const value = JSON.stringify({ version: 1, pointId });
    if (localStorage.getItem(LAST_POINT_KEY) !== value) localStorage.setItem(LAST_POINT_KEY, value);
  } catch {}
}
