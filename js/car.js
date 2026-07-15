// ============================================================================
//  Car — vehicle mesh creation + Ammo physics body + raycast vehicle
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, physicsWorld, vehicles, playerVehicle, trackStartPos, trackStartDir, currentSceneDef,
         setVehicles, setPlayerVehicle } from './state.js';
import { createExhaust, createWheelDustSystem } from './particles.js';



export function buildCarMesh(colorHex) {
  const h = CFG.chassisSize;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.28, metalness: 0.75 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(h.x * 2, h.y * 2, h.z * 2), bodyMat);
  body.castShadow = true; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(h.x * 1.9, h.y * 0.7, h.z * 0.7), bodyMat);
  hood.position.set(0, h.y * 0.35, h.z * 0.65); hood.castShadow = true; g.add(hood);
  const cabMat = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.65 });
  const cab = new THREE.Mesh(new THREE.BoxGeometry(h.x * 1.55, h.y * 1.1, h.z * 1.0), cabMat);
  cab.position.set(0, h.y + h.y * 0.35, -h.z * 0.05); cab.castShadow = true; g.add(cab);
  const bm = new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.55 });
  const bg = new THREE.BoxGeometry(h.x * 2.1, h.y * 0.7, 0.3);
  const fb = new THREE.Mesh(bg, bm); fb.position.set(0, -h.y * 0.2, h.z + 0.15); g.add(fb);
  const rb = new THREE.Mesh(bg, bm); rb.position.set(0, -h.y * 0.2, -h.z - 0.15); g.add(rb);
  const hlM = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffaa, emissiveIntensity: 1.3 });
  const hlG = new THREE.SphereGeometry(0.14, 12, 12);
  const hlL = new THREE.Mesh(hlG, hlM); hlL.position.set(-h.x * 0.7, 0, h.z + 0.1); g.add(hlL);
  const hlR = new THREE.Mesh(hlG, hlM); hlR.position.set(h.x * 0.7, 0, h.z + 0.1); g.add(hlR);
  const beamL = new THREE.SpotLight(0xfff5d6, 1.8, 30, Math.PI / 7, 0.5, 1.3);
  beamL.position.set(-h.x * 0.7, 0, h.z + 0.1);
  beamL.target.position.set(-h.x * 0.7, -0.4, h.z + 12); g.add(beamL); g.add(beamL.target);
  const beamR = new THREE.SpotLight(0xfff5d6, 1.8, 30, Math.PI / 7, 0.5, 1.3);
  beamR.position.set(h.x * 0.7, 0, h.z + 0.1);
  beamR.target.position.set(h.x * 0.7, -0.4, h.z + 12); g.add(beamR); g.add(beamR.target);
  const tlM = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.5 });
  const tlG = new THREE.SphereGeometry(0.11, 12, 12);
  const tlL = new THREE.Mesh(tlG, tlM); tlL.position.set(-h.x * 0.7, 0, -h.z - 0.1); g.add(tlL);
  const tlR = new THREE.Mesh(tlG, tlM); tlR.position.set(h.x * 0.7, 0, -h.z - 0.1); g.add(tlR);
  const spM = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.3 });
  const spG = new THREE.BoxGeometry(h.x * 1.7, 0.08, 0.35);
  const sp = new THREE.Mesh(spG, spM); sp.position.set(0, h.y * 1.15, -h.z * 0.8); g.add(sp);
  const supG = new THREE.BoxGeometry(0.08, 0.3, 0.08);
  const suL = new THREE.Mesh(supG, spM); suL.position.set(-h.x * 0.65, h.y * 0.95, -h.z * 0.8); g.add(suL);
  const suR = new THREE.Mesh(supG, spM); suR.position.set(h.x * 0.65, h.y * 0.95, -h.z * 0.8); g.add(suR);
  const exG = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8);
  const exM = new THREE.MeshStandardMaterial({ color: 0x888, metalness: 0.9, roughness: 0.3 });
  const eL = new THREE.Mesh(exG, exM); eL.rotation.x = Math.PI / 2; eL.position.set(-h.x * 0.4, -h.y * 0.7, -h.z - 0.25); g.add(eL);
  const eR = new THREE.Mesh(exG, exM); eR.rotation.x = Math.PI / 2; eR.position.set(h.x * 0.4, -h.y * 0.7, -h.z - 0.25); g.add(eR);
  g.userData.tlMat = tlM; g.userData.bodyMat = bodyMat;
  return g;
}

