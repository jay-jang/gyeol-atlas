import { assetUrl } from "./assets";
import { anatomyRegionMatches } from "./anatomy-region";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Component,
  memo,
  type ReactNode,
} from "react";
import { Canvas, events as pointerEvents, useThree, useFrame, type RootStore, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import {
  Mesh,
  MeshStandardMaterial,
  Vector3,
  DoubleSide,
  FrontSide,
  Plane,
  Box3,
  PerspectiveCamera,
  PropertyBinding,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Color,
  Group,
  MeshBasicMaterial,
  type Raycaster,
  type Camera,
  type Intersection,
  type Object3D,
} from "three";
import type { OrbitControls as OrbitType } from "three-stdlib";
import type { CameraPose } from "./view-state";
import type { Point, Layers, CameraAction } from "./types";
import { connectiveKindOf, dissectionLayerOpacity, layerKeys, maleOnlyStructureIds, type Layer, structures } from "./anatomy";
import meridians from "../data/meridians.json";
import anchors from "../data/anchors.json";
import structurePairs from "../data/structure-pairs.json";
import fullSystemStructures from "../data/full-system-structures.json";
import connectiveStructures from "../data/connective-structures.json";
import sexLymphStructures from "../data/sex-lymph-structures.json";
import maleRegistration from "../data/catalog/male-registration.json";
import { movementKeys, translateView, type MoveDirection } from "./navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import PackedAtlas from "./PackedAtlas";
import { CONNECTIVE_COLOR, SKIN_COLOR, SURFACE_TONES, clippingPlanes, configurePicking, isSupplementEyePart, releasedDrag, type SceneClick } from "./anatomy-rendering";
import { referenceSourceFor } from "./reference-source";
import { framedDistance } from "./camera-framing";
import { musclePeelRanks } from "./muscle-peel";
import { musclePeelOpacity } from "./dissection";
import { selectionOpacity, selectionHitId, opacityWritesDepth } from "./selection-context";
import { besideMarker, type ScreenSize } from "./marker-label";
import { hitRadius, markerDotPx, markersFirst, nearestMarker, releasedDragPress, trackPresses } from "./marker-picking";
import { buildCover, isGenitalStructure, COVER_NAME } from "./modesty";

const structureById = new Map(structures.map(s => [s.id, s]));
const NO_ANCHORS: typeof anchors = [];

const labelAnchor = new Vector3();
function toCanvas(point: Vector3, camera: Camera, size: ScreenSize): [number, number] {
  point.project(camera);
  return [(point.x + 1) * size.width / 2, (1 - point.y) * size.height / 2];
}
const facingView = new Vector3();
function outwardNormal(position: [number, number, number], surface?: [number, number, number]) {
  const normal = surface ? new Vector3(...position).sub(new Vector3(...surface)) : new Vector3();
  // Fallback: radial direction from the body's vertical axis.
  if (normal.lengthSq() < 1e-10) normal.set(position[0], 0, position[2]);
  return normal.lengthSq() < 1e-10 ? new Vector3(0, 0, 1) : normal.normalize();
}
function markerFaces(normal: Vector3 | undefined, position: Vector3, eye: Vector3) {
  if (!normal) return true;
  return normal.dot(facingView.copy(eye).sub(position).normalize()) > -0.15;
}
// `outward` is a world-X step whose projection picks the label's screen side,
// so bilateral labels still point away from the body from front and back.
const passThrough = { pointerEvents: "none" } as const;
function MarkerLabel({ outward, normal, peek = false, gap = 10, children }: { outward: number; normal?: Vector3; peek?: boolean; gap?: number; children: ReactNode }) {
  const invalidate = useThree(state => state.invalidate);
  const label = useRef<HTMLDivElement | null>(null);
  const measure = useCallback((node: HTMLDivElement | null) => {
    label.current = node;
    if (!node) return;
    // The label mounts after its first placement and frames run on demand.
    const observer = new ResizeObserver(() => invalidate());
    observer.observe(node);
    return () => observer.disconnect();
  }, [invalidate]);
  const position = useCallback((el: Object3D, camera: Camera, size: ScreenSize) => {
    // A label for a point on the far side of the body stays off the canvas.
    if (normal && !markerFaces(normal, labelAnchor.setFromMatrixPosition(el.matrixWorld), camera.position)) return [-9999, -9999];
    const marker = toCanvas(labelAnchor.setFromMatrixPosition(el.matrixWorld), camera, size);
    labelAnchor.setFromMatrixPosition(el.matrixWorld).x += outward;
    const away = toCanvas(labelAnchor, camera, size)[0] - marker[0];
    const node = label.current;
    return besideMarker(marker, Math.abs(away) < 1 ? outward : away,
      { width: node?.offsetWidth ?? 0, height: node?.offsetHeight ?? 0 }, size, gap);
  }, [outward, normal, gap]);
  // A hover-only name must let the pointer keep the marker underneath it.
  return <Html center zIndexRange={[20, 0]} ref={measure} calculatePosition={position} style={peek ? passThrough : undefined}>{children}</Html>;
}

type Marker = { point: Point; key: string; occurrence: number; position: Vector3; normal: Vector3; side: string };
const markerCapacity = anchors.length;
const markerMatrix = new Matrix4(), markerScale = new Vector3(), markerQuaternion = new Quaternion(), markerColor = new Color();
const markerColorOf = (m: Marker, selectedId: string) => m.point.id === selectedId ? "#e1ad5a" : meridians.find((x) => x.id === m.point.meridian)!.color;
// All acupoint markers share one instanced draw call. Each keeps a constant
// screen size; back-facing points (and filtered ones) get zero scale, while
// the chosen point is larger, gold and visible from every direction. The
// pointer target is a wider screen circle (marker-picking.ts), shown as a halo
// around the hovered point, and it wins over the tissue under the pointer.
function Markers({ markers, selectedId, labels, overTissue, onSelect }: { markers: Marker[]; selectedId: string; labels: boolean; overTissue: boolean; onSelect: (p: Point) => void }) {
  const mesh = useRef<InstancedMesh>(null);
  const halo = useRef<Group>(null);
  const shown = useRef<boolean[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const { camera, size, gl, invalidate } = useThree();
  const positions = useMemo(() => markers.map((m) => m.position), [markers]);
  const pointer = useRef({ type: "mouse", hover: null as number | null, positions, camera, height: size.height, overTissue });
  pointer.current = { ...pointer.current, hover, positions, camera, height: size.height, overTissue };
  useEffect(() => {
    // Touch and pen get the larger target; the click's own ray reads it.
    const canvas = gl.domElement;
    const record = (event: PointerEvent) => { pointer.current.type = event.pointerType; };
    canvas.addEventListener("pointerdown", record, true);
    canvas.addEventListener("pointermove", record, true);
    return () => { canvas.removeEventListener("pointerdown", record, true); canvas.removeEventListener("pointermove", record, true); };
  }, [gl]);
  const raycast = useCallback((raycaster: Raycaster, intersects: Intersection[]) => {
    const instances = mesh.current, { positions, camera, height, hover, type, overTissue } = pointer.current;
    if (!instances || !positions.length) return;
    const unit = 2 * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360) / height;
    const hit = nearestMarker(raycaster.ray.origin, raycaster.ray.direction, positions, shown.current, unit,
      (i) => hitRadius(type, hover === i, overTissue));
    if (hit) intersects.push({ distance: hit.depth, point: raycaster.ray.at(hit.depth, new Vector3()), object: instances, instanceId: hit.index } as Intersection);
  }, []);
  useLayoutEffect(() => {
    const instances = mesh.current;
    if (!instances) return;
    instances.count = markers.length;
    markers.forEach((m, i) => {
      instances.setColorAt(i, markerColor.set(markerColorOf(m, selectedId)));
      instances.setMatrixAt(i, markerMatrix.makeScale(0, 0, 0));
    });
    if (instances.instanceColor) instances.instanceColor.needsUpdate = true;
    instances.instanceMatrix.needsUpdate = true;
    // Report committed membership, also useful for diagnosing crowded views.
    gl.domElement.dataset.renderedMarkers = String(markers.length);
    gl.domElement.dataset.renderedPointIds = [...new Set(markers.map((m) => m.point.id))].sort().join(",");
    invalidate();
  }, [markers, selectedId, gl, invalidate]);
  useEffect(() => setHover(null), [markers]);
  useEffect(() => {
    const ring = halo.current;
    if (!ring || hover === null || !markers[hover]) return;
    const color = markerColorOf(markers[hover], selectedId);
    ring.children.forEach((child) => ((child as Mesh).material as MeshBasicMaterial).color.set(color));
  }, [hover, markers, selectedId]);
  useEffect(() => () => { document.body.style.cursor = "auto"; }, []);
  useFrame(() => {
    const instances = mesh.current;
    if (!instances) return;
    const tangent = 2 * Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360) / size.height;
    markers.forEach((m, i) => {
      const active = m.point.id === selectedId;
      const visible = active || markerFaces(m.normal, m.position, camera.position);
      shown.current[i] = visible;
      const distance = camera.position.distanceTo(m.position), dot = markerDotPx(distance);
      const pixels = active ? Math.max(dot + 2.5, 6.5) : hover === i ? Math.max(dot + 3, 7.5) : dot;
      markerScale.setScalar(visible ? distance * tangent * pixels : 0);
      instances.setMatrixAt(i, markerMatrix.compose(m.position, markerQuaternion, markerScale));
    });
    instances.instanceMatrix.needsUpdate = true;
    // The halo faces the camera and marks the hovered point's whole target.
    const ring = halo.current, hovered = hover === null ? undefined : markers[hover];
    if (!ring) return;
    ring.visible = Boolean(hovered && shown.current[hover!]);
    if (!hovered || !ring.visible) return;
    ring.position.copy(hovered.position);
    ring.quaternion.copy(camera.quaternion);
    ring.scale.setScalar(camera.position.distanceTo(hovered.position) * tangent * hitRadius(pointer.current.type, true, overTissue));
  });
  const pick = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.instanceId !== undefined && shown.current[e.instanceId] ? e.instanceId : null;
  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[undefined, undefined, markerCapacity]}
        renderOrder={20}
        frustumCulled={false}
        raycast={raycast}
        userData={{ acupointMarkers: true }}
        onClick={(e) => {
          const i = pick(e);
          if (i === null) return;
          // The marker was under the pointer: nothing behind it is picked.
          e.stopPropagation();
          if (!releasedDragPress(e.delta, (e.nativeEvent as PointerEvent).pointerType)) onSelect(markers[i].point);
        }}
        onPointerMove={(e) => {
          const i = pick(e);
          if (i === null) return;
          e.stopPropagation();
          if (i !== hover) { setHover(i); invalidate(); }
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => { setHover(null); document.body.style.cursor = "auto"; invalidate(); }}
      >
        <sphereGeometry args={[1, 14, 10]} />
        <meshBasicMaterial depthTest={false} transparent depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <group ref={halo} visible={false} renderOrder={19}>
        <mesh renderOrder={19}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial depthTest={false} transparent opacity={0.16} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh renderOrder={19}>
          <ringGeometry args={[0.9, 1, 40]} />
          <meshBasicMaterial depthTest={false} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {markers.map((m, i) => {
        const active = m.point.id === selectedId;
        const persistent = (active && m.side !== "왼쪽" && m.occurrence === 0) || (labels && m.occurrence === 0);
        return (persistent || hover === i) && (
          <group key={m.key} position={m.position}>
            <MarkerLabel outward={active ? -0.05 : 0.05} normal={active ? undefined : m.normal} peek={!persistent}
              gap={persistent ? 10 : hitRadius(pointer.current.type, true, overTissue) + 4}>
              {/* A hover-only name lets the pointer keep its target underneath;
                  shown names are buttons whose events stay off the 3D scene.
                  On the body each point reads by its name (중완), not its
                  code (CV12); the code stays in the tooltip and search. */}
              <button
                className={`point-label ${active ? "active" : ""} ${persistent ? "" : "peek"}`}
                data-point-id={m.point.id}
                title={`${m.point.name} ${m.point.id} ${m.side}`}
                aria-label={`${m.point.name} ${m.point.id} ${m.side} 선택`}
                tabIndex={persistent ? undefined : -1}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onSelect(m.point); }}
              >
                {m.point.name}
              </button>
            </MarkerLabel>
          </group>
        );
      })}
    </>
  );
}

