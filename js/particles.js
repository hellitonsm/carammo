// ============================================================================
//  Particles — generic world-space particle system + emit/update helpers
// ============================================================================

import * as THREE from 'three';
import { scene, exhaustSys, dustSys, nitroFlameSys,
         setExhaustSys, setDustSys, setNitroFlameSys,
         currentSceneDef } from './state.js';
export { exhaustSys, dustSys, nitroFlameSys };

export function createWorldPointSystem(count, color, size, maxLife) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    pos[i*3] = 0; pos[i*3+1] = -999; pos[i*3+2] = 0;
    col[i*3] = c.r; col[i*3+1] = c.g; col[i*3+2] = c.b;
    sizes[i] = 0;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size, transparent: true, opacity: 0.6, depthWrite: false, vertexColors: true, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  const data = new Array(count).fill(null).map(() => ({ life:1, maxLife:1, vx:0, vy:0, vz:0, size:0 }));
  return { mesh: pts, geo, mat, pos, col, data, index: 0, count, maxLife };
}

export function emitParticle(sys, wx, wy, wz, vx, vy, vz, size, color) {
  const i = sys.index;
  sys.index = (sys.index + 1) % sys.count;
  const p = sys.data[i];
  p.life = 0;
  p.maxLife = sys.maxLife * (0.7 + Math.random() * 0.6);
  p.vx = vx; p.vy = vy; p.vz = vz; p.size = size;
  sys.pos[i*3] = wx; sys.pos[i*3+1] = wy; sys.pos[i*3+2] = wz;
  if (color) {
    const c = new THREE.Color(color);
    sys.col[i*3] = c.r; sys.col[i*3+1] = c.g; sys.col[i*3+2] = c.b;
  }
}

export function updateWorldParticles(sys, dt, gravity) {
  const { pos, data } = sys;
  for (let i = 0; i < sys.count; i++) {
    const p = data[i];
    if (p.life >= p.maxLife) { pos[i*3+1] = -999; continue; }
    p.life += dt;
    pos[i*3] += p.vx * dt;
    pos[i*3+1] += p.vy * dt;
    pos[i*3+2] += p.vz * dt;
    p.vy += gravity * dt;
    p.vx *= 0.96; p.vz *= 0.96;
  }
  sys.geo.attributes.position.needsUpdate = true;
  sys.mat.opacity = 0.55;
}

export function createExhaust() {
  if (!exhaustSys) setExhaustSys(createWorldPointSystem(200, 0xeeeeee, 0.35, 0.8));
  return exhaustSys;
}

export function createWheelDustSystem(carColor, isPlayer) {
  if (!dustSys) {
    const col = currentSceneDef.dustColor || 0xffffff;
    const sys = createWorldPointSystem(400, col, 0.3, 1.2);
    sys.maxLife = currentSceneDef.id === 'snow' ? 1.5 : 1.0;
    setDustSys(sys);
  }
  return dustSys;
}

export function getNitroSys() {
  if (!nitroFlameSys) setNitroFlameSys(createWorldPointSystem(250, 0x44aaff, 0.4, 0.4));
  return nitroFlameSys;
}
