import { assetUrl } from "./assets";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  Component,
  type ReactNode,
} from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
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
  type Intersection,
} from "three";
import type { OrbitControls as OrbitType } from "three-stdlib";
import type { CameraPose } from "./view-state";
import type { Point, Layers, CameraAction } from "./types";
import { layerKeys, type Layer, structures } from "./anatomy";
import meridians from "../data/meridians.json";
import anchors from "../data/anchors.json";
import structurePairs from "../data/structure-pairs.json";
import fullSystemNodes from "../data/full-system-nodes.json";
import { movementKeys, translateView, type MoveDirection } from "./navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";

const structureById = new Map(structures.map(s => [s.id, s]));

type Props = {
  points: Point[];
  selected: Point;
  onSelect: (p: Point) => void;
  layers: Layers;
  opacity: number;
  labels: boolean;
  action: CameraAction;
  onReady: (layer: Layer) => void;
  selectedStructure: string;
  onStructure: (id: string) => void;
  isolated: boolean;
  highlight: string[];
  cutaway: number;
  layerOpacity: Record<Layer, number>;
  selectionIds: string[];
  selectionTarget: "visible" | "internal" | "skin";
  initialPose: CameraPose | null;
  onPose: (pose: CameraPose) => void;
};
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
    clone.traverse(o => {
      if (o instanceof Mesh) o.material = new MeshStandardMaterial({roughness:0.77, side:layer === 'skin' ? FrontSide : DoubleSide});
    });
    return clone;
  }, [model.scene, layer]);
  useEffect(() => () => object.traverse(o => {
    if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) o.material.dispose();
  }), [object]);
  const { invalidate } = useThree();
  useEffect(() => {
    const mirrored = props.selected.structures.flatMap((id) => [
      id,
      (structurePairs as Record<string, string>)[id] || id,
    ]);
    object.traverse((o) => {
      if (!(o instanceof Mesh)) return;
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
      o.visible = !props.isolated || props.selectionIds.includes(id);
      const alpha =
        layer === "skin" ? props.opacity : props.layerOpacity[layer];
      const vessel = structureById.get(id)?.name || "";
      o.raycast = (raycaster, intersections) => {
        if (
          !o.visible ||
          (props.selectionTarget === "internal" && layer === "skin") ||
          (props.selectionTarget === "skin" && layer !== "skin")
        )
          return;
        const hits: Intersection[] = [];
        Mesh.prototype.raycast.call(o, raycaster, hits);
        intersections.push(
          ...hits.filter(
            (hit) =>
              props.cutaway === 0 || hit.point.z <= 0.22 - props.cutaway * 0.44,
          ),
        );
      };
      const material = o.material as MeshStandardMaterial;
      material.color.set(emphasis
          ? emphasis
          : {
              skin: "#aebba9",
              bone: "#e4dec7",
              muscle: "#a45d4f",
              organ: "#ae687b",
              vessel: /vein|vena cava/.test(vessel) ? "#557ba8" : "#bc514c",
              nerve: "#d7af39",
            }[layer]);
      const transparent = alpha < 1;
      const clipping = props.cutaway > 0;
      if (material.transparent !== transparent || Boolean(material.clippingPlanes?.length) !== clipping)
        material.needsUpdate = true;
      material.transparent = transparent;
      material.opacity = alpha;
      material.clippingPlanes =
          props.cutaway > 0
            ? [new Plane(new Vector3(0, 0, -1), 0.22 - props.cutaway * 0.44)]
            : [];
    });
    invalidate();

  }, [
    object,
    props.selected,
    props.selectedStructure,
    props.selectionIds,
    props.selectionTarget,
    props.isolated,
    props.highlight,
    props.opacity,
    props.layerOpacity,
    props.cutaway,
    invalidate,
  ]);
  useEffect(() => {
    if (layer !== "nerve" && layer !== "vessel") props.onReady(layer);
  }, [object, layer, props.onReady]);
  return (
    <primitive
      object={object}
      onClick={(e: { stopPropagation: () => void; object: Mesh }) => {
        e.stopPropagation();
        const id = structureById.has(e.object.name)
          ? e.object.name
          : e.object.parent?.name || "";
        props.onStructure(id);
      }}
    />
  );
}
function WholeBodySupplement({ layer, props }: { layer: "nerve" | "vessel"; props: Props }) {
  const model = useGLTF(
    assetUrl(`models/${layer}-full.glb`),
    assetUrl("draco/"),
  );
  const object = useMemo(() => {
    const clone = model.scene.clone(true);
    const allowed = new Set(
      fullSystemNodes[layer].map((name) => PropertyBinding.sanitizeNodeName(name)),
    );
    clone.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      item.visible = allowed.has(item.name);
      item.material = new MeshStandardMaterial({ roughness: 0.76, side: DoubleSide });
      item.raycast = () => {};
    });
    return clone;
  }, [model.scene]);
  const { invalidate } = useThree();
  useEffect(() => {
    object.visible = !props.isolated;
    object.traverse((item) => {
      if (!(item instanceof Mesh)) return;
      const material = item.material as MeshStandardMaterial;
      material.color.set(layer === "nerve" ? "#d7af39" : "#a9434f");
      const alpha = props.layerOpacity[layer];
      const clipped = props.cutaway > 0;
      if (material.transparent !== (alpha < 1) || Boolean(material.clippingPlanes?.length) !== clipped)
        material.needsUpdate = true;
      material.transparent = alpha < 1;
      material.opacity = alpha;
      material.clippingPlanes = clipped
        ? [new Plane(new Vector3(0, 0, -1), 0.22 - props.cutaway * 0.44)]
        : [];
    });
    invalidate();
  }, [object, layer, props.isolated, props.layerOpacity, props.cutaway, invalidate]);
  useEffect(() => {
    props.onReady(layer);
  }, [object, layer, props.onReady]);
  useEffect(
    () => () =>
      object.traverse((item) => {
        if (item instanceof Mesh && item.material instanceof MeshStandardMaterial)
          item.material.dispose();
      }),
    [object],
  );
  return <primitive object={object} />;
}
function Scene(props: Props) {
  const { points, selected, onSelect, layers, labels, action } = props;
  const controls = useRef<OrbitType>(null);
  const markerMeshes = useRef(new Map<string, Mesh>());
  const { camera, invalidate, scene, size, gl } = useThree();
  const keys = useRef(new Set<string>());
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
  useFrame((_, delta) => {
    const c = controls.current;
    const directions = [...keys.current].map(key => movementKeys[key]).filter(Boolean);
    if (!c || !directions.length) return;
    const speed = (keys.current.has('ShiftLeft') || keys.current.has('ShiftRight')) ? 1.5 : 0.5;
    for (const direction of directions) translateView(camera, c.target, direction, speed * Math.min(delta, 0.05) / Math.sqrt(directions.length));
    c.update(); invalidate();
    if (poseTimer.current) clearTimeout(poseTimer.current);
    poseTimer.current = setTimeout(emitPose, 160);
  });
  useFrame(() => {
    for (const [key, mesh] of markerMeshes.current) {
      const position = mesh.getWorldPosition(new Vector3());
      const pixels = key.startsWith(selected.id + "-") ? 6 : 4;
      const radius =
        (camera.position.distanceTo(position) *
          2 *
          Math.tan(((camera as PerspectiveCamera).fov * Math.PI) / 360) *
          pixels) /
        size.height;
      mesh.scale.setScalar(radius);
    }
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
  const [hover, setHover] = useState<string | null>(null);
  const markers = useMemo(
    () =>
      anchors
        .filter((a) => points.some((p) => p.id === a.pointId))
        .map((a) => ({
          point: points.find((p) => p.id === a.pointId)!,
          key: a.key,
          occurrence: a.occurrence,
          position: new Vector3(...(a.position as [number, number, number])),
          side:
            a.side === "right"
              ? "오른쪽"
              : a.side === "left"
                ? "왼쪽"
                : "정중선",
        })),
    [points],
  );
  useEffect(() => {
    // Report committed mesh membership, also useful for diagnosing crowded views.
    gl.domElement.dataset.renderedMarkers = String(markerMeshes.current.size);
    gl.domElement.dataset.renderedPointIds = [...new Set([...markerMeshes.current.values()].map(m => m.userData.pointId))].sort().join(',');
  }, [markers, gl]);
  useEffect(() => {
    const c = controls.current;
    if (!c || executed.current === action.tick) return;
    if (action.kind.startsWith("move-")) {
      translateView(camera, c.target, action.kind.slice(5) as MoveDirection, 0.12);
    } else if (action.kind === "zoomIn" || action.kind === "zoomOut")
      camera.position
        .sub(c.target)
        .multiplyScalar(action.kind === "zoomIn" ? 0.8 : 1.25)
        .add(c.target);
    else if (action.kind === "restore") {
      if (initialPose.current) {
        camera.position.fromArray(initialPose.current.position);
        c.target.fromArray(initialPose.current.target);
      } else if ((camera as PerspectiveCamera).aspect < 0.8) {
        camera.position.set(0, 1, 3.3);
      }
    } else if (
      action.kind === "structure" ||
      action.kind === "fit" ||
      action.kind === "comparison"
    ) {
      const ids =
        (action.kind === "structure" || action.kind === "comparison")
          ? props.selectionIds
          : structures
              .filter(
                (s) =>
                  (action.kind === "comparison"
                    ? s.layer === "organ"
                    : layers[s.layer]) &&
                  (!props.isolated || props.selectionIds.includes(s.id)),
              )
              .map((s) => s.id);
      const box = new Box3();
      let count = 0;
      scene.updateMatrixWorld(true);
      for (const id of ids) {
        const obj = scene.getObjectByName(id);
        if (obj) {
          box.union(new Box3().setFromObject(obj));
          count++;
        }
      }
      if (count !== ids.length || box.isEmpty()) return;
      const size = box.getSize(new Vector3());
      box.getCenter(c.target);
      const cam = camera as PerspectiveCamera;
      const tangent = Math.tan((cam.fov * Math.PI) / 360);
      const distance =
        Math.max(
          size.y / 2 / tangent,
          size.x / 2 / (tangent * cam.aspect),
          0.12,
        ) *
          (action.kind === "comparison" ? 2.6 : 1.65) +
        size.z / 2;
      const direction = camera.position.clone().sub(c.target).normalize();
      if (direction.lengthSq() < 0.1) direction.set(0, 0, 1);
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
    } else if (action.kind === "head") {
      c.target.set(0, 1.55, 0);
      camera.position.set(0, 1.55, 0.65);
    } else if (action.kind === "focus") {
      const anchor = anchors.find(
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
    c.update();
    emitPose();
    invalidate();
  }, [action, camera, invalidate, scene, revision, emitPose]);
  return (
    <>
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#fffdf1", "#899886", 0.7]} />
      <directionalLight position={[3, 4, 4]} intensity={1.7} />
      <directionalLight position={[-3, 2, -3]} intensity={0.85} />
      <group>
        {layerKeys
          .filter((layer) => layers[layer])
          .map((layer) => (
            <Suspense
              key={layer}
              fallback={
                <Html center>
                  <div className="model-loading">{layer} 모델 불러오는 중</div>
                </Html>
              }
            >
              <AnatomyLayer
                layer={layer}
                props={{ ...props, onReady: layerReady }}
              />
              {(layer === "nerve" || layer === "vessel") && (
                <WholeBodySupplement
                  layer={layer}
                  props={{ ...props, onReady: layerReady }}
                />
              )}
            </Suspense>
          ))}
      </group>
      {markers.map((m) => {
        const active = m.point.id === selected.id;
        const color = meridians.find((x) => x.id === m.point.meridian)!.color;
        return (
          <group key={m.key} position={m.position}>
            <mesh
              ref={(mesh) => {
                if (mesh) markerMeshes.current.set(m.key, mesh);
                else markerMeshes.current.delete(m.key);
              }}
              userData={{ pointId: m.point.id }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(m.point);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHover(m.key);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                setHover(null);
                document.body.style.cursor = "auto";
              }}
              renderOrder={20}
            >
              <sphereGeometry args={[1, 16, 12]} />
              <meshBasicMaterial
                color={active ? "#e1ad5a" : color}
                depthTest={false}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {((active && m.side !== "왼쪽" && m.occurrence === 0) || hover === m.key || (labels && m.occurrence === 0)) && (
              <Html
                center
                zIndexRange={[20, 0]}
                position={[active ? -0.06 : 0.025, 0.012, 0]}
              >
                <button
                  className={`point-label ${active ? "active" : ""}`}
                  title={`${m.point.name} ${m.side}`}
                  aria-label={`${m.point.name} ${m.point.id} ${m.side} 선택`}
                  onClick={() => onSelect(m.point)}
                >
                  {m.point.id}
                  {active && <span>{m.point.name}</span>}
                </button>
              </Html>
            )}
          </group>
        );
      })}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.018, 0]}>
        <circleGeometry args={[0.48, 64]} />
        <meshBasicMaterial color="#dae2d6" transparent opacity={0.55} />
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
export default function Atlas(props: Props) {
  const [attempt, setAttempt] = useState(0);
  return (
    <Boundary
      key={attempt}
      onRetry={() => {
        layerKeys.forEach((layer) => useGLTF.clear(assetUrl(`models/${layer}.glb`)));
        setAttempt((x) => x + 1);
      }}
    >
      <Canvas
        camera={{ position: [0, 1, 3.0], fov: 39, near: 0.01, far: 20 }}
        frameloop="demand"
        dpr={[1, 1.6]}
        gl={{ antialias: true, localClippingEnabled: true }}
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
}