export function createVehicle(colorHex, startIdx = 0, isPlayer = false, name = 'Player', skill = 0.85) {
  const Ammo = window.Ammo;
  const h = CFG.chassisSize;
  const mesh = buildCarMesh(colorHex);
  scene.add(mesh);
  const compound = new Ammo.btCompoundShape();
  const box = new Ammo.btBoxShape(new Ammo.btVector3(h.x, h.y, h.z));
  const ch = new Ammo.btTransform(); ch.setIdentity(); ch.setOrigin(new Ammo.btVector3(0, 2.0, 0));
  compound.addChildShape(ch, box);

  const col = startIdx % 2, row = Math.floor(startIdx / 2);
  const startP = trackStartPos.clone();
  const right = new THREE.Vector3(-trackStartDir.z, 0, trackStartDir.x).normalize();
  startP.addScaledVector(right, (col === 0 ? -1 : 1) * 2.5);
  startP.addScaledVector(trackStartDir, -row * 5 - 1);

  const st = new Ammo.btTransform(); st.setIdentity();
  st.setOrigin(new Ammo.btVector3(startP.x, startP.y, startP.z));
  const yaw = Math.atan2(trackStartDir.x, trackStartDir.z);
  st.setRotation(new Ammo.btQuaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)));

  const ms = new Ammo.btDefaultMotionState(st);
  const li = new Ammo.btVector3(0, 0, 0);
  compound.calculateLocalInertia(CFG.chassisMass, li);
  const body = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(CFG.chassisMass, ms, compound, li));
  body.setDamping(0.3, 0.95); physicsWorld.addRigidBody(body);

  const tuning = new Ammo.btVehicleTuning();
  const ray = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
  const veh = new Ammo.btRaycastVehicle(tuning, body, ray);
  veh.setCoordinateSystem(0, 1, 2); physicsWorld.addAction(veh);

  const wd = new Ammo.btVector3(0, -1, 0), wa = new Ammo.btVector3(-1, 0, 0);
  const tG = new THREE.CylinderGeometry(CFG.wheelRadius, CFG.wheelRadius, CFG.wheelWidth, 18);
  const tM = new THREE.MeshStandardMaterial({ color: 0x111, roughness: 0.9 });
  const rG = new THREE.CylinderGeometry(CFG.wheelRadius * 0.6, CFG.wheelRadius * 0.6, CFG.wheelWidth * 0.9, 12);
  const rM = new THREE.MeshStandardMaterial({ color: 0xccc, roughness: 0.25, metalness: 0.85 });
  const wPos = [
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, f: true },
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, f: true },
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, f: false },
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, f: false },
  ];
  const wheels = [];
  wPos.forEach(p => {
    veh.addWheel(new Ammo.btVector3(p.x, p.y, p.z), wd, wa, 0.4, CFG.wheelRadius, tuning, p.f);
    const gr = new THREE.Group();
    const tire = new THREE.Mesh(tG, tM); tire.castShadow = true; tire.rotation.z = Math.PI / 2; gr.add(tire);
    const rim = new THREE.Mesh(rG, rM); rim.rotation.z = Math.PI / 2; gr.add(rim);
    scene.add(gr); wheels.push(gr);
  });
  for (let i = 0; i < 4; i++) {
    const wi = veh.getWheelInfo(i);
    wi.set_m_suspensionStiffness(50);
    wi.set_m_wheelsDampingRelaxation(8);
    wi.set_m_wheelsDampingCompression(20);
    wi.set_m_frictionSlip(currentSceneDef.trackFriction * 10);
    wi.set_m_rollInfluence(0.005);
  }

  createExhaust();
  createWheelDustSystem(colorHex, isPlayer);

  return {
    mesh, body, vehicle: veh, wheels, color: colorHex, isPlayer, name,
    progress: 0, lap: 0, lastT: 0, lastLap: 0, finished: false, finishTime: 0,
    aiSkill: skill, aiState: { steer: 0, accel: 0, lookahead: 35 + Math.random() * 10, error: 0, errorTimer: 0, stuckTimer: 0 },
    ramp: 0, startP,
  };
}

export function addVehicle(v) {
  const arr = [...vehicles, v];
  setVehicles(arr);
  if (v.isPlayer) setPlayerVehicle(v);
}
