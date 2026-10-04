import { BufferAttribute, type BufferGeometry, Mesh } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { assetUrl } from "./assets";
import { musclePeelRanks } from "./muscle-peel";
import femaleTransportStructures from "../data/female-transport-structures.json";

// Male-derived structures carried into the HRA female body by one fitted
// registration field (scripts/female-transport/): Z-Anatomy vessels, nerves,
// ligaments, tendons and lymph, BodyParts3D muscles and missing bones. The
// same field re-places the 180 borrowed bones. Nothing here is a female
// source; docs/anatomy-alignment/FEMALE_TRANSPORT.md.
export type FemaleTransportManifest = {
  version: number;
  field: { sha256: string; report: string };
  files: { system: string; path: string; bytes: number; sha256: string; structures: number }[];
  placement: { url: string; bytes: number; gzipBytes: number; sha256: string; parts: { id: string; offset: number; vertexCount: number; sourceSha256: string; kind: string; surfaceTone?: boolean }[] };
};
export const femaleTransportEntries = (femaleTransportStructures as { transport: string; system: string; peelScore?: number }[])
  .map(row => ({ ...row, id: `FT_${row.transport}` }));
const entryById = new Map(femaleTransportEntries.map(entry => [entry.id, entry]));
export const isFemaleTransportId = (id: string) => entryById.has(id);
// HRA models only short segments of these vessels; the overview shows the
// whole carried vessels so their branches connect, and these wait for search.
export const femalePartialVesselIds = new Set(["HRAF0726", "HRAF0733", "HRAF0734", "HRAF0735", "HRAF0736"]);

// Transported muscles peel in the male order: the male source ids and the
// scores the male view computes from its own geometry.
export const femaleTransportPeelRanks = (() => {
  const muscles = femaleTransportEntries.filter(entry => entry.peelScore !== undefined);
  const ranks = musclePeelRanks(muscles.map(entry => ({ id: entry.transport, score: entry.peelScore! })));
  return new Map(muscles.map(entry => [entry.id, ranks.get(entry.transport)!]));
})();

async function inflate(response: Response, expectedBytes: number) {
  const compressed = await response.arrayBuffer();
  if (compressed.byteLength === expectedBytes) return compressed;
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const result = await new Response(stream).arrayBuffer();
  if (result.byteLength !== expectedBytes) throw new Error(`정합장 배치 크기 오류: ${result.byteLength}/${expectedBytes}`);
  return result;
}

export async function loadFemaleTransport(signal: AbortSignal) {
  const manifest = await fetch(assetUrl("models/female-transport/manifest.json"), { signal }).then(response => {
    if (!response.ok) throw new Error(`여성 정합 보완 목록 ${response.status}`);
    return response.json() as Promise<FemaleTransportManifest>;
  });
  const draco = new DRACOLoader().setDecoderPath(assetUrl("draco/"));
  const loader = new GLTFLoader().setDRACOLoader(draco);
  try {
    const [scenes, placementBuffer] = await Promise.all([
      Promise.all(manifest.files.map(file => loader.loadAsync(assetUrl(file.path)))),
      fetch(assetUrl(manifest.placement.url), { signal }).then(response => {
        if (!response.ok) throw new Error(`정합장 배치 ${response.status}`);
        return inflate(response, manifest.placement.bytes);
      }),
    ]);
    signal.throwIfAborted();
    const meshes: Mesh[] = [];
    for (const gltf of scenes) gltf.scene.traverse(item => {
      if (item instanceof Mesh && entryById.has(item.name)) meshes.push(item);
    });
    for (const mesh of meshes) mesh.removeFromParent();
    const expected = manifest.files.reduce((sum, file) => sum + file.structures, 0);
    if (meshes.length !== expected) throw new Error(`여성 정합 보완 ${meshes.length}/${expected}`);
    const placement = new Map(manifest.placement.parts.map(part => [part.id, new Float32Array(placementBuffer, part.offset, part.vertexCount * 3)]));
    // Borrowed bones that touch the male skin in their source take the skin tone too.
    const toned = new Set(manifest.placement.parts.filter(part => part.surfaceTone).map(part => part.id));
    return { manifest, meshes, placement, toned };
  } finally {
    draco.dispose();
  }
}

// The field's placement of a borrowed bone replaces the regional transforms;
// the reference brain's placement fits it into the field's cranium.
export function applyFieldPlacement(geometry: BufferGeometry, positions: Float32Array | undefined) {
  if (!positions) return;
  if (positions.length !== geometry.attributes.position.count * 3) throw new Error("정합장 배치 정점 수 불일치");
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.userData.femaleTransport = true;
}
