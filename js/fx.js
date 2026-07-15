import * as THREE from 'three';
import {
  getCamera,
  getKeys,
  getCurrentSceneDef,
  getExhaustSys,
  getDustSys,
  getNitroFlameSys,
  getSpeedLines,
  setSpeedLines,
  getNitroActive,
} from './state.js';
import { emitParticle } from './particles.js';

export function emitExhaustFx(v, speedKmh, drifting) {
  const sys = v.exhaust || getExhaustSys();
  if (!sys || !v.mesh) return;
  const keys = getKeys();
  const scn = getCurrentSceneDef();

  let intensity = 0;
  if (v.isPlayer) {
    intensity = keys.w ? 1 : 0.2;
  } else {
    intensity = v.aiState ? Math.max(0.2, v.aiState.accel) : 0.3;
  }
  if (drifting) intensity *= 1.5;
  if (intensity < 0.15) return;

  const mesh = v.mesh;
  const quat = mesh.quaternion;
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

  let color = 0x666666;
  if (speedKmh > 120) color = 0x333333;
  if (scn && scn.id === 'snow') color = 0xdddddd;

  for (let side = -1; side <= 1; side += 2) {
    if (Math.random() > intensity) continue;
    const ox = mesh.position.x - back.x * 2.0 + right.x * side * 0.4 + up.x * 0.25;
    const oy = mesh.position.y - back.y * 2.0 + right.y * side * 0.4 + up.y * 0.25;
    const oz = mesh.position.z - back.z * 2.0 + right.z * side * 0.4 + up.z * 0.25;
    emitParticle(
      sys,
      ox, oy, oz,
      -back.x * (2 + Math.random() * 3) + (Math.random() - 0.5),
      0.5 + Math.random() * 1.5,
      -back.z * (2 + Math.random() * 3) + (Math.random() - 0.5),
      0.2 + Math.random() * 0.3,
      color
    );
  }
}

export function emitWheelDust(v, speedKmh, hard) {
  if (speedKmh < 15) return;
  const sys = v.dustSys || getDustSys();
  if (!sys || !v.mesh) return;
  const scn = getCurrentSceneDef();

  if (scn && scn.id === 'forest' && !hard) return;

  let intensity = 0.4;
  if (hard) intensity = 2;
  else if (scn && scn.id === 'desert') intensity = 1;

  const color = scn ? scn.dustColor : 0xcccccc;
  const mesh = v.mesh;
  const quat = mesh.quaternion;
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

  // rear wheels
  for (let side = -1; side <= 1; side += 2) {
    if (Math.random() > intensity * 0.5) continue;
    const ox = mesh.position.x + right.x * side * 0.9 - back.x * 1.2;
    const oy = mesh.position.y + 0.1;
    const oz = mesh.position.z + right.z * side * 0.9 - back.z * 1.2;
    emitParticle(
      sys,
      ox, oy, oz,
      (Math.random() - 0.5) * 2,
      0.5 + Math.random() * 2,
      (Math.random() - 0.5) * 2,
      0.15 + Math.random() * 0.25,
      color
    );
  }
}

export function emitNitroFlames(v) {
  const sys = getNitroFlameSys();
  if (!sys || !v.mesh) return;
  const mesh = v.mesh;
  const quat = mesh.quaternion;
  const back = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

  for (let side = -1; side <= 1; side += 2) {
    const color = Math.random() < 0.5 ? 0x00ffff : 0xff8800;
    const ox = mesh.position.x - back.x * 2.1 + right.x * side * 0.35;
    const oy = mesh.position.y + 0.2;
    const oz = mesh.position.z - back.z * 2.1 + right.z * side * 0.35;
    emitParticle(
      sys,
      ox, oy, oz,
      -back.x * 10 + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 1,
      -back.z * 10 + (Math.random() - 0.5) * 2,
      0.3 + Math.random() * 0.3,
      color
    );
  }
}

export function initSpeedLines() {
  const camera = getCamera();
  if (!camera) return;
  const group = new THREE.Group();
  const lines = [];
  for (let i = 0; i < 60; i++) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    const line = new THREE.Line(geo, mat);
    line.userData.life = 0;
    line.userData.maxLife = 0.25 + Math.random() * 0.3;
    group.add(line);
    lines.push(line);
  }
  camera.add(group);
  setSpeedLines({ group, lines });
}

export function updateSpeedLines(speedKmh) {
  const sl = getSpeedLines();
  if (!sl) return;
  const intensity = Math.max(0, (speedKmh - 80) / 120);
  const opacity = Math.min(0.8, intensity * 0.8);

  for (const line of sl.lines) {
    line.userData.life -= 0.016;
    if (line.userData.life <= 0 && intensity > 0.05) {
      // respawn
      const x = (Math.random() - 0.5) * 8;
      const y = (Math.random() - 0.5) * 5;
      const z = -3 - Math.random() * 8;
      const len = 0.5 + Math.random() * 1.5 * intensity;
      const pos = line.geometry.attributes.position;
      pos.setXYZ(0, x, y, z);
      pos.setXYZ(1, x, y, z - len);
      pos.needsUpdate = true;
      line.userData.life = line.userData.maxLife;
      line.material.opacity = opacity * (0.4 + Math.random() * 0.6);
    } else {
      line.material.opacity *= 0.95;
    }
  }
}
