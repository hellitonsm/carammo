// ============================================================================
//  FX — exhaust, wheel dust, nitro flame visual effects + speed lines
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, camera, vehicles, playerVehicle, keys, nitroActive, currentSceneDef, speedLines, setSpeedLines } from './state.js';
import { emitParticle, exhaustSys, dustSys, getNitroSys, nitroFlameSys } from './particles.js';

export function initSpeedLines() {
  const segCount = 60;
  const segPos = new Float32Array(segCount * 6);
  const segData = [];
  for (let i = 0; i < segCount; i++) {
    const idx = i * 6;
    segPos[idx] = 0; segPos[idx + 1] = 0; segPos[idx + 2] = 0;
    segPos[idx + 3] = 0; segPos[idx + 4] = 0; segPos[idx + 5] = 0;
    segData.push({ life: 0, maxLife: 0 });
  }
  const segGeo = new THREE.BufferGeometry();
  segGeo.setAttribute('position', new THREE.BufferAttribute(segPos, 3));
  const segMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  const lines = new THREE.LineSegments(segGeo, segMat);
  lines.frustumCulled = false;
  lines.userData.data = segData;
  lines.userData.segCount = segCount;
  setSpeedLines(lines);
  camera.add(lines);
  scene.add(camera);
}

export function emitExhaustFx(v, speedKmh, drifting) {
  if (!exhaustSys) return;
  let intensity = 0;
  if (v.isPlayer) {
    if (keys.w) intensity = Math.min(1, speedKmh / 80 + (nitroActive ? 0.6 : 0));
    if (keys.s) intensity = Math.max(intensity, 0.3);
  } else intensity = Math.min(1, v.aiState.accel);
  intensity = Math.min(1, intensity);
  if (intensity < 0.1 || v.finished) return;
  if (nitroActive && v.isPlayer) return;
  const h = CFG.chassisSize;
  const back = new THREE.Vector3(0, 0.05, -1).applyQuaternion(v.mesh.quaternion);
  for (const side of [-1, 1]) {
    const local = new THREE.Vector3(side * h.x * 0.4, -h.y * 0.3, -h.z - 0.3)
      .applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
    const col = currentSceneDef.id === 'snow' ? (drifting ? 0xffffff : 0xcccccc) : (speedKmh > 120 ? 0x555555 : 0xdddddd);
    emitParticle(exhaustSys, local.x, local.y, local.z,
      back.x * (3 + Math.random() * 3) + (Math.random() - 0.5) * 1,
      back.y * 2 + 0.5 + Math.random(),
      back.z * (3 + Math.random() * 3) + (Math.random() - 0.5) * 1,
      0.2 + Math.random() * 0.25, col);
  }
}

export function emitWheelDust(v, speedKmh, hard) {
  if (!dustSys) return;
  if (speedKmh < 15 || v.finished) return;
  const scn = currentSceneDef;
  if (scn.id === 'forest' && !hard) return;
  const intensity = hard ? 2 : (scn.id === 'desert' ? 1 : 0.4);
  const q = v.mesh.quaternion;
  for (let wi = 2; wi <= 3; wi++) {
    const wp = v.wheels[wi].position;
    for (let k = 0; k < intensity; k++) {
      const side = (Math.random() - 0.5) * 0.8;
      const up = 0.5 + Math.random() * 0.8;
      const back = -1 - Math.random() * 1.5;
      const dir = new THREE.Vector3(side, up, back).applyQuaternion(q);
      emitParticle(dustSys, wp.x + (Math.random() - 0.5) * 0.3, wp.y + 0.1, wp.z + (Math.random() - 0.5) * 0.3,
        dir.x * (3 + Math.random() * 3) * 0.5, dir.y * 2, dir.z * (3 + Math.random() * 3) * 0.5,
        0.25 + Math.random() * 0.3);
    }
  }
}

export function emitNitroFlames(v) {
  const s = getNitroSys();
  const h = CFG.chassisSize;
  const back = new THREE.Vector3(0, 0.05, -1).applyQuaternion(v.mesh.quaternion);
  for (const side of [-1, 1]) {
    const local = new THREE.Vector3(side * h.x * 0.4, -h.y * 0.25, -h.z - 0.35)
      .applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
    const col = Math.random() < 0.5 ? 0x00e5ff : 0xff6a00;
    emitParticle(s, local.x, local.y, local.z,
      back.x * 6 + (Math.random() - 0.5) * 2, back.y * 2 + Math.random() * 1.5, back.z * 10 + Math.random() * 5,
      0.35 + Math.random() * 0.3, col);
  }
}

export function updateSpeedLines(speedKmh) {
  if (!speedLines) return;
  const intensity = Math.max(0, (speedKmh - 80) / 120);
  const seg = speedLines.userData.data;
  const pos = speedLines.geometry.attributes.position.array;
  for (let i = 0; i < speedLines.userData.segCount; i++) {
    const p = seg[i];
    if (p.life < p.maxLife) {
      p.life += 0.016;
      const i6 = i * 6;
      pos[i6 + 3] = pos[i6] + (pos[i6] - pos[i6 + 3]) * 0.5;
      pos[i6 + 4] = pos[i6 + 1] + (pos[i6 + 1] - pos[i6 + 4]) * 0.5;
      pos[i6 + 5] = pos[i6 + 2] + (pos[i6 + 2] - pos[i6 + 5]) * 0.5;
      if (p.life >= p.maxLife) { pos[i6 + 1] = -999; pos[i6 + 4] = -999; }
      continue;
    }
    if (Math.random() < intensity * 0.5) {
      p.life = 0; p.maxLife = 0.25 + Math.random() * 0.3;
      const angle = (Math.random() - 0.5) * 0.6;
      const spread = 10;
      const i6 = i * 6;
      pos[i6] = (Math.random() - 0.5) * spread;
      pos[i6 + 1] = (Math.random() - 0.5) * 6;
      pos[i6 + 2] = -5 - Math.random() * 5;
      pos[i6 + 3] = pos[i6] + Math.sin(angle) * 2;
      pos[i6 + 4] = pos[i6 + 1];
      pos[i6 + 5] = pos[i6 + 2] - 6 - Math.random() * 3;
    }
  }
  speedLines.geometry.attributes.position.needsUpdate = true;
  speedLines.material.opacity = Math.min(0.8, intensity * 0.8);
}
