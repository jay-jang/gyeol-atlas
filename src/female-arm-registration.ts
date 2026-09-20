import { BufferAttribute, BufferGeometry, Matrix4 } from "three";
import registration from "../data/catalog/female-arm-registration.json" with { type: "json" };

const records = new Map(registration.records.map(record => [record.id, record]));

// One static rest-pose correction on copied geometry. Peeling and selections
// never modify it. Native HRA parts and independent/male datasets are excluded.
export function applyFemaleArmRegistration(geometry: BufferGeometry, dataset: string, id: string, system: string) {
  if (dataset !== "female") return false;
  const record = records.get(id);
  if (!record) return false;
  if (system !== "borrowed") throw new Error(`보완 골격 출처 불일치: ${id}`);
  if (geometry.userData.femaleArmRegistration) {
    if (geometry.userData.femaleArmRegistration === `${registration.version}/${id}`) return false;
    throw new Error(`보완 골격 중복 정합: ${id}`);
  }
  const position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  if (position.count !== record.vertexCount || geometry.getIndex()?.count !== record.indexCount)
    throw new Error(`보완 골격 버전 불일치: ${id}`);
  // Preserve packed source buffers, and avoid applying a floating-point normal
  // transform directly to the packed normalized Int16 representation.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(position.array), 3));
  if (normal) {
    const values = new Float32Array(normal.count * 3);
    for (let i = 0; i < normal.count; i++) values.set([normal.getX(i), normal.getY(i), normal.getZ(i)], i * 3);
    geometry.setAttribute("normal", new BufferAttribute(values, 3));
  }
  const m = record.linear, t = record.translation;
  // Stored coefficients use row vectors: q[j] = t[j] + sum(p[k] * m[k][j]).
  // Matrix4 acts on column vectors, so its upper 3x3 is intentionally m^T.
  geometry.applyMatrix4(new Matrix4().set(
    m[0][0], m[1][0], m[2][0], t[0],
    m[0][1], m[1][1], m[2][1], t[1],
    m[0][2], m[1][2], m[2][2], t[2],
    0, 0, 0, 1,
  ));
  geometry.userData.femaleArmRegistration = `${registration.version}/${id}`;
  return true;
}
