import * as THREE from 'three';
import {
  getScene,
  setCurrentSceneDef,
  getCurrentSceneDef,
} from './state.js';
import { getScene as getSceneDef } from '../scenarios.js';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

export function makeAsphaltTexture(scn) {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');
  const col = scn.trackColor;
  const r = (col >> 16) & 0xff;
  const g = (col >> 8) & 0xff;
  const b = col & 0xff;
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const v = (Math.random() - 0.5) * 40;
    ctx.fillStyle = `rgb(${clamp(r + v)},${clamp(g + v)},${clamp(b + v)})`;
    ctx.fillRect(x, y, 1, 1);
  }

  if (scn.id === 'snow') {
    ctx.strokeStyle = 'rgba(200,210,220,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 140; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 8, y + 4, x + 16, y - 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGroundTexture(type) {
  const c = makeCanvas(256);
  const ctx = c.getContext('2d');

  if (type === 'grass') {
    ctx.fillStyle = '#3f6e35';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = Math.random();
      ctx.fillStyle = `rgb(${30 + v * 40},${80 + v * 60},${20 + v * 30})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  } else if (type === 'sand') {
    ctx.fillStyle = '#d8a865';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4000; i++) {
      const v = Math.random();
      ctx.fillStyle = `rgb(${180 + v * 50},${140 + v * 40},${70 + v * 40})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  } else if (type === 'asphalt') {
    ctx.fillStyle = '#2a2a32';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5000; i++) {
      const v = Math.random();
      const g = 30 + v * 40;
      ctx.fillStyle = `rgb(${g},${g},${g + 8})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  } else {
    // snow
    ctx.fillStyle = '#e8eef5';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const v = Math.random();
      ctx.fillStyle = `rgb(${220 + v * 30},${225 + v * 25},${235 + v * 20})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(80, 80);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function clamp(v) {
  return Math.max(0, Math.min(255, v | 0));
}

export function loadScene(sceneId) {
  const scn = getSceneDef(sceneId);
  setCurrentSceneDef(scn);
  const scene = getScene();

  // Large ground plane only — props are placed later in buildEnvironment
  // with track-clearance checks so nothing invades the racing line.
  const groundTex = makeGroundTexture(scn.groundTex);
  const groundGeo = new THREE.PlaneGeometry(900, 900);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    color: scn.groundColor,
    roughness: 0.95,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  ground.receiveShadow = true;
  scene.add(ground);

  return scn;
}
