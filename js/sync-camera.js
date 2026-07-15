// ============================================================================
//  Sync & Camera — physics → mesh transform sync + camera positioning
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { vehicles, playerVehicle, camera, camMode, keys, nitroActive } from './state.js';



const _camOff = new THREE.Vector3(), _camDes = new THREE.Vector3(), _camLook = new THREE.Vector3();
let _camShake = 0;

export function syncVehicle(v) {
  const wt = v.vehicle.getChassisWorldTransform();
  const o = wt.getOrigin(), r = wt.getRotation();
  v.mesh.position.set(o.x(), o.y(), o.z());
  v.mesh.quaternion.set(r.x(), r.y(), r.z(), r.w());
  for (let i = 0; i < 4; i++) {
    v.vehicle.updateWheelTransform(i, true);
    const w = v.vehicle.getWheelTransformWS(i);
    const wo = w.getOrigin(), wr = w.getRotation();
    v.wheels[i].position.set(wo.x(), wo.y(), wo.z());
    v.wheels[i].quaternion.set(wr.x(), wr.y(), wr.z(), wr.w());
  }
}

export function updateCamera(dt) {
  const v = playerVehicle;
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;
  let dist, height, fov, lerp;
  if (camMode === 1) { dist = 1.8; height = 1.4; fov = 78; lerp = 0.3; }
  else if (camMode === 2) { dist = CFG.cameraDistance * 1.7 + Math.min(speedKmh * 0.05, 7); height = CFG.cameraHeight * 1.5 + Math.min(speedKmh * 0.01, 1.5); fov = 55; lerp = 0.1; }
  else { dist = CFG.cameraDistance + Math.min(speedKmh * 0.04, 6); height = CFG.cameraHeight + Math.min(speedKmh * 0.01, 1.3); fov = 60 + Math.min(speedKmh * 0.08, 14); lerp = 0.12; }
  camera.fov += (fov - camera.fov) * 0.08; camera.updateProjectionMatrix();
  _camOff.set(0, height, camMode === 1 ? dist : -dist);
  _camOff.applyQuaternion(v.mesh.quaternion);
  _camDes.copy(v.mesh.position).add(_camOff);
  if (speedKmh > 110 || keys.space || nitroActive) _camShake = Math.min(_camShake + dt * 3, nitroActive ? 2 : 1);
  else _camShake = Math.max(_camShake - dt * 3, 0);
  if (_camShake > 0) {
    _camDes.x += (Math.random() - 0.5) * 0.18 * _camShake;
    _camDes.y += (Math.random() - 0.5) * 0.12 * _camShake;
  }
  camera.position.lerp(_camDes, lerp);
  if (camMode === 1) _camLook.set(0, 0.5, 25).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
  else _camLook.set(0, 0.7, dist * 0.4).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
  camera.lookAt(_camLook);
}
