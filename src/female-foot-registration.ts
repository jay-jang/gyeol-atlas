import { BufferAttribute, BufferGeometry, Matrix4 } from "three";
import registration from "../data/catalog/female-foot-registration.json" with { type: "json" };

const records = new Map(registration.records.map(record => [record.id, record]));

// Static partial toe rest pose, only on private female borrowed-bone geometry.
// Native HRA organs, the ankle and all independent datasets remain untouched.
export function applyFemaleFootRegistration(geometry: BufferGeometry, dataset: string, id: string, system: string) {
  if (dataset !== "female") return false;
  const record = records.get(id);
  if (!record) return false;
  if (system !== "borrowed") throw new Error(`보완 발뼈 출처 불일치: ${id}`);
  if (geometry.userData.femaleFootRegistration) {
    if (geometry.userData.femaleFootRegistration === `${registration.version}/${id}`) return false;
    throw new Error(`보완 발뼈 중복 정합: ${id}`);
  }
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  if (position.count !== record.vertexCount || geometry.getIndex()?.count !== record.indexCount)
    throw new Error(`보완 발뼈 버전 불일치: ${id}`);
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(position.array), 3));
  if (normal) {
    const values = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) values.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
    geometry.setAttribute("normal", new BufferAttribute(values, 3));
  }
  const m = record.linear, t = record.translation;
  geometry.applyMatrix4(new Matrix4().set(
    m[0][0], m[1][0], m[2][0], t[0],
    m[0][1], m[1][1], m[2][1], t[1],
    m[0][2], m[1][2], m[2][2], t[2],
    0, 0, 0, 1,
  ));
  geometry.userData.femaleFootRegistration = `${registration.version}/${id}`;
  return true;
}