type Props = {
  points: Point[];
  selected: Point;
  onSelect: (p: Point) => void;
  layers: Layers;
  opacity: number;
  labels: boolean;
  action: CameraAction;
  onReady: (layer: Layer) => void;
  onLoading: (value: boolean) => void;
  selectedStructure: string;
  onStructure: (id: string) => void;
  isolated: boolean;
  highlight: string[];
  cutaway: number;
  dissection: number;
  displayMode: "dissection" | "layers";
  layerOpacity: Record<Layer, number>;
  contextDimmed: boolean;
  selectionIds: string[];
  detailIds: string[];
  selectionTarget: "visible" | "internal" | "skin";
  initialPose: CameraPose | null;
  onPose: (pose: CameraPose) => void;
  sex: "male" | "female";
  anatomyRegion: "whole" | "head" | "upper-body" | "lower-body" | "upper-limb" | "lower-limb" | "chest" | "abdomen" | "pelvis";
  connective: boolean;
  modesty: boolean;
  femaleMarkers: boolean;
  // The selection was made in place on the model: slide the picture aside for
  // its card (and back) instead of jumping.
  glideFraming: boolean;
};
export type AtlasProps = Props;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
function clinicalColor(layer: Layer, name: string) {
  const lower = name.toLowerCase();
  if (layer === "vessel") return /vein|vena cava/.test(lower) ? "#356fb3" : "#d33f49";
  if (layer === "organ") {
    if (/lung/.test(lower)) return "#c97f86";
    if (/liver/.test(lower)) return "#8f3439";
    if (/kidney/.test(lower)) return "#95534b";
    if (/heart/.test(lower)) return "#b52e3f";
    if (/stomach|intestin|colon/.test(lower)) return "#c47a68";
  }
  return { skin: SKIN_COLOR, bone: "#e8dec5", muscle: "#b43f3f", organ: "#a94d60", vessel: "#d33f49", lymph: "#58b99f", nerve: "#f0c94f" }[layer];
}
function inAnatomyRegion(mesh: Mesh, region: Props["anatomyRegion"], id = mesh.name) {
  if (region === "whole") return true;
  const box = new Box3().setFromObject(mesh);
  return anatomyRegionMatches([box.min.toArray(), box.max.toArray()], region, structureById.get(id));
}
function taggedRegionMatches(tag: string | undefined, region: Props["anatomyRegion"]) {
  if (region === "whole") return true;
  if (region === "upper-body") return ["head", "neck", "chest", "abdomen", "upper-limb"].includes(tag || "");
  if (region === "lower-body") return ["pelvis", "lower-limb"].includes(tag || "");
  return tag === region;
}
class Boundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="viewer-fallback" role="alert">
        <TriangleAlert />
        <strong>3D 모델을 열지 못했습니다</strong>
        <p>
          WebGL 지원과 모델 파일을 확인해 주세요. 경혈 목록과 위키는 계속 이용할
          수 있습니다.
        </p>
        <button onClick={this.props.onRetry}>3D 다시 시도</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
