import * as THREE from 'three';
import {
  getScene,
  getSkidMarks,
  setSkidMarks,
  getMAX_SKIDS,
  getSkidGeo,
  setSkidGeo,
  getSkidMat,
  setSkidMat,
  getSkidCooldown,
  setSkidCooldown,
  getCurrentSceneDef,
} from './state.js';

export function createSkidMarks() {
  const geo = new THREE.PlaneGeometry(0.35, 1.1);
  setSkidGeo(geo);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  setSkidMat(mat);
  setSkidMarks([]);
}

export function spawnSkid(carData) {
  let cd = getSkidCooldown();
  if (cd > 0) return;
  setSkidCooldown(0.04);

  const scene = getScene();
  const scn = getCurrentSceneDef();
  const geo = getSkidGeo();
  const baseMat = getSkidMat();
  if (!geo || !baseMat || !carData.mesh) return;

  const opacity = scn && scn.id === 'snow' ? 0.22 : 0.5;
  const marks = getSkidMarks();
  const maxSkids = getMAX_SKIDS();

  // rear wheels 2 and 3
  for (let wi = 2; wi <= 3; wi++) {
    const wheel = carData.wheels[wi];
    if (!wheel) continue;

    const mat = baseMat.clone();
    mat.opacity = opacity;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(wheel.position);
    mesh.position.y = 0.03;

    // yaw from car
    const e = new THREE.Euler().setFromQuaternion(carData.mesh.quaternion, 'YXZ');
    mesh.rotation.z = -e.y;

    mesh.userData.life = 5;
    mesh.userData.maxLife = 5;
    scene.add(mesh);
    marks.push(mesh);

    if (marks.length > maxSkids) {
      const old = marks.shift();
      scene.remove(old);
      if (old.material) old.material.dispose();
    }
  }
  setSkidMarks(marks);
}

export function updateSkids(dt) {
  const scene = getScene();
  const marks = getSkidMarks();
  const remaining = [];
  for (const m of marks) {
    m.userData.life -= dt;
    if (m.userData.life <= 0) {
      scene.remove(m);
      if (m.material) m.material.dispose();
    } else {
      m.material.opacity = (m.userData.life / m.userData.maxLife) * (m.material.opacity > 0.3 ? 0.5 : 0.22);
      remaining.push(m);
    }
  }
  setSkidMarks(remaining);

  let cd = getSkidCooldown();
  if (cd > 0) setSkidCooldown(Math.max(0, cd - dt));
}
