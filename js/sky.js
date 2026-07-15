import * as THREE from 'three';
import {
  getScene,
  getRenderer,
  setSun,
  getSun,
} from './state.js';

export function buildSky(scn) {
  const scene = getScene();
  const renderer = getRenderer();

  scene.background = new THREE.Color(scn.fogColor);
  scene.fog = new THREE.FogExp2(scn.fogColor, scn.fogDensity);

  // Remove existing lights and sky dome
  const toRemove = [];
  scene.traverse((obj) => {
    if (obj.isLight || obj.userData.isSkyDome) toRemove.push(obj);
  });
  for (const o of toRemove) {
    scene.remove(o);
    if (o.dispose) o.dispose();
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  }

  // Hemisphere
  const hemi = new THREE.HemisphereLight(scn.hemiSky, scn.hemiGround, scn.hemiInt);
  scene.add(hemi);

  // Ambient
  const amb = new THREE.AmbientLight(scn.ambientColor || 0xffffff, scn.ambientInt);
  scene.add(amb);

  // Sun directional
  const sun = new THREE.DirectionalLight(scn.sunColor, scn.sunIntensity);
  const az = (scn.sunAz || 60) * Math.PI / 180;
  const el = (scn.sunEl || 70) * Math.PI / 180;
  const dist = 40;
  sun.position.set(
    Math.cos(el) * Math.sin(az) * dist,
    Math.sin(el) * dist,
    Math.cos(el) * Math.cos(az) * dist
  );
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  setSun(sun);

  if (renderer) {
    renderer.toneMappingExposure = scn.exposure;
  }

  // Sky dome gradient
  const skyGeo = new THREE.SphereGeometry(1200, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(scn.skyTop) },
      bottomColor: { value: new THREE.Color(scn.skyBottom) },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos).y;
        float t = clamp(h * 0.5 + 0.5, 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.userData.isSkyDome = true;
  scene.add(skyDome);
}