function AnatomyLayer({ layer, props }: { layer: Layer; props: Props }) {
  const model = useGLTF(assetUrl(`models/${layer}.glb`));
  const object = useMemo(() => {
    const clone = model.scene.clone(true);
    clone.visible = false;
    clone.updateMatrixWorld(true);
    const muscleMeshes: { mesh: Mesh; score: number }[] = [];
    clone.traverse(o => {
      if (!(o instanceof Mesh)) return;
      o.material = new MeshStandardMaterial({roughness:0.72, metalness:0.015, side:layer === 'skin' ? FrontSide : DoubleSide});
      if (layer === "muscle") {
        const box = new Box3().setFromObject(o);
        const center = box.getCenter(new Vector3());
        const extent = box.getSize(new Vector3());
        const ax = center.y < .83 ? .095 : Math.abs(center.x) > .2 && center.y < 1.5 ? .29 : 0;
        const radius = Math.hypot(Math.abs(center.x) - ax, center.z) + Math.max(extent.x, extent.z) * .24;
        muscleMeshes.push({ mesh: o, score: radius });
      }
    });
    const ranks = musclePeelRanks(muscleMeshes.map(({ mesh, score }) => ({ id: mesh.name, score })));
    muscleMeshes.forEach(({ mesh }) => {
      mesh.userData.peelRank = ranks.get(mesh.name)!;
    });
    if (layer === "skin") clone.traverse(o => { if (o instanceof Mesh && o.name === "FMA7163") o.add(buildCover(o, "male")); });
    return clone;
  }, [model.scene, layer]);
  useEffect(() => () => object.traverse(o => {
    if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) o.material.dispose();
  }), [object]);
  const { invalidate, gl } = useThree();
  useLayoutEffect(() => {
    const progressive = props.displayMode === "dissection";
    // The skin still covers the surface (not peeled, not see-through).
    const skinOpaque = props.layers.skin && props.selectionTarget !== "internal"
      && props.opacity * dissectionLayerOpacity("skin", props.dissection, progressive) >= .5;
    const mirrored = props.selected.structures.flatMap((id) => [
      id,
      (structurePairs as Record<string, string>)[id] || id,
    ]);
    let visibleCount = 0;
    object.traverse((o) => {
      if (!(o instanceof Mesh) || o.name === COVER_NAME) return;
      const id = structureById.has(o.name)
        ? o.name
        : o.parent?.name || "";
      const emphasis =
        id === props.selectedStructure
          ? "#238b91"
          : props.highlight.includes(id)
            ? "#e5b24f"
            : mirrored.includes(id)
              ? "#bca77a"
              : null;
      const selected = props.selectionIds.includes(id);
      let dissectionAlpha = selected || props.isolated ? 1 : dissectionLayerOpacity(layer, props.dissection, progressive);
      if (layer === "muscle" && progressive && !selected && !props.isolated) {
        dissectionAlpha *= musclePeelOpacity(props.dissection, o.userData.peelRank);
      }
      const unavailableForSex = props.sex === "female" && maleOnlyStructureIds.has(id);
      o.visible = !unavailableForSex && (!props.isolated || selected) && (selected || dissectionAlpha > .01) && (selected || inAnatomyRegion(o, props.anatomyRegion, id));
      o.visible = o.visible && (!props.detailIds.length || props.detailIds.includes(id));
      // Use a single whole-body vascular/neural source in the overview. Retain
      // original BodyParts3D meshes for explicit searches and organ details.
      if ((layer === "nerve" || layer === "vessel") && !selected && !props.detailIds.includes(id)) o.visible = false;
      const connective = Boolean(connectiveKindOf(id));
      if (connective && !props.connective && !selected) o.visible = false;
      if (props.modesty && !selected && isGenitalStructure(id, structureById.get(id)?.name)) o.visible = false;
      if (o.visible) visibleCount++;
      // Selection is an opaque emphasis, as in PackedAtlas and the supplements.
      // Keep the user's layer alpha in view-state; it applies again on deselect.
      const alpha = selectionOpacity((layer === "skin" ? props.opacity : props.layerOpacity[layer]) * dissectionAlpha, selected, props.contextDimmed);
      const vessel = structureById.get(id)?.name || "";
      const material = o.material as MeshStandardMaterial;
      configurePicking(o, layer, props.selectionTarget);
      const tone = !selected && skinOpaque ? SURFACE_TONES[id] : undefined;
      material.color.set(emphasis ? emphasis : connective ? CONNECTIVE_COLOR : tone ?? clinicalColor(layer, vessel));
      const transparent = !opacityWritesDepth(alpha);
      const planes = clippingPlanes(layer, props);
      const clipping = planes.length > 0;
      if (material.transparent !== transparent || Boolean(material.clippingPlanes?.length) !== clipping)
        material.needsUpdate = true;
      material.transparent = transparent;
      material.opacity = alpha;
      material.depthWrite = !transparent;
      material.clippingPlanes = planes;
      const cover = o.getObjectByName(COVER_NAME) as Mesh | undefined;
      if (cover) {
        cover.visible = props.modesty && o.visible;
        const coverMaterial = cover.material as MeshStandardMaterial;
        coverMaterial.opacity = alpha; coverMaterial.transparent = transparent; coverMaterial.depthWrite = !transparent;
        coverMaterial.clippingPlanes = planes;
        gl.domElement.dataset.modestyCover = String(cover.visible);
      }
    });
    gl.domElement.dataset[`visible${layer[0].toUpperCase()}${layer.slice(1)}`] = String(visibleCount);
    object.visible = true;
    invalidate();

  }, [
    object,
    props.selected,
    props.selectedStructure,
    props.selectionIds,
    props.detailIds,
    props.selectionTarget,
    props.isolated,
    props.highlight,
    props.opacity,
    props.layerOpacity,
    props.contextDimmed,
    props.cutaway,
    props.dissection,
    props.displayMode,
    props.layers,
    props.anatomyRegion,
    props.connective,
    props.modesty,
    gl,
    invalidate,
  ]);
  useEffect(() => {
    if (layer !== "nerve" && layer !== "vessel") props.onReady(layer);
  }, [object, layer, props.onReady]);
  return (
    <primitive
      object={object}
      onClick={(e: SceneClick) => {
        if (releasedDrag(e)) return;
        e.stopPropagation();
        const id = structureById.has(e.object.name)
          ? e.object.name
          : e.object.parent?.name || "";
        props.onStructure(selectionHitId(id, e.intersections, props.selectionIds, props.contextDimmed));
      }}
    />
  );
}
type SupplementEntry = { id: string; node: string; name: string; layer: string };
// A whole-body Z-Anatomy export placed with the male registration. Only the
// catalogued nodes of this system are shown; the rest of the file stays hidden.
function SupplementModel({ url, layer, entries, color, connective = false, signalsReady, props }: {
  url: string; layer: Layer; entries: SupplementEntry[]; color: (entry: SupplementEntry | undefined) => string;
  connective?: boolean; signalsReady: boolean; props: Props;
}) {
  const model = useGLTF(assetUrl(url), assetUrl("draco/"));
  const object = useMemo(() => {
    const clone = model.scene.clone(true);
    clone.visible = false;
    clone.scale.multiplyScalar(maleRegistration.scale);
    clone.position.multiplyScalar(maleRegistration.scale).add(new Vector3(...maleRegistration.translation));
    clone.updateMatrixWorld(true);
    const byNode = new Map(entries.map((item) => [PropertyBinding.sanitizeNodeName(item.node), item]));
    clone.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const entry = byNode.get(item.name);
      item.userData.systemAllowed = Boolean(entry);
      item.userData.entry = entry;
      item.visible = Boolean(entry);
      if (entry) item.name = entry.id;
      item.material = new MeshStandardMaterial({ roughness: connective ? 0.58 : 0.76, side: DoubleSide });
    });
    return clone;
  }, [model.scene, entries, connective]);
  const { invalidate } = useThree();
  useLayoutEffect(() => {
    const progressive = props.displayMode === "dissection";
    // While the BodyParts3D eyeball is drawn, Z-Anatomy's own eye parts would
    // be a second eye in the same place.
    const baseEyeball = !props.isolated && props.layers.organ && props.layerOpacity.organ * dissectionLayerOpacity("organ", props.dissection, progressive) > .01;
    object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const selected = props.selectionIds.includes(item.name);
      item.visible = item.userData.systemAllowed && (!props.isolated || selected) && (selected || inAnatomyRegion(item, props.anatomyRegion));
      item.visible = item.visible && (!props.detailIds.length || props.detailIds.includes(item.name));
      if (connective && !props.connective && !selected) item.visible = false;
      if (baseEyeball && !selected && isSupplementEyePart(item.userData.entry?.name || "")) item.visible = false;
      if (props.modesty && !selected && isGenitalStructure(item.name, item.userData.entry?.name)) item.visible = false;
      const material = item.material as MeshStandardMaterial;
      // A category bundle keeps its tissue colour; one chosen structure is emphasised.
      material.color.set((connective ? props.selectedStructure === item.name : selected) ? "#34d3dd" : color(item.userData.entry));
      const alpha = selectionOpacity(props.layerOpacity[layer] * dissectionLayerOpacity(layer, props.dissection, progressive), selected, props.contextDimmed);
      item.visible = item.visible && alpha > .01;
      const clipped = props.cutaway > 0;
      const transparent = !opacityWritesDepth(alpha);
      if (material.transparent !== transparent || Boolean(material.clippingPlanes?.length) !== clipped)
        material.needsUpdate = true;
      material.transparent = transparent;
      material.opacity = alpha;
      material.depthWrite = !transparent;
      material.clippingPlanes = clipped
        ? [new Plane(new Vector3(0, 0, -1), 0.22 - props.cutaway * 0.44)]
        : [];
      configurePicking(item, layer, props.selectionTarget);
    });
    object.visible = true;
    invalidate();
  }, [object, layer, color, connective, props.connective, props.modesty, props.selectedStructure, props.isolated, props.selectionIds, props.detailIds, props.layerOpacity, props.contextDimmed, props.cutaway, props.dissection, props.displayMode, props.selectionTarget, props.anatomyRegion, props.layers, invalidate]);
  useEffect(() => {
    if (signalsReady) props.onReady(layer);
  }, [object, layer, signalsReady, props.onReady]);
  useEffect(
    () => () =>
      object.traverse((item) => {
        if (item instanceof Mesh && item.material instanceof MeshStandardMaterial)
          item.material.dispose();
      }),
    [object],
  );
  return <primitive object={object} onClick={(event: SceneClick) => {
    if (releasedDrag(event) || props.selectionTarget === "skin") return;
    if (props.cutaway > 0 && event.point.z > 0.22 - props.cutaway * 0.44) return;
    const id = event.object.name;
    if (!structureById.has(id)) return;
    event.stopPropagation();
    props.onStructure(selectionHitId(id, event.intersections, props.selectionIds, props.contextDimmed));
  }} />;
}
const fullSystemEntries = {
  nerve: fullSystemStructures.filter((item) => item.layer === "nerve"),
  vessel: fullSystemStructures.filter((item) => item.layer === "vessel"),
};
const nerveColor = () => "#f0c94f";
const vesselColor = (entry: SupplementEntry | undefined) => /vein|vena cava/i.test(entry?.name || "") ? "#356fb3" : "#cf3e49";
function WholeBodySupplement({ layer, props }: { layer: "nerve" | "vessel"; props: Props }) {
  return <SupplementModel url={`models/${layer}-full.glb`} layer={layer} entries={fullSystemEntries[layer]}
    color={layer === "nerve" ? nerveColor : vesselColor} signalsReady props={props} />;
}
// Ligaments and joint structures peel with the skeleton; separately modelled
// tendons, retinacula and tendon sheaths with the muscles.
const connectiveColor = () => CONNECTIVE_COLOR;
const connectiveEntries = {
  bone: connectiveStructures.filter((item) => item.model === "ligament-full.glb"),
  muscle: connectiveStructures.filter((item) => item.model === "tendon-full.glb"),
};
function ConnectiveSupplement({ layer, props }: { layer: "bone" | "muscle"; props: Props }) {
  return <SupplementModel url={`models/${layer === "bone" ? "ligament" : "tendon"}-full.glb`} layer={layer}
    entries={connectiveEntries[layer]} color={connectiveColor} connective signalsReady={false} props={props} />;
}
function ReferenceModel({ modelName, layer, props }: { modelName: string; layer: Layer; props: Props }) {
  const model = useGLTF(assetUrl(`models/reference/${modelName}`), assetUrl("draco/"));
  const entries = useMemo(() => sexLymphStructures.filter(item => item.sex === props.sex && item.layer === layer && item.model === modelName), [layer, modelName, props.sex]);
  const object = useMemo(() => {
    const clone = model.scene.clone(true);
    clone.visible = false;
    clone.scale.multiplyScalar(maleRegistration.scale);
    clone.position.multiplyScalar(maleRegistration.scale).add(new Vector3(...maleRegistration.translation));
    clone.updateMatrixWorld(true);
    const byNode = new Map(entries.map(item => [PropertyBinding.sanitizeNodeName(item.node), item.id]));
    clone.traverse(item => {
      if (!(item instanceof Mesh)) return;
      const id = byNode.get(item.name);
      item.userData.systemAllowed = Boolean(id);
      item.visible = Boolean(id);
      if (id) item.name = id;
      item.material = new MeshStandardMaterial({ roughness: .74, side: layer === "skin" ? FrontSide : DoubleSide });
    });
    return clone;
  }, [entries, layer, model.scene, props.sex]);
  const { invalidate, gl } = useThree();
  useLayoutEffect(() => {
    const progressive = props.displayMode === "dissection";
    const depthAlpha = dissectionLayerOpacity(layer, props.dissection, progressive);
    let visibleCount = 0;
    object.traverse(item => {
      if (!(item instanceof Mesh)) return;
      const selected = props.selectionIds.includes(item.name);
      const entry = structureById.get(item.name);
      item.visible = item.userData.systemAllowed && (!props.isolated || selected) && (selected || depthAlpha > .01) && (selected || taggedRegionMatches(entry?.bodyRegion, props.anatomyRegion));
      item.visible = item.visible && (!props.detailIds.length || props.detailIds.includes(item.name));
      if (item.visible) visibleCount++;
      const material = item.material as MeshStandardMaterial;
      material.color.set(selected ? "#34d3dd" : clinicalColor(layer, entry?.name || ""));
      material.opacity = selectionOpacity(props.layerOpacity[layer] * depthAlpha, selected, props.contextDimmed);
      const planes = clippingPlanes(layer, props);
      const transparent = !opacityWritesDepth(material.opacity);
      if (material.transparent !== transparent || (material.clippingPlanes?.length || 0) !== planes.length) material.needsUpdate = true;
      material.transparent = transparent;
      material.depthWrite = !transparent;
      material.clippingPlanes = planes;
      configurePicking(item, layer, props.selectionTarget);
    });
    const key = `visibleReference${modelName.replace(/[^a-z0-9]/gi, "")}`;
    gl.domElement.dataset[key] = String(visibleCount);
    const bounds = new Box3().setFromObject(object);
    gl.domElement.dataset[`boundsReference${modelName.replace(/[^a-z0-9]/gi, "")}`] = JSON.stringify([bounds.min.toArray(), bounds.max.toArray()]);
    object.visible = true;
    invalidate();
  }, [object, layer, modelName, props.anatomyRegion, props.isolated, props.layerOpacity, props.contextDimmed, props.selectionIds, props.detailIds, props.layers, props.dissection, props.displayMode, props.cutaway, props.selectionTarget, gl, invalidate]);
  useEffect(() => { props.onReady(layer); }, [layer, object, props.onReady]);
  useEffect(() => () => object.traverse(item => { if (item instanceof Mesh && item.material instanceof MeshStandardMaterial) item.material.dispose(); }), [object]);
  return <primitive object={object} onClick={(event: SceneClick) => {
    const id = event.object.name;
    if (releasedDrag(event) || !structureById.has(id)) return;
    event.stopPropagation();
    props.onStructure(selectionHitId(id, event.intersections, props.selectionIds, props.contextDimmed));
  }} />;
}
function Scene(props: Props) {
  const { points, selected, onSelect, layers, labels, action } = props;
  const controls = useRef<OrbitType>(null);
  const { camera, invalidate, scene, size, gl } = useThree();
  const keys = useRef(new Set<string>());
  const mobile = window.innerWidth <= 700;
  // Card-aware framing is shared by explicit details, ordinary selections,
  // and traditional comparison bundles. It never changes their memberships.
  const hasSelection = props.selectionIds.length > 0;
  const limbScope = props.anatomyRegion === "upper-limb" || props.anatomyRegion === "lower-limb";
  const [selectionCard, setSelectionCard] = useState<{top:number;right:number;left:number} | null>(null);
  const selectionCardTop = selectionCard?.top ?? null;
  useEffect(() => {
    if (!hasSelection) { setSelectionCard(null); return; }
    const card = gl.domElement.closest('.ax')?.querySelector('.selection-card');
    if (!card) return;
    const measure = () => {
      const bounds = card.getBoundingClientRect(), canvas = gl.domElement.getBoundingClientRect();
      const top = Math.round(bounds.top - canvas.top), right = Math.round(bounds.right - canvas.left), left = Math.round(bounds.left - canvas.left);
      setSelectionCard(previous => previous?.top === top && previous.right === right && previous.left === left ? previous : {top,right,left});
    };
    const observer = new ResizeObserver(measure);
    observer.observe(card); observer.observe(gl.domElement); measure();
    return () => observer.disconnect();
  }, [hasSelection, gl, size.width, size.height]);
  // The selection card docks right on desktop, left in short landscape and at
  // the bottom on phones; the free region on the other side frames the model.
  const cardSide = !hasSelection || !selectionCard ? null
    : selectionCard.left > size.width * .5 ? "right" : selectionCard.right < size.width * .5 ? "left" : "bottom";
  // Phone overlays: search row and depth bar at the top, tools on the right,
  // the acupoint bar at the bottom. Desktop keeps the depth rail at the left.
  // (Phone top overlays end below the status pill at about 140px.)
  const observationTop = mobile ? 150 : hasSelection ? 64 : 0;
  const observationBottom = cardSide === "bottom" && selectionCardTop !== null
    ? Math.max(observationTop + 1, Math.min(size.height, selectionCardTop - 16))
    : mobile ? Math.max(observationTop + 120, size.height - 64) : hasSelection ? size.height - 70 : size.height;
  const observationHeight = observationBottom - observationTop;
  const observationLeft = cardSide === "left" ? Math.max(80, selectionCard!.right + 16) : hasSelection && !mobile ? 156 : 0;
  const observationRight = cardSide === "right" ? selectionCard!.left - 16 : mobile ? size.width - 56 : size.width;
  const observationWidth = Math.max(1, observationRight - observationLeft);
  const framed = mobile || hasSelection || limbScope;
  // The projection centre follows the free area beside the tool overlays. The
  // shift is a pure image translation, so it can glide without moving the camera.
  const viewOffset = useRef({ x: 0, y: 0, from: [0, 0], to: [0, 0], start: 0, width: 0, height: 0, mobile, limbScope });
  const applyViewOffset = useCallback((progress: number) => {
    const o = viewOffset.current, cam = camera as PerspectiveCamera;
    const eased = 1 - (1 - progress) ** 3;
    o.x = o.from[0] + (o.to[0] - o.from[0]) * eased;
    o.y = o.from[1] + (o.to[1] - o.from[1]) * eased;
    if (o.x || o.y || framed) cam.setViewOffset(o.width, o.height, o.x, o.y, o.width, o.height);
    else cam.clearViewOffset();
    cam.updateProjectionMatrix();
  }, [camera, framed]);
  useEffect(() => {
    const o = viewOffset.current;
    // Only the selection card's arrival, size or departure glides; a resize,
    // layout breakpoint or limb view comes with its own camera framing.
    const resized = o.width !== size.width || o.height !== size.height || o.mobile !== mobile || o.limbScope !== limbScope;
    Object.assign(o, { width: size.width, height: size.height, mobile, limbScope, from: [o.x, o.y] });
    o.to = framed ? [size.width / 2 - (observationLeft + observationWidth / 2), size.height / 2 - (observationTop + observationBottom) / 2] : [0, 0];
    const still = resized || !props.glideFraming || matchMedia("(prefers-reduced-motion: reduce)").matches;
    o.start = still ? 0 : performance.now();
    if (still) applyViewOffset(1);
    invalidate();
  }, [applyViewOffset, framed, mobile, limbScope, size.width, size.height, observationTop, observationBottom, observationLeft, observationWidth, props.glideFraming, invalidate]);
  useFrame(() => {
    const o = viewOffset.current;
    if (!o.start) return;
    const progress = Math.min(1, (performance.now() - o.start) / 320);
    applyViewOffset(progress);
    if (progress < 1) invalidate();
    else o.start = 0;
  });
  useEffect(() => trackPresses(gl.domElement), [gl]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', '3D 이동: W A S D 앞뒤좌우, Q E 아래위, Shift 빠르게, 휠 확대 축소');
    const focus = () => canvas.focus({ preventScroll: true });
    const down = (event: KeyboardEvent) => {
      if (movementKeys[event.code] || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
        event.preventDefault(); keys.current.add(event.code); invalidate();
      }
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const clear = () => keys.current.clear();
    canvas.addEventListener('pointerdown', focus);
    canvas.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    canvas.addEventListener('blur', clear);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', clear);
    return () => {
      canvas.removeEventListener('pointerdown', focus); canvas.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up); canvas.removeEventListener('blur', clear);
      window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear);
    };
  }, [gl, invalidate]);
  // Camera moves the viewer asked for glide instead of jumping, so the place
  // being studied stays in sight (instant under reduced motion). Dragging or
  // keyboard movement takes over at once.
  const glide = useRef<{ from: [Vector3, Vector3]; to: [Vector3, Vector3]; start: number; duration: number } | null>(null);
  useFrame(() => {
    const c = controls.current, g = glide.current;
    if (!c || !g) return;
    const t = Math.min(1, (performance.now() - g.start) / g.duration), eased = t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    camera.position.lerpVectors(g.from[0], g.to[0], eased);
    c.target.lerpVectors(g.from[1], g.to[1], eased);
    c.update();
    if (t < 1) { invalidate(); return; }
    glide.current = null;
    emitPose();
  });
  useFrame((_, delta) => {
    const c = controls.current;
    const directions = [...keys.current].map(key => movementKeys[key]).filter(Boolean);
    if (!c || !directions.length) return;
    glide.current = null;
    const speed = (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) ? 1.5 : 0.5;
    for (const direction of directions) translateView(camera, c.target, direction, speed * Math.min(delta, 0.05) / Math.sqrt(directions.length));
    c.update(); invalidate();
    if (poseTimer.current) clearTimeout(poseTimer.current);
    poseTimer.current = setTimeout(emitPose, 160);
  });
  const [revision, setRevision] = useState(0);
  const layerReady = useCallback(
    (layer: Layer) => {
      props.onReady(layer);
      setRevision((n) => n + 1);
    },
    [props.onReady],
  );
  const initialPose = useRef(props.initialPose);
  const executed = useRef(-1);
  const layoutKey = `${size.width}/${size.height}/${observationTop}/${observationBottom}/${observationLeft}/${observationWidth}`;
  const framedLayout = useRef(layoutKey);
  // Canvas layout can change when a selection card disappears without the
  // browser viewport changing. Only a real viewport resize merits refitting.
  const viewportKey = `${window.innerWidth}/${window.innerHeight}`;
  const framedViewport = useRef(viewportKey);
  const framedSelection = useRef(hasSelection);
  // The selection a camera action last framed. A part picked in place on the
  // model keeps the user's camera, so card measurements must not frame it.
  const selectionKey = props.selectionIds.join("|");
  const framedFor = useRef<string | null>(null);
  const framedMobile = useRef(mobile);
  const restoringLayout = useRef(Boolean(props.initialPose));
  const poseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emitPose = useCallback(() => {
    const c = controls.current;
    if (c)
      props.onPose({
        position: camera.position.toArray() as [number, number, number],
        target: c.target.toArray() as [number, number, number],
      });
  }, [camera, props.onPose]);
  useEffect(
    () => () => {
      if (poseTimer.current) clearTimeout(poseTimer.current);
      emitPose();
    },
    [emitPose],
  );
  // Female anchors are approximations carried from the male ones; fetched only
  // when the viewer asks for them (scripts/build-female-anchors.mjs).
  const [femaleAnchors, setFemaleAnchors] = useState<typeof anchors | null>(null);
  const wantsFemaleAnchors = props.sex === "female" && props.femaleMarkers;
  useEffect(() => {
    if (!wantsFemaleAnchors || femaleAnchors) return;
    const abort = new AbortController();
    fetch(assetUrl("models/acupoint-anchors-female.json"), { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error(`여성 근사 표식 ${response.status}`); return response.json(); })
      .then(setFemaleAnchors).catch(() => {});
    return () => abort.abort();
  }, [wantsFemaleAnchors, femaleAnchors]);
  const anchorSource = props.sex === "female" ? (wantsFemaleAnchors && femaleAnchors) || NO_ANCHORS : anchors;
  const markers = useMemo(
    () =>
      (props.detailIds.length ? [] : anchorSource)
        .filter((a) => points.some((p) => p.id === a.pointId))
        .map((a) => ({
          point: points.find((p) => p.id === a.pointId)!,
          key: a.key,
          occurrence: a.occurrence,
          position: new Vector3(...(a.position as [number, number, number])),
          // Display anchors sit a few millimetres outside their surface point;
          // that offset is the outward direction used to hide back-side points.
          normal: outwardNormal(a.position as [number, number, number], (a as { surfacePoint?: number[] }).surfacePoint as [number, number, number] | undefined),
          side:
            a.side === "right"
              ? "오른쪽"
              : a.side === "left"
                ? "왼쪽"
                : "정중선",
        })),
    [points, anchorSource, props.detailIds.length],
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scene.updateMatrixWorld(true);
      const selectedBounds = new Box3();
      const ids: string[] = [];
      const counts = Object.fromEntries(layerKeys.map(layer => [layer, 0])) as Record<Layer, number>;
      scene.traverseVisible(obj => {
        if (!(obj instanceof Mesh) || !structureById.has(obj.name)) return;
        if ((obj.material as MeshStandardMaterial).opacity < .01) return;
        ids.push(obj.name);
        counts[structureById.get(obj.name)!.layer]++;
        if (props.selectionIds.includes(obj.name)) selectedBounds.union(new Box3().setFromObject(obj));
      });
      gl.domElement.dataset.visibleStructureIds = [...new Set(ids)].sort().join(",");
      gl.domElement.dataset.selectedWorldBounds = selectedBounds.isEmpty() ? "null" : JSON.stringify([selectedBounds.min.toArray(), selectedBounds.max.toArray()]);
      gl.domElement.dataset.modelSex = props.sex;
      for (const layer of layerKeys) gl.domElement.dataset[`visible${layer[0].toUpperCase()}${layer.slice(1)}`] = String(counts[layer]);
    });
    return () => cancelAnimationFrame(frame);
  }, [revision, props.sex, props.layers, props.selectionIds, props.detailIds, props.isolated, props.dissection, props.anatomyRegion, props.connective, props.modesty, scene, gl]);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const pendingAction = executed.current !== action.tick;
    const layoutChanged = framedLayout.current !== layoutKey;
    // Removing a selection card also changes layoutKey. It must not refit a
    // regional view during an ordinary layer/peel transition (Q2).
    const viewportChanged = framedViewport.current !== viewportKey;
    const selectionJustCleared = framedSelection.current && !hasSelection;
    const mobileBreakpointChanged = framedMobile.current !== mobile;
    framedSelection.current = hasSelection;
    framedMobile.current = mobile;
    const refitLimb = !hasSelection && limbScope && viewportChanged;
    // A desktop overview pose can crop the head/feet after switching to the
    // mobile layout. Refit only across that layout breakpoint; scrollbar or
    // selection-card size changes must not disturb a comparison's camera.
    const refitOverview = !hasSelection && !selectionJustCleared && props.anatomyRegion === "whole" && mobileBreakpointChanged;
    // The selection card docks at the side on desktop and at the bottom on
    // phones, so a pose from the other layout can hide the model behind it.
    const refitSelection = hasSelection && mobileBreakpointChanged;
    framedViewport.current = viewportKey;
    // A saved camera remains authoritative through asynchronous card/content
    // measurements. One skipped layout pass is insufficient: detail sources
    // can resize the card again after the first committed frame. Only a real
    // user camera action, or an overview viewport reframe, ends restoration.
    if (!pendingAction && restoringLayout.current && !refitLimb && !refitOverview && !refitSelection) {
      framedLayout.current = layoutKey; return;
    }
    if (!pendingAction && !refitLimb && !refitOverview && !refitSelection && (!hasSelection || !layoutChanged || framedFor.current !== selectionKey)) { framedLayout.current = layoutKey; return; }
    const detailContext = props.detailIds.length > 0 && !props.isolated;
    const kind = pendingAction ? action.kind : refitLimb ? "anatomy-region" : refitOverview ? "fit" : props.highlight.length && !props.isolated ? "comparison" : detailContext ? "fit" : "structure";
    const selectionPreset = hasSelection && ["front", "back", "side", "reset"].includes(kind);
    const from: [Vector3, Vector3] = [camera.position.clone(), c.target.clone()];
    glide.current = null;
    if (kind.startsWith("move-")) {
      translateView(camera, c.target, kind.slice(5) as MoveDirection, 0.12);
    } else if (kind === "zoomIn" || kind === "zoomOut")
      camera.position
        .sub(c.target)
        .multiplyScalar(kind === "zoomIn" ? 0.8 : 1.25)
        .add(c.target);
    else if (kind === "pose" && action.pose) {
      camera.position.fromArray(action.pose.position);
      c.target.fromArray(action.pose.target);
    } else if (kind === "pivot") {
      // Orbit about the selected part: pan so it becomes the centre, keeping
      // the distance and direction (no zoom).
      const box = new Box3();
      scene.updateMatrixWorld(true);
      for (const id of props.selectionIds) { const obj = scene.getObjectByName(id); if (obj) box.union(new Box3().setFromObject(obj)); }
      if (box.isEmpty()) return;
      const shift = box.getCenter(new Vector3()).sub(c.target);
      c.target.add(shift);
      camera.position.add(shift);
    } else if (kind === "restore") {
      if (initialPose.current) {
        camera.position.fromArray(initialPose.current.position);
        c.target.fromArray(initialPose.current.target);
      } else if ((camera as PerspectiveCamera).aspect < 0.8) {
        camera.position.set(0, 1, 3.3);
      }
    } else if (
      kind === "structure" || kind === "fit" || kind === "comparison" || selectionPreset
    ) {
      const ids = props.selectionIds;
      const box = new Box3();
      let count = 0;
      scene.updateMatrixWorld(true);
      const fitVisible = kind === "fit" || (selectionPreset && detailContext);
      if (fitVisible) {
        scene.traverse(obj => {
          if (obj instanceof Mesh && obj.visible && structureById.has(obj.name)) {
            box.union(new Box3().setFromObject(obj));
            count++;
          }
        });
      } else {
        for (const id of ids) {
          const obj = scene.getObjectByName(id);
          if (obj) {
            box.union(new Box3().setFromObject(obj));
            count++;
          }
        }
      }
      if (!count || (!fitVisible && count !== ids.length) || box.isEmpty()) return;
      const direction = selectionPreset ? new Vector3(kind === "side" ? 1 : 0, 0, kind === "side" ? 0 : kind === "back" ? -1 : 1)
        : camera.position.clone().sub(c.target).normalize();
      box.getCenter(c.target);
      const cam = camera as PerspectiveCamera;
      if (direction.lengthSq() < 0.1) direction.set(0, 0, 1);
      const distance = framedDistance(box, direction, cam.fov, cam.aspect,
        framed ? observationWidth / gl.domElement.clientWidth : 1,
        framed ? observationHeight / gl.domElement.clientHeight : 1,
        mobile ? 1.3 : kind === "comparison" ? 2.6 : 1.65);
      camera.position.copy(c.target).addScaledVector(direction, distance);
    } else if (action.kind === "region") {
      if (!markers.length) return;
      const box = new Box3().setFromPoints(markers.map(m => m.position));
      const size = box.getSize(new Vector3());
      box.getCenter(c.target);
      const cam = camera as PerspectiveCamera;
      const tangent = Math.tan(cam.fov * Math.PI / 360);
      const distance = Math.max(size.y / (2 * tangent), size.x / (2 * tangent * cam.aspect), .25) * 1.7 + size.z;
      const back = points.filter(p => p.surface === "back").length > points.length / 2;
      camera.position.copy(c.target).add(new Vector3(0, .08, (back ? -1 : 1) * distance));
    } else if (kind === "anatomy-region") {
      const views: Record<Props["anatomyRegion"], [number, number]> = {
        whole: [.83, 3], head: [1.55, .72], "upper-body": [1.18, 1.65],
        "lower-body": [.46, 1.45], "upper-limb": [1.1, 1.75], "lower-limb": [.43, 1.45],
        chest: [1.18, .88], abdomen: [.91, .78], pelvis: [.68, .72],
      };
      const [height, distance] = views[props.anatomyRegion];
      c.target.set(0, height, 0);
      camera.position.set(0, height + .04, distance);
      if (limbScope) {
        const box = new Box3();
        scene.updateMatrixWorld(true);
        scene.traverseVisible(obj => {
          if (obj instanceof Mesh && structureById.has(obj.name) && (obj.material as MeshStandardMaterial).opacity > .01)
            box.union(new Box3().setFromObject(obj));
        });
        if (!box.isEmpty()) {
          box.getCenter(c.target);
          const cam = camera as PerspectiveCamera;
          const distance = framedDistance(box, new Vector3(0, 0, 1), cam.fov, cam.aspect,
            mobile ? observationWidth / gl.domElement.clientWidth : 1,
            mobile ? observationHeight / gl.domElement.clientHeight : 1, 1.15);
          camera.position.copy(c.target).add(new Vector3(0, 0, distance));
        }
      }
    } else if (action.kind === "head") {
      c.target.set(0, 1.55, 0);
      camera.position.set(0, 1.55, 0.65);
    } else if (action.kind === "focus") {
      const anchor = anchorSource.find(
        (a) => a.pointId === selected.id && a.side !== "left",
      );
      if (!anchor) return;
      const m = {
        position: new Vector3(...(anchor.position as [number, number, number])),
      };
      c.target.copy(m.position);
      const back = selected.surface === "back";
      camera.position
        .copy(m.position)
        .add(
          new Vector3(
            selected.surface === "medial" ? 0.45 : 0,
            0.12,
            back ? -0.8 : 0.8,
          ),
        );
    } else {
      c.target.set(0, 0.83, 0);
      const distance = (camera as PerspectiveCamera).aspect < 0.8 ? 3.3 : 3.0;
      camera.position.set(
        action.kind === "side" ? distance : 0,
        1,
        action.kind === "back"
          ? -distance
          : action.kind === "side"
            ? 0
            : distance,
      );
    }
    executed.current = action.tick;
    framedLayout.current = layoutKey;
    if (hasSelection && (kind === "structure" || kind === "comparison" || kind === "fit" || selectionPreset)) framedFor.current = selectionKey;
    if (kind !== "restore") restoringLayout.current = false;
    const glides = pendingAction && !["restore", "pose"].includes(kind) && !kind.startsWith("move-")
      && !matchMedia("(prefers-reduced-motion: reduce)").matches
      && (from[0].distanceToSquared(camera.position) > 1e-10 || from[1].distanceToSquared(c.target) > 1e-10);
    if (glides) {
      glide.current = { from, to: [camera.position.clone(), c.target.clone()], start: performance.now(), duration: kind === "zoomIn" || kind === "zoomOut" ? 220 : 450 };
      camera.position.copy(from[0]);
      c.target.copy(from[1]);
    }
    c.update();
    if (!glides) emitPose();
    invalidate();
  }, [action, camera, invalidate, scene, revision, emitPose, props.anatomyRegion, layoutKey, hasSelection, selectionKey, selectionCardTop]);
  // Peeled (or see-through) skin leaves muscles and organs under the markers
  // as click targets of their own, so the markers' circles shrink.
  const skinAlpha = props.layers.skin ? props.layerOpacity.skin * dissectionLayerOpacity("skin", props.dissection, props.displayMode === "dissection") : 0;
  const markersOverTissue = skinAlpha < .5 || props.selectionTarget === "internal";
  return (
    <>
      <color attach="background" args={["#07141c"]} />
      <ambientLight intensity={0.34} />
      <hemisphereLight args={["#cfe1ea", "#081017", 0.62]} />
      <directionalLight position={[3, 4, 4]} intensity={2.15} color="#e8f2f5" />
      <directionalLight position={[-3, 2, -3]} intensity={1.05} color="#7695aa" />
      <group>
        {props.sex === "female" || [...props.selectionIds, ...props.detailIds].some(id => id.startsWith("BP4_")) ? (
          <Suspense fallback={<Html center><div className="model-loading">참조 아틀라스 불러오는 중</div></Html>}>
            <PackedAtlas key={referenceSourceFor(props.sex, [...props.selectionIds, ...props.detailIds])} props={{ ...props, onReady: layerReady }} />
          </Suspense>
        ) : layerKeys
          .filter((layer) => layers[layer])
          .map((layer) => (
            <Suspense
              key={layer}
              fallback={layer === "skin" ? <Html center><div className="model-loading">인체 모델 불러오는 중</div></Html> : null}
            >
              {layer !== "lymph" && <AnatomyLayer layer={layer} props={{ ...props, onReady: layerReady }} />}
              {(layer === "nerve" || layer === "vessel") && (
                <WholeBodySupplement
                  layer={layer}
                  props={{ ...props, onReady: layerReady }}
                />
              )}
              {(layer === "bone" || layer === "muscle") && <ConnectiveSupplement layer={layer} props={props} />}
              {layer === "lymph" && <ReferenceModel modelName="lymphatic_male.glb" layer="lymph" props={{ ...props, sex: "male", onReady: layerReady }} />}
            </Suspense>
          ))}
      </group>
      <Markers markers={markers} selectedId={selected.id} labels={labels} overTissue={markersOverTissue} onSelect={onSelect} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]}>
        <circleGeometry args={[0.48, 64]} />
        <meshBasicMaterial color="#19313d" transparent opacity={0.58} />
      </mesh>
      <OrbitControls
        ref={controls}
        target={[0, 0.83, 0]}
        makeDefault
        enableZoom
        enablePan
        zoomSpeed={2.4}
        panSpeed={1}
        minDistance={0.06}
        maxDistance={12}
        onStart={() => { glide.current = null; }}
        onChange={() => {
          if (poseTimer.current) clearTimeout(poseTimer.current);
          poseTimer.current = setTimeout(emitPose, 160);
        }}
        enableDamping
        maxPolarAngle={Math.PI * 0.94}
      />
    </>
  );
}
// Constant canvas options: new objects on each render would make the canvas
// reconfigure (and redraw every system) on unrelated UI updates.
const CANVAS_CAMERA = { position: [0, 1, 3.0] as [number, number, number], fov: 39, near: 0.01, far: 20 };
const CANVAS_DPR: [number, number] = [1, 1.6];
const CANVAS_GL = { antialias: true, localClippingEnabled: true };
// Acupoint markers are drawn above the body, so their hits go first.
const CANVAS_EVENTS = (store: RootStore) => ({ ...pointerEvents(store), filter: markersFirst });
export default memo(function Atlas(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Boundary
      key={attempt}
      onRetry={() => {
        layerKeys.forEach((layer) => useGLTF.clear(assetUrl(`models/${layer}.glb`)));
        useGLTF.clear(assetUrl("models/reference/lymphatic_male.glb"));
        setAttempt((x) => x + 1);
      }}
    >
      <Canvas
        camera={CANVAS_CAMERA}
        frameloop="demand"
        events={CANVAS_EVENTS}
        dpr={CANVAS_DPR}
        gl={CANVAS_GL}
        fallback={
          <div className="viewer-fallback">
            이 브라우저에서는 WebGL을 사용할 수 없습니다. 경혈 목록과 위키에서
            내용을 확인하세요.
          </div>
        }
      >
        <Suspense
          fallback={
            <Html center>
              <div className="model-loading">
                <LoaderCircle className="spin" />
                해부 모델 불러오는 중
              </div>
            </Html>
          }
        >
          <Scene {...props} />
        </Suspense>
      </Canvas>
    </Boundary>
  );
});
