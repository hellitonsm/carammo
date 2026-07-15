import * as THREE from 'three';
import {
  getScene,
  setExhaustSys,
  setDustSys,
  setNitroFlameSys,
  getExhaustSys,
  getDustSys,
  getNitroFlameSys,
  getCurrentSceneDef,
} from './state.js';

export function createWorldPointSystem(count, color, size, maxLife) {
  const scene = getScene();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const data = [];

  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = 0;
    positions[i * 3 + 1] = -999;
    positions[i * 3 + 2] = 0;
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
    sizes[i] = size;
    data.push({ life: 0, maxLife, vx: 0, vy: 0, vz: 0, size });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  return {
    points,
    data,
    count,
    idx: 0,
    maxLife,
    baseSize: size,
    baseColor: c,
  };
}

export function emitParticle(sys, x, y, z, vx, vy, vz, size, color) {
  if (!sys) return;
  const i = sys.idx;
  sys.idx = (sys.idx + 1) % sys.count;
  const d = sys.data[i];
  d.life = d.maxLife || sys.maxLife;
  d.maxLife = d.maxLife || sys.maxLife;
  d.vx = vx;
  d.vy = vy;
  d.vz = vz;
  d.size = size || sys.baseSize;

  const pos = sys.points.geometry.attributes.position.array;
  pos[i * 3] = x;
  pos[i * 3 + 1] = y;
  pos[i * 3 + 2] = z;

  const cols = sys.points.geometry.attributes.color.array;
  if (color) {
    const c = new THREE.Color(color);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  sys.points.geometry.attributes.position.needsUpdate = true;
  sys.points.geometry.attributes.color.needsUpdate = true;
}

export function updateWorldParticles(sys, dt, gravity) {
  if (!sys) return;
  const pos = sys.points.geometry.attributes.position.array;
  const cols = sys.points.geometry.attributes.color.array;
  let needsUpdate = false;

  for (let i = 0; i < sys.count; i++) {
    const d = sys.data[i];
    if (d.life <= 0) continue;
    d.life -= dt;
    if (d.life <= 0) {
      pos[i * 3 + 1] = -999;
      needsUpdate = true;
      continue;
    }
    pos[i * 3] += d.vx * dt;
    pos[i * 3 + 1] += d.vy * dt;
    pos[i * 3 + 2] += d.vz * dt;
    d.vy += gravity * dt;
    d.vx *= 0.96;
    d.vz *= 0.96;

    // fade
    const fade = d.life / d.maxLife;
    cols[i * 3] *= 0.99;
    cols[i * 3 + 1] *= 0.99;
    cols[i * 3 + 2] *= 0.99;
    needsUpdate = true;
  }
  if (needsUpdate) {
    sys.points.geometry.attributes.position.needsUpdate = true;
    sys.points.geometry.attributes.color.needsUpdate = true;
  }
}

export function createExhaust() {
  const sys = createWorldPointSystem(200, 0x888888, 0.35, 0.8);
  setExhaustSys(sys);
  return sys;
}

export function createWheelDustSystem() {
  const scn = getCurrentSceneDef();
  const maxLife = scn && scn.id === 'snow' ? 1.5 : 1.0;
  const sys = createWorldPointSystem(400, 0xcccccc, 0.3, maxLife);
  setDustSys(sys);
  return sys;
}

export function createNitroFlameSystem() {
  const sys = createWorldPointSystem(250, 0x00ffff, 0.4, 0.4);
  setNitroFlameSys(sys);
  return sys;
}

export function initParticleSystems() {
  createExhaust();
  createWheelDustSystem();
  createNitroFlameSystem();
}
