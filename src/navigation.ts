import { Vector3, type Camera } from 'three';

export type MoveDirection = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down';
export const movementKeys: Record<string, MoveDirection> = {
  KeyW: 'forward', ArrowUp: 'forward', KeyS: 'backward', ArrowDown: 'backward',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  KeyQ: 'down', KeyE: 'up',
};

// Translate eye and orbit target together, preserving viewing direction and zoom.
export function translateView(camera: Camera, target: Vector3, direction: MoveDirection, distance: number) {
  const forward = camera.getWorldDirection(new Vector3());
  const right = new Vector3().crossVectors(forward, camera.up).normalize();
  const move = direction === 'up' || direction === 'down'
    ? camera.up.clone().normalize().multiplyScalar(direction === 'up' ? 1 : -1)
    : direction === 'left' || direction === 'right'
      ? right.multiplyScalar(direction === 'right' ? 1 : -1)
      : forward.multiplyScalar(direction === 'forward' ? 1 : -1);
  move.multiplyScalar(distance);
  // Bound navigation around this metre-scale atlas; reset/fit remains available.
  if (camera.position.clone().add(move).length() > 12) return;
  camera.position.add(move);
  target.add(move);
}
