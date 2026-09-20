import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { BufferAttribute, BufferGeometry, DoubleSide, FrontSide, Group, Int16BufferAttribute, Mesh, MeshStandardMaterial } from "three";
import { assetUrl } from "./assets";
import { dissectionLayerOpacity, layerKeys, structures, type Layer } from "./anatomy";
import type { AtlasProps } from "./Atlas";
import { musclePeelOpacity } from "./dissection";
import { musclePeelRanks } from "./muscle-peel";
import { clippingPlanes, configurePicking } from "./anatomy-rendering";
import { referenceSourceFor } from "./reference-source";
import { applyFemaleArmRegistration } from "./female-arm-registration";

type FemalePart = {
  id: string;
  name: string;
  system: string;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
  bounds: [[number, number, number], [number, number, number]];
};
type FemaleManifest = {
  parts: FemalePart[];
  chunks: { url: string; bytes: number; gzip: string; gzipBytes: number }[];
};

const systemLayer: Record<string, Layer> = {
  integumentary: "skin", muscular: "muscle", "donor-muscle": "muscle",
  skeletal: "bone", borrowed: "bone", connective: "bone",
  digestive: "organ", respiratory: "organ", urinary: "organ", reproductive: "organ", pregnancy: "organ", cardiac: "organ",
  arterial: "vessel", venous: "vessel", lymphatic: "lymph",
  brain: "nerve", nervous: "nerve", sensory: "nerve",
};
const layerColor: Record<Layer, string> = {
  skin: "#b9826f", muscle: "#b43f3f", bone: "#e8dec5", organ: "#a94d60",
  vessel: "#d33f49", lymph: "#58b99f", nerve: "#f0c94f",
};
const catalogById = new Map(structures.map(structure => [structure.id, structure]));
function regionMatches(bounds: FemalePart["bounds"], region: AtlasProps["anatomyRegion"]) {
  if (region === "whole") return true;
  const [min, max] = bounds;
  if (region === "head") return max[1] >= 1.42;
  if (region === "upper-body") return max[1] >= .82;
  if (region === "lower-body") return min[1] < .92;
  if (region === "upper-limb") return (max[0] >= .18 || min[0] <= -.18) && max[1] >= .72;
  if (region === "lower-limb") return (max[0] >= .07 || min[0] <= -.07) && min[1] < .82;
  if (region === "chest") return max[1] >= 1.05 && min[1] < 1.42;
  if (region === "abdomen") return max[1] >= .78 && min[1] < 1.08;
  return max[1] >= .55 && min[1] < .82;
}
async function inflate(response: Response, expectedBytes: number) {
  const compressed = await response.arrayBuffer();
  if (compressed.byteLength === expectedBytes) return compressed;
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const result = await new Response(stream).arrayBuffer();
  if (result.byteLength !== expectedBytes) throw new Error(`참조 모델 청크 크기 오류: ${result.byteLength}/${expectedBytes}`);
  return result;
}

