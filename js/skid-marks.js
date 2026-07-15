// ============================================================================
//  Skid marks — tire mark decals on track surface
// ============================================================================

import * as THREE from 'three';
import { scene, skidMarks, MAX_SKIDS, skidGeo, skidMat, skidCooldown, currentSceneDef,
         setSkidCooldown, setSkidGeo, setSkidMat } from './state.js';

export function createSkidMarks() {
  const geo = new THREE.PlaneGeometry(0.35, 1.1);
  const mat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.5, depthWrite: false });
  setSkidGeo(geo);
  setSkidMat(mat);
}

export function spawnSkid(carData) {
  if (skidCooldown > 0) return;
  setSkidCooldown(0.04);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(carData.mesh.quaternion);
  const yaw = Math.atan2(fwd.x, fwd.z);
  for (const pos of [carData.wheels[2]?.position, carData.wheels[3]?.position]) {
    if (!pos) continue;
    const mark = new THREE.Mesh(skidGeo, skidMat.clone());
    mark.position.set(pos.x, 0.17, pos.z);
    mark.rotation.x = -Math.PI / 2; mark.rotation.z = yaw;
    mark.material.opacity = currentSceneDef.id === 'snow' ? 0.22 : 0.5;
    scene.add(mark);
    skidMarks.push({ mesh: mark, life: 5 });
    if (skidMarks.length > MAX_SKIDS) {
      const old = skidMarks.shift();
      scene.remove(old.mesh); old.mesh.material.dispose();
    }
  }
}

export function updateSkids(dt) {
  setSkidCooldown(Math.max(0, skidCooldown - dt));
  for (let i = skidMarks.length - 1; i >= 0; i--) {
    const s = skidMarks[i]; s.life -= dt;
    s.mesh.material.opacity = Math.max(0, s.life / 5 * 0.42);
    if (s.life <= 0) { scene.remove(s.mesh); s.mesh.material.dispose(); skidMarks.splice(i, 1); }
  }
}
