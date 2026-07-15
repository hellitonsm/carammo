import * as THREE from 'three';
import {
  getScene,
  getPhysicsWorld,
  getTrackStartPos,
  getTrackStartDir,
  getTrackCurve,
  getCurrentSceneDef,
  getVehicles,
  setVehicles,
  setPlayerVehicle,
  getPlayerVehicle,
} from './state.js';
import { CFG } from './config.js';
import { nearestOnCurve } from './track-helpers.js';

export function buildCarMesh(colorHex) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.28,
    metalness: 0.75,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.4,
    metalness: 0.9,
  });
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.5,
    metalness: 0.6,
  });

  // Body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.chassisSize.x * 2, CFG.chassisSize.y * 2, CFG.chassisSize.z * 2),
    bodyMat
  );
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);

  // Hood
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.chassisSize.x * 1.8, CFG.chassisSize.y * 0.6, CFG.chassisSize.z * 0.8),
    bodyMat
  );
  hood.position.set(0, 0.55, CFG.chassisSize.z * 0.7);
  hood.castShadow = true;
  g.add(hood);

  // Cab
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.2,
    metalness: 0.9,
    transparent: true,
    opacity: 0.65,
  });
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(CFG.chassisSize.x * 1.6, CFG.chassisSize.y * 1.2, CFG.chassisSize.z * 0.9),
    cabMat
  );
  cab.position.set(0, 1.0, -0.15);
  cab.castShadow = true;
  g.add(cab);

  // Bumpers
  const fBumper = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.35, 0.3),
    bumperMat
  );
  fBumper.position.set(0, 0.3, CFG.chassisSize.z + 0.1);
  g.add(fBumper);
  const rBumper = new THREE.Mesh(
    new THREE.BoxGeometry(2.1, 0.35, 0.3),
    bumperMat
  );
  rBumper.position.set(0, 0.3, -CFG.chassisSize.z - 0.1);
  g.add(rBumper);

  // Headlights
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffaa,
    emissiveIntensity: 1.2,
  });
  for (let side = -1; side <= 1; side += 2) {
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), hlMat);
    hl.position.set(side * 0.7, 0.45, CFG.chassisSize.z + 0.15);
    g.add(hl);
    const spot = new THREE.SpotLight(0xffffcc, 0.8, 40, Math.PI / 7, 0.4, 1);
    spot.position.copy(hl.position);
    spot.target.position.set(side * 0.7, 0.3, CFG.chassisSize.z + 10);
    g.add(spot);
    g.add(spot.target);
  }

  // Taillights
  const tlMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.5,
  });
  for (let side = -1; side <= 1; side += 2) {
    const tl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), tlMat);
    tl.position.set(side * 0.7, 0.45, -CFG.chassisSize.z - 0.15);
    g.add(tl);
  }
  g.userData.tlMat = tlMat;
  g.userData.bodyMat = bodyMat;

  // Spoiler
  const spoiler = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.08, 0.35),
    darkMat
  );
  spoiler.position.set(0, 1.15, -CFG.chassisSize.z * 0.85);
  g.add(spoiler);
  for (let side = -1; side <= 1; side += 2) {
    const support = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.35, 0.06),
      darkMat
    );
    support.position.set(side * 0.6, 0.95, -CFG.chassisSize.z * 0.85);
    g.add(support);
  }

  // Exhausts
  const exMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.3 });
  for (let side = -1; side <= 1; side += 2) {
    const ex = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.25, 8),
      exMat
    );
    ex.rotation.x = Math.PI / 2;
    ex.position.set(side * 0.4, 0.25, -CFG.chassisSize.z - 0.3);
    g.add(ex);
  }

  return g;
}

