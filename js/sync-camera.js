import * as THREE from 'three';
import {
  getCamera,
  getPlayerVehicle,
  getCamMode,
  getNitroActive,
  getKeys,
  getSun,
} from './state.js';
import { CFG } from './config.js';

const _transform = { current: null };
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();

export function syncVehicle(v) {
  if (!v || !v.body || !v.mesh) return;

  const ms = v.body.getMotionState();
  if (!ms) return;

  if (!_transform.current) {
    _transform.current = new Ammo.btTransform();
  }
  const tf = _transform.current;
  ms.getWorldTransform(tf);
  const origin = tf.getOrigin();
  const rotation = tf.getRotation();

  v.mesh.position.set(origin.x(), origin.y(), origin.z());
  v.mesh.quaternion.set(rotation.x(), rotation.y(), rotation.z(), rotation.w());

  // Wheels
  for (let i = 0; i < 4; i++) {
    v.vehicle.updateWheelTransform(i, true);
    const wt = v.vehicle.getWheelTransformWS(i);
    const wo = wt.getOrigin();
    const wr = wt.getRotation();
    if (v.wheels[i]) {
      v.wheels[i].position.set(wo.x(), wo.y(), wo.z());
      v.wheels[i].quaternion.set(wr.x(), wr.y(), wr.z(), wr.w());
    }
  }
}

let _camPos = new THREE.Vector3(0, 10, 20);
let _camLook = new THREE.Vector3();
let _currentFov = 60;

export function updateCamera(dt) {
  const camera = getCamera();
  const player = getPlayerVehicle();
  if (!camera || !player || !player.mesh) return;

  const mode = getCamMode();
  const mesh = player.mesh;
  const lv = player.body.getLinearVelocity();
  const speedMs = Math.hypot(lv.x(), lv.y(), lv.z());
  const speedKmh = speedMs * 3.6;
  const keys = getKeys();
  const nitro = getNitroActive();

  let dist, height, targetFov, lerpSpeed;

  if (mode === 1) {
    // Hood / cockpit
    dist = 1.8;
    height = 1.4;
    targetFov = 78;
    lerpSpeed = 0.3;
  } else if (mode === 2) {
    // Far
    dist = CFG.cameraDistance * 1.7 + Math.min(speedKmh * 0.05, 7);
    height = CFG.cameraHeight * 1.5 + Math.min(speedKmh * 0.01, 1.5);
    targetFov = 55;
    lerpSpeed = 0.1;
  } else {
    // Chase
    dist = CFG.cameraDistance + Math.min(speedKmh * 0.04, 6);
    height = CFG.cameraHeight + Math.min(speedKmh * 0.01, 1.3);
    targetFov = 60 + Math.min(speedKmh * 0.08, 14);
    lerpSpeed = 0.12;
  }

  // Desired offset in car space
  const offset = new THREE.Vector3(0, height, mode === 1 ? dist : -dist);
  offset.applyQuaternion(mesh.quaternion);
  const desired = mesh.position.clone().add(offset);

  // Shake
  let shake = 0;
  if (speedKmh > 110 || keys.space || nitro) {
    shake = nitro ? 2.0 : 1.0;
    desired.x += (Math.random() - 0.5) * shake * 0.05;
    desired.y += (Math.random() - 0.5) * shake * 0.03;
    desired.z += (Math.random() - 0.5) * shake * 0.05;
  }

  _camPos.lerp(desired, Math.min(1, lerpSpeed * (60 * dt)));
  camera.position.copy(_camPos);

  // Look at
  const lookDist = mode === 1 ? 20 : 8;
  const lookAhead = new THREE.Vector3(0, 0.5, lookDist).applyQuaternion(mesh.quaternion);
  _camLook.lerp(mesh.position.clone().add(lookAhead), Math.min(1, 0.2 * 60 * dt));
  camera.lookAt(_camLook);

  // FOV
  _currentFov += (targetFov - _currentFov) * 0.08;
  camera.fov = _currentFov;
  camera.updateProjectionMatrix();

  // Sun follows player
  const sun = getSun();
  if (sun) {
    const sunOffset = sun.position.clone().normalize().multiplyScalar(80);
    sun.position.copy(mesh.position).add(sunOffset);
    sun.target.position.copy(mesh.position);
    sun.target.updateMatrixWorld();
  }
}
