// ============================================================================
//  Textures — procedural canvas-based texture generation
// ============================================================================

import * as THREE from 'three';
import { renderer, scene, currentSceneDef, setCurrentSceneDef } from './state.js';
import { CFG } from './config.js';
import { SCENES } from '../scenarios.js';

export function loadScene(sceneId) {
  setCurrentSceneDef(SCENES[sceneId]);
  const scn = currentSceneDef;

  const groundTex = makeGroundTexture(scn.groundTex);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(800, 800),
    new THREE.MeshStandardMaterial({ map: groundTex, color: scn.groundColor, roughness: scn.groundRoughness ?? 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  ground.receiveShadow = true;
  scene.add(ground);

  if (scn.id === 'forest') {
    const grassTex = makeGroundTexture('grass');
    const grass = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ map: grassTex, color: 0x3a7a30, roughness: 0.95 })
    );
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -1.98;
    grass.receiveShadow = true;
    scene.add(grass);

    const rocksGeo = new THREE.DodecahedronGeometry(1.2, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.95 });
    for (let i = 0; i < 60; i++) {
      const r = new THREE.Mesh(rocksGeo, rockMat);
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 200;
      r.position.set(Math.cos(a) * d, -1.2, Math.sin(a) * d);
      r.scale.setScalar(0.5 + Math.random() * 2);
      r.rotation.set(Math.random(), Math.random(), Math.random());
      r.castShadow = true;
      scene.add(r);
    }
  }

  if (scn.id === 'desert') {
    const sandTex = makeGroundTexture('sand');
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ map: sandTex, color: 0xd6a668, roughness: 1.0 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.y = -1.98;
    sand.receiveShadow = true;
    scene.add(sand);

    const duneMat = new THREE.MeshStandardMaterial({ color: 0xc8923a, roughness: 1.0 });
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 200;
      const dune = new THREE.Mesh(
        new THREE.SphereGeometry(12 + Math.random() * 15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        duneMat
      );
      dune.position.set(Math.cos(a) * d, -3.5, Math.sin(a) * d);
      dune.scale.y = 0.3 + Math.random() * 0.2;
      dune.receiveShadow = true;
      scene.add(dune);
    }
  }

  if (scn.id === 'snow') {
    const snowTex = makeGroundTexture('snow');
    const snow = new THREE.Mesh(
      new THREE.PlaneGeometry(800, 800),
      new THREE.MeshStandardMaterial({ map: snowTex, color: 0xd8e8f0, roughness: 0.6 })
    );
    snow.rotation.x = -Math.PI / 2;
    snow.position.y = -1.98;
    snow.receiveShadow = true;
    scene.add(snow);

    const moundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    for (let i = 0; i < 45; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 200;
      const mound = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 4, 10, 8), moundMat);
      mound.position.set(Math.cos(a) * d, -1, Math.sin(a) * d);
      mound.scale.y = 0.4;
      mound.receiveShadow = true;
      scene.add(mound);
    }
  }
}

export function makeAsphaltTexture(scn) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(scn.trackColor);
  ctx.fillStyle = `rgb(${col.r*255|0},${col.g*255|0},${col.b*255|0})`;
  ctx.fillRect(0, 0, size, size);
  const speck = scn.id === 'snow' ? 80 : scn.id === 'desert' ? 50 : 40;
  for (let i = 0; i < 6000; i++) {
    const g = speck + Math.random() * 40;
    ctx.fillStyle = `rgba(${g},${g},${g},${0.12 + Math.random() * 0.2})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }
  if (scn.id === 'snow') {
    for (let i = 0; i < 140; i++) {
      ctx.strokeStyle = `rgba(30,30,35,${0.08 + Math.random() * 0.15})`;
      ctx.lineWidth = 1; ctx.beginPath();
      const y = Math.random() * size;
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(size * 0.3, y + (Math.random() - 0.5) * 10, size * 0.7, y + (Math.random() - 0.5) * 10, size, y + (Math.random() - 0.5) * 6);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(40, 1);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeGroundTexture(type) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  let base, speck;
  if (type === 'grass') {
    base = '#3f6e35'; speck = () => {
      const r = 40 + Math.random() * 50, g = 90 + Math.random() * 70, b = 35 + Math.random() * 30;
      return `rgba(${r},${g},${b},0.4)`;
    };
  } else if (type === 'sand') {
    base = '#d6a668'; speck = () => {
      const v = 160 + Math.random() * 60;
      return `rgba(${v},${v - 20},${v - 60},0.35)`;
    };
  } else {
    base = '#e8eef5'; speck = () => {
      const v = 200 + Math.random() * 55;
      return `rgba(${v},${v},${v + 5},0.35)`;
    };
  }
  ctx.fillStyle = base; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 5000; i++) {
    ctx.fillStyle = speck();
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(80, 80);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
