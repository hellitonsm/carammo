// ============================================================================
//  Sky — procedural sky dome + lighting setup per scene
// ============================================================================

import * as THREE from 'three';
import { scene, renderer, setSun } from './state.js';

export function buildSky(scn) {
  scene.background = new THREE.Color(scn.fogColor);
  scene.fog = new THREE.FogExp2(scn.fogColor, scn.fogDensity);
  scene.children.filter(o => o.isLight || o.isSky).forEach(o => scene.remove(o));
  scene.add(new THREE.HemisphereLight(scn.hemiSky, scn.hemiGround, scn.hemiInt ?? 0.55));
  scene.add(new THREE.AmbientLight(scn.ambientColor, scn.ambientInt ?? 0.3));
  const sun = new THREE.DirectionalLight(scn.sunColor, scn.sunIntensity);
  sun.position.set(scn.sunAz ?? 60, scn.sunEl ?? 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  const s = 180;
  sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
  sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
  sun.shadow.camera.far = 400; sun.shadow.camera.near = 10;
  scene.add(sun); scene.add(sun.target);
  setSun(sun);
  renderer.toneMappingExposure = scn.exposure ?? 1.1;
  const skyGeo = new THREE.SphereGeometry(1200, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(scn.skyTop) },
      bottomColor: { value: new THREE.Color(scn.skyBottom) },
      offset: { value: 60 },
      exponent: { value: 0.55 },
    },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 topColor,bottomColor; uniform float offset,exponent; varying vec3 vWP; void main(){ float h=normalize(vWP+vec3(0.,offset,0.)).y; float t=max(pow(max(h,0.),exponent),0.); gl_FragColor=vec4(mix(bottomColor,topColor,t),1.);}`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.isSky = true;
  scene.add(sky);
}
