import {Box3, Vector3} from "three";

// Fit all box corners in the camera's own axes, including oblique/side views.
// Geometry stays unchanged; only viewing distance is computed here.
export function framedDistance(box: Box3, direction: Vector3, fov: number, aspect: number,
  widthFraction = 1, heightFraction = 1, padding = 1.15) {
  const forward = direction.clone().normalize();
  if (forward.lengthSq() < .1) forward.set(0,0,1);
  const right = new Vector3(0,1,0).cross(forward);
  if (right.lengthSq() < 1e-8) right.set(1,0,0);
  right.normalize();
  const up = forward.clone().cross(right).normalize();
  const center = box.getCenter(new Vector3());
  const tan = Math.tan(fov * Math.PI / 360);
  let distance = .12;
  for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
    const p = new Vector3(x?box.max.x:box.min.x,y?box.max.y:box.min.y,z?box.max.z:box.min.z).sub(center);
    distance = Math.max(distance, p.dot(forward) + padding * Math.max(
      Math.abs(p.dot(right)) / (tan * aspect * widthFraction),
      Math.abs(p.dot(up)) / (tan * heightFraction)));
  }
  return distance;
}