export default function PackedAtlas({ props }: { props: AtlasProps }) {
  const dataset = referenceSourceFor(props.sex, [...props.selectionIds, ...props.detailIds]);
  const [object, setObject] = useState<Group | null>(null);
  const [manifest, setManifest] = useState<FemaleManifest | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { gl, invalidate } = useThree();
  useEffect(() => {
    const abort = new AbortController();
    props.onLoading(true);
    let built: Group | null = null;
    (async () => {
      const atlas = await fetch(assetUrl(`models/${dataset}/${dataset === "female" ? "atlas-female.json" : "atlas.json"}`), { signal: abort.signal }).then(r => {
        if (!r.ok) throw new Error(`참조 모델 목록 ${r.status}`);
        return r.json() as Promise<FemaleManifest>;
      });
      const buffers = await Promise.all(atlas.chunks.map(async (chunk) => {
        const file = chunk.gzip.split("/").pop()!;
        const response = await fetch(assetUrl(`models/${dataset}/${file}`), { signal: abort.signal });
        if (!response.ok) throw new Error(`참조 모델 ${file} ${response.status}`);
        return inflate(response, chunk.bytes);
      }));
      if (abort.signal.aborted) return;
      const group = new Group();
      group.name = `${dataset}-atlas`;
      for (const part of atlas.parts) {
        const layer = catalogById.get(part.id)?.layer || systemLayer[part.system];
        if (!layer) continue;
        const buffer = buffers[part.chunk];
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(buffer, part.positions, part.vertexCount * 3), 3));
        geometry.setAttribute("normal", new Int16BufferAttribute(new Int16Array(buffer, part.normals, part.vertexCount * 3), 3, true));
        geometry.setIndex(new BufferAttribute(new Uint32Array(buffer, part.indices, part.indexCount), 1));
        applyFemaleArmRegistration(geometry, dataset, part.id, part.system);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        const actualBounds = [geometry.boundingBox!.min.toArray(), geometry.boundingBox!.max.toArray()];
        const material = new MeshStandardMaterial({ color: layerColor[layer], roughness: .72, metalness: .01, side: layer === "skin" ? FrontSide : DoubleSide });
        const mesh = new Mesh(geometry, material);
        mesh.name = part.id;
        mesh.userData = { layer, system: part.system, bounds: actualBounds, sourceName: part.name };
        group.add(mesh);
      }
      const muscles = group.children.filter(mesh => mesh.userData.layer === "muscle");
      const ranks = musclePeelRanks(muscles.map(mesh => {
        const [min, max] = mesh.userData.bounds as FemalePart["bounds"];
        return { id: mesh.name, score: Math.hypot((max[0] + min[0]) / 2, (max[2] + min[2]) / 2) };
      }));
      muscles.forEach(mesh => { mesh.userData.peelRank = ranks.get(mesh.name)!; });
      built = group;
      setManifest(atlas);
      setObject(group);
    })().catch(error => {
      if (!abort.signal.aborted) setError(error instanceof Error ? error : new Error(String(error)));
    });
    return () => {
      abort.abort();
      props.onLoading(false);
      built?.traverse(item => {
        if (!(item instanceof Mesh)) return;
        item.geometry.dispose();
        if (item.material instanceof MeshStandardMaterial) item.material.dispose();
      });
    };
  }, [props.onLoading, dataset]);
  const partById = useMemo(() => new Map(manifest?.parts.map(part => [part.id, part]) || []), [manifest]);
  useEffect(() => {
    if (!object) return;
    const progressive = props.displayMode === "dissection";
    const counts = Object.fromEntries(layerKeys.map(layer => [layer, 0])) as Record<Layer, number>;
    object.traverse(item => {
      if (!(item instanceof Mesh)) return;
      const layer = item.userData.layer as Layer;
      const selected = props.selectionIds.includes(item.name);
      const highlighted = props.highlight.includes(item.name);
      const part = partById.get(item.name);
      const depthAlpha = dissectionLayerOpacity(layer, props.dissection, progressive) * (progressive && layer === "muscle" ? musclePeelOpacity(props.dissection, item.userData.peelRank) : 1);
      const duplicateDonor = part?.system === "donor-muscle" && (part.name === "Rectus femoris (left)" || part.name === "Rectus femoris (right)");
      const donorSelected = (item.name === "HRAF0394" && props.selectionIds.includes("VHF0009")) || (item.name === "HRAF0396" && props.selectionIds.includes("VHF0047"));
      item.visible = (!duplicateDonor || selected) && (part?.system !== "pregnancy" || selected) && props.layers[layer] && (!props.isolated || selected) && (selected || depthAlpha > .01) && (!part || selected || regionMatches(item.userData.bounds, props.anatomyRegion));
      item.visible = item.visible && !donorSelected;
      item.visible = item.visible && (!props.detailIds.length || props.detailIds.includes(item.name));
      if (props.sex === "male" && !props.detailIds.length) item.visible = item.visible && selected;
      if (item.visible) counts[layer]++;
      const material = item.material as MeshStandardMaterial;
      material.color.set(selected && props.selectionIds.length === 1 ? "#34d3dd" : highlighted ? "#e5b24f" : part?.system === "venous" ? "#356fb3" : part?.system === "borrowed" ? "#9aa7b1" : layerColor[layer]);
      material.opacity = selected ? 1 : props.layerOpacity[layer] * depthAlpha;
      const planes = clippingPlanes(layer, props);
      if (material.transparent !== (material.opacity < .995) || (material.clippingPlanes?.length || 0) !== planes.length) material.needsUpdate = true;
      material.transparent = material.opacity < .995;
      material.depthWrite = material.opacity > .45;
      material.clippingPlanes = planes;
      configurePicking(item, layer, props.selectionTarget);
    });
    for (const layer of layerKeys) gl.domElement.dataset[`visible${layer[0].toUpperCase()}${layer.slice(1)}`] = String(counts[layer]);
    for (const [source, key] of [["female", "femaleAtlasParts"], ["female-detail", "femaleDetailParts"], ["male-detail", "maleDetailParts"]])
      gl.domElement.dataset[key] = source === dataset ? String(object.children.length) : "0";
    invalidate();
  }, [object, partById, props.layers, props.isolated, props.selectionIds, props.detailIds, props.highlight, props.dissection, props.displayMode, props.selectionTarget, props.layerOpacity, props.anatomyRegion, props.cutaway, gl, invalidate]);
  useEffect(() => { if (object) { layerKeys.forEach(props.onReady); props.onLoading(false); } }, [object, props.onReady, props.onLoading]);
  if (error) throw error;
  if (!object) return <Html center><div className="model-loading">참조 모델 불러오는 중</div></Html>;
  return <primitive object={object} onClick={(event: { stopPropagation: () => void; object: Mesh }) => {
    if (!partById.has(event.object.name)) return;
    event.stopPropagation();
    props.onStructure(event.object.name);
  }} />;
}