export function createVehicle(colorHex, startIdx, isPlayer, name, skill) {
  const scene = getScene();
  const physicsWorld = getPhysicsWorld();
  const startPos = getTrackStartPos();
  const startDir = getTrackStartDir();
  const scn = getCurrentSceneDef();

  const mesh = buildCarMesh(colorHex);
  scene.add(mesh);

  // Compound shape — chassis box centered slightly above origin so wheels hang below
  const compound = new Ammo.btCompoundShape();
  const boxShape = new Ammo.btBoxShape(
    new Ammo.btVector3(CFG.chassisSize.x, CFG.chassisSize.y, CFG.chassisSize.z)
  );
  const localTrans = new Ammo.btTransform();
  localTrans.setIdentity();
  localTrans.setOrigin(new Ammo.btVector3(0, CFG.chassisSize.y, 0));
  compound.addChildShape(localTrans, boxShape);

  // Grid starting positions
  const col = startIdx % 2;
  const row = Math.floor(startIdx / 2);
  // perpendicular
  let nx = -startDir.z, nz = startDir.x;
  const nlen = Math.hypot(nx, nz) || 1;
  nx /= nlen; nz /= nlen;
  const lateral = (col === 0 ? -1 : 1) * 2.5;
  const back = -5 * row - 1;
  const px = startPos.x + nx * lateral + startDir.x * back;
  // Raise so suspension has room (wheel radius + rest length + margin)
  const py = startPos.y + 0.4;
  const pz = startPos.z + nz * lateral + startDir.z * back;

  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(px, py, pz));
  const yaw = Math.atan2(startDir.x, startDir.z);
  const q = new Ammo.btQuaternion();
  q.setRotation(new Ammo.btVector3(0, 1, 0), yaw);
  transform.setRotation(q);

  const mass = CFG.chassisMass;
  const localInertia = new Ammo.btVector3(0, 0, 0);
  compound.calculateLocalInertia(mass, localInertia);
  const motionState = new Ammo.btDefaultMotionState(transform);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(mass, motionState, compound, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);
  body.setActivationState(4); // DISABLE_DEACTIVATION
  body.setDamping(0.3, 0.95);
  body.setFriction(0.5);
  physicsWorld.addRigidBody(body);

  // Raycast vehicle
  const tuning = new Ammo.btVehicleTuning();
  const rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
  const vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
  vehicle.setCoordinateSystem(0, 1, 2);
  physicsWorld.addAction(vehicle);

  const frictionSlip = (scn ? scn.trackFriction : 0.88) * 10;
  const wheelDir = new Ammo.btVector3(0, -1, 0);
  const wheelAxle = new Ammo.btVector3(-1, 0, 0);
  const suspensionRest = 0.35;
  const suspensionTravel = 10000; // cm
  const wheels = [];

  const wheelPositions = [
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, front: true },
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, front: true },
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, front: false },
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, front: false },
  ];

  for (let i = 0; i < 4; i++) {
    const wp = wheelPositions[i];
    const conn = new Ammo.btVector3(wp.x, wp.y, wp.z);
    vehicle.addWheel(
      conn,
      wheelDir,
      wheelAxle,
      suspensionRest,
      CFG.wheelRadius,
      tuning,
      wp.front
    );

    const wi = vehicle.getWheelInfo(i);
    wi.set_m_suspensionStiffness(50);
    wi.set_m_wheelsDampingRelaxation(8);
    wi.set_m_wheelsDampingCompression(20);
    wi.set_m_frictionSlip(frictionSlip);
    wi.set_m_rollInfluence(0.005);
    wi.set_m_maxSuspensionForce(6000);

    // Wheel mesh
    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(CFG.wheelRadius, CFG.wheelRadius, CFG.wheelWidth, 16),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(CFG.wheelRadius * 0.55, CFG.wheelRadius * 0.55, CFG.wheelWidth * 1.1, 12),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })
    );
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);
    scene.add(wheelGroup);
    wheels.push(wheelGroup);
  }

  const startP = new THREE.Vector3(px, py, pz);

  const curve = getTrackCurve();
  let initT = 0;
  if (curve) {
    initT = nearestOnCurve(curve, startP).t;
  }

  const v = {
    mesh,
    body,
    vehicle,
    wheels,
    color: colorHex,
    isPlayer,
    name,
    progress: initT,
    lap: 0,
    lastT: initT,
    lastLap: 0,
    finished: false,
    finishTime: 0,
    aiSkill: skill || 1.0,
    aiState: {
      steer: 0,
      accel: 0,
      lookahead: 35 + Math.random() * 10,
      error: 0,
      errorTimer: 0,
      stuckTimer: 0,
    },
    ramp: 0,
    startP,
    exhaust: null, // shared via getExhaustSys()
    dustSys: null,
    prevSpeed: 0,
    lastAction: null,
    lastState: null,
    lastProgress: 0,
  };

  return v;
}

export function addVehicle(v) {
  const vehicles = getVehicles();
  setVehicles([...vehicles, v]);
  if (v.isPlayer) setPlayerVehicle(v);
}

export function resetVehicle(v, full) {
  if (!v || !v.body) return;
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(v.startP.x, v.startP.y, v.startP.z));

  const startDir = getTrackStartDir();
  if (startDir) {
    const yaw = Math.atan2(startDir.x, startDir.z);
    const q = new Ammo.btQuaternion();
    q.setRotation(new Ammo.btVector3(0, 1, 0), yaw);
    transform.setRotation(q);
  }

  v.body.setWorldTransform(transform);
  v.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
  v.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
  v.body.clearForces();
  v.body.activate();

  // Also reset motion state
  const ms = v.body.getMotionState();
  if (ms) ms.setWorldTransform(transform);

  const curve = getTrackCurve();
  const resetP = new THREE.Vector3(v.startP.x, v.startP.y, v.startP.z);
  let resetT = 0;
  if (curve) {
    resetT = nearestOnCurve(curve, resetP).t;
  }
  v.progress = resetT;
  v.lap = 0;
  v.ramp = 0;
  v.lastT = resetT;
  v.aiState.stuckTimer = 0;
  if (full) {
    v.finished = false;
    v.finishTime = 0;
  }
}
