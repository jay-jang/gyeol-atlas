export interface Point {
  id: string;
  name: string;
  hanja: string;
  pinyin: string;
  region: string;
  page: number | null;
  catalogue: string;
  bodyRegion: string;
  nameSource: string;
  markerCount: number;
  markerMode: string;
  markerNote: string;
  traditionalIndications: string[];
  traditionalTextEn: string;
  traditionSourceUrl: string;
  traditionSourceId: string;
  traditionLicense: string | null;
  traditionStatus: string;
  location: string;
  position: number[];
  surface: string;
  structures: string[];
  landmarks: string[];
  related: string[];
  meridian: string;
  bilateral: boolean;
  coordinateStatus: string;
  sourceIds: string[];
  reviewStatus: string;
}
export interface WikiDoc {
  id: string;
  title: string;
  category: string;
  sourceIds: string[];
  pointId?: string;
  body: string;
  updated: string;
  reviewStatus: string;
  links: string[];
  backlinks: string[];
}
export type Layers = Record<import("./anatomy").Layer, boolean>;
export type CameraAction = {
  kind:
    | "front"
    | "back"
    | "side"
    | "reset"
    | "zoomIn"
    | "zoomOut"
    | "focus"
    | "structure"
    | "head"
    | "region"
    | "anatomy-region"
    | "comparison"
    | "fit"
    | "restore"
    | "move-forward" | "move-backward" | "move-left" | "move-right" | "move-up" | "move-down";
  tick: number;
};
