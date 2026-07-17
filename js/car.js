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
import {
  getEngineForceMultiplier,
  getFrictionMultiplier,
  getAeroDownforceMultiplier,
  getActiveCarDef,
} from './manager.js';

/**
 * Distinct visual styles for each shop car.
 * bodyStyle: starter | street | sport | super | hyper
 */
const BODY_STYLES = {
  starter: {
    // Compact hatch / GT entry — boxy, short, single small spoiler
    body: { w: 1.9, h: 0.95, l: 3.6, y: 0.48 },
    hood: { w: 1.7, h: 0.28, l: 1.1, z: 1.15, y: 0.72 },
    cab: { w: 1.55, h: 0.7, l: 1.35, z: -0.15, y: 0.95, opacity: 0.55 },
    bumperF: { w: 1.95, h: 0.32, l: 0.28, z: 1.85 },
    bumperR: { w: 1.95, h: 0.32, l: 0.28, z: -1.85 },
    spoiler: { w: 1.4, h: 0.06, l: 0.28, y: 1.05, z: -1.55, wing: false },
    headlights: { r: 0.12, y: 0.42, z: 1.9, x: 0.65, style: 'round' },
    taillights: { r: 0.1, y: 0.42, z: -1.9, x: 0.65, style: 'round' },
    exhausts: 1,
    skirts: false,
    roofScoop: false,
    metalness: 0.55,
    roughness: 0.4,
  },
  street: {
    // Coupe — longer hood, lower, dual exhaust
    body: { w: 2.0, h: 0.85, l: 4.0, y: 0.42 },
    hood: { w: 1.85, h: 0.22, l: 1.4, z: 1.25, y: 0.68 },
    cab: { w: 1.6, h: 0.62, l: 1.4, z: -0.2, y: 0.9, opacity: 0.5 },
    bumperF: { w: 2.05, h: 0.28, l: 0.32, z: 2.05 },
    bumperR: { w: 2.05, h: 0.28, l: 0.32, z: -2.05 },
    spoiler: { w: 1.55, h: 0.07, l: 0.32, y: 1.0, z: -1.7, wing: false },
    headlights: { r: 0.11, y: 0.4, z: 2.1, x: 0.72, style: 'oval' },
    taillights: { r: 0.09, y: 0.4, z: -2.1, x: 0.7, style: 'bar' },
    exhausts: 2,
    skirts: true,
    roofScoop: false,
    metalness: 0.7,
    roughness: 0.32,
  },
  sport: {
    // Sports GT — wide, aggressive splitter look, roof scoop
    body: { w: 2.15, h: 0.78, l: 4.2, y: 0.38 },
    hood: { w: 2.0, h: 0.2, l: 1.5, z: 1.3, y: 0.62 },
    cab: { w: 1.7, h: 0.55, l: 1.45, z: -0.25, y: 0.85, opacity: 0.45 },
    bumperF: { w: 2.2, h: 0.26, l: 0.35, z: 2.15 },
    bumperR: { w: 2.2, h: 0.26, l: 0.35, z: -2.15 },
    spoiler: { w: 1.85, h: 0.08, l: 0.4, y: 1.05, z: -1.8, wing: true },
    headlights: { r: 0.1, y: 0.38, z: 2.2, x: 0.78, style: 'slim' },
    taillights: { r: 0.08, y: 0.38, z: -2.2, x: 0.75, style: 'bar' },
    exhausts: 2,
    skirts: true,
    roofScoop: true,
    metalness: 0.78,
    roughness: 0.26,
  },
  super: {
    // Supercar — very low, wide, big wing
    body: { w: 2.25, h: 0.7, l: 4.4, y: 0.34 },
    hood: { w: 2.05, h: 0.16, l: 1.55, z: 1.35, y: 0.55 },
    cab: { w: 1.65, h: 0.48, l: 1.5, z: -0.3, y: 0.78, opacity: 0.4 },
    bumperF: { w: 2.3, h: 0.22, l: 0.38, z: 2.25 },
    bumperR: { w: 2.3, h: 0.22, l: 0.38, z: -2.25 },
    spoiler: { w: 2.1, h: 0.1, l: 0.5, y: 1.15, z: -1.9, wing: true, tall: true },
    headlights: { r: 0.09, y: 0.34, z: 2.3, x: 0.82, style: 'slim' },
    taillights: { r: 0.07, y: 0.34, z: -2.3, x: 0.8, style: 'bar' },
    exhausts: 4,
    skirts: true,
    roofScoop: false,
    metalness: 0.85,
    roughness: 0.2,
  },
  hyper: {
    // Hypercar — ultra low wedge, massive wing, side intakes
    body: { w: 2.35, h: 0.62, l: 4.55, y: 0.3 },
    hood: { w: 2.1, h: 0.14, l: 1.65, z: 1.4, y: 0.48 },
    cab: { w: 1.55, h: 0.42, l: 1.55, z: -0.35, y: 0.7, opacity: 0.35 },
    bumperF: { w: 2.4, h: 0.2, l: 0.4, z: 2.35 },
    bumperR: { w: 2.4, h: 0.2, l: 0.4, z: -2.35 },
    spoiler: { w: 2.25, h: 0.12, l: 0.55, y: 1.25, z: -1.95, wing: true, tall: true },
    headlights: { r: 0.08, y: 0.3, z: 2.4, x: 0.88, style: 'slim' },
    taillights: { r: 0.06, y: 0.3, z: -2.4, x: 0.85, style: 'bar' },
    exhausts: 4,
    skirts: true,
    roofScoop: true,
    metalness: 0.92,
    roughness: 0.15,
  },
};

function styleForCarId(carId) {
  return BODY_STYLES[carId] || BODY_STYLES.starter;
}

export function buildCarMesh(colorHex, carId = 'starter') {
  const st = styleForCarId(carId);
  const g = new THREE.Group();
  g.userData.carId = carId;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: st.roughness,
    metalness: st.metalness,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.4,
    metalness: 0.9,
  });
  const bumperMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.5,
    metalness: 0.65,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.45,
    metalness: 0.7,
  });

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(st.body.w, st.body.h, st.body.l),
    bodyMat
  );
  body.position.y = st.body.y;
  body.castShadow = true;
  g.add(body);

  // Hood
  const hood = new THREE.Mesh(
    new THREE.BoxGeometry(st.hood.w, st.hood.h, st.hood.l),
    bodyMat
  );
  hood.position.set(0, st.hood.y, st.hood.z);
  hood.castShadow = true;
  g.add(hood);

  // Cab / canopy
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x0a0a12,
    roughness: 0.15,
    metalness: 0.95,
    transparent: true,
    opacity: st.cab.opacity,
  });
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(st.cab.w, st.cab.h, st.cab.l),
    cabMat
  );
  cab.position.set(0, st.cab.y, st.cab.z);
  cab.castShadow = true;
  g.add(cab);

  // Bumpers
  const fBumper = new THREE.Mesh(
    new THREE.BoxGeometry(st.bumperF.w, st.bumperF.h, st.bumperF.l),
    bumperMat
  );
  fBumper.position.set(0, 0.28, st.bumperF.z);
  g.add(fBumper);
  const rBumper = new THREE.Mesh(
    new THREE.BoxGeometry(st.bumperR.w, st.bumperR.h, st.bumperR.l),
    bumperMat
  );
  rBumper.position.set(0, 0.28, st.bumperR.z);
  g.add(rBumper);

  // Front splitter (sport+)
  if (st.skirts || st.spoiler.wing) {
    const splitter = new THREE.Mesh(
      new THREE.BoxGeometry(st.bumperF.w * 0.98, 0.05, 0.35),
      accentMat
    );
    splitter.position.set(0, 0.12, st.bumperF.z + 0.15);
    g.add(splitter);
  }

  // Side skirts
  if (st.skirts) {
    for (const side of [-1, 1]) {
      const skirt = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, st.body.l * 0.7),
        accentMat
      );
      skirt.position.set(side * (st.body.w / 2 + 0.02), 0.22, 0);
      g.add(skirt);
    }
  }

  // Roof scoop
  if (st.roofScoop) {
    const scoop = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.12, 0.55),
      darkMat
    );
    scoop.position.set(0, st.cab.y + st.cab.h / 2 + 0.05, st.cab.z + 0.2);
    g.add(scoop);
  }

  // Side intakes (hyper / super)
  if (carId === 'super' || carId === 'hyper') {
    for (const side of [-1, 1]) {
      const intake = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.28, 0.7),
        darkMat
      );
      intake.position.set(side * (st.body.w / 2 - 0.05), 0.45, -0.3);
      g.add(intake);
    }
  }

  // Headlights
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffaa,
    emissiveIntensity: 1.2,
  });
  for (const side of [-1, 1]) {
    let hlGeo;
    if (st.headlights.style === 'slim') {
      hlGeo = new THREE.BoxGeometry(0.35, 0.1, 0.12);
    } else if (st.headlights.style === 'oval') {
      hlGeo = new THREE.SphereGeometry(st.headlights.r, 10, 8);
      hlGeo.scale(1.4, 0.7, 1);
    } else {
      hlGeo = new THREE.SphereGeometry(st.headlights.r, 8, 8);
    }
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(side * st.headlights.x, st.headlights.y, st.headlights.z);
    g.add(hl);
    const spot = new THREE.SpotLight(0xffffcc, 0.75, 40, Math.PI / 7, 0.4, 1);
    spot.position.copy(hl.position);
    spot.target.position.set(side * st.headlights.x, 0.25, st.headlights.z + 12);
    g.add(spot);
    g.add(spot.target);
  }

  // Taillights
  const tlMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.5,
  });
  for (const side of [-1, 1]) {
    let tlGeo;
    if (st.taillights.style === 'bar') {
      tlGeo = new THREE.BoxGeometry(0.4, 0.08, 0.08);
    } else {
      tlGeo = new THREE.SphereGeometry(st.taillights.r, 8, 8);
    }
    const tl = new THREE.Mesh(tlGeo, tlMat);
    tl.position.set(side * st.taillights.x, st.taillights.y, st.taillights.z);
    g.add(tl);
  }
  g.userData.tlMat = tlMat;
  g.userData.bodyMat = bodyMat;

  // Spoiler / wing
  if (st.spoiler.wing) {
    const supportH = st.spoiler.tall ? 0.55 : 0.35;
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, supportH, 0.08),
        darkMat
      );
      support.position.set(
        side * (st.spoiler.w * 0.35),
        st.spoiler.y - supportH / 2 + 0.05,
        st.spoiler.z
      );
      g.add(support);
    }
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(st.spoiler.w, st.spoiler.h, st.spoiler.l),
      darkMat
    );
    wing.position.set(0, st.spoiler.y, st.spoiler.z);
    // slight angle
    wing.rotation.x = -0.15;
    g.add(wing);
    if (st.spoiler.tall) {
      // endplates
      for (const side of [-1, 1]) {
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.28, st.spoiler.l + 0.05),
          darkMat
        );
        plate.position.set(side * (st.spoiler.w / 2), st.spoiler.y - 0.05, st.spoiler.z);
        g.add(plate);
      }
    }
  } else {
    const spoiler = new THREE.Mesh(
      new THREE.BoxGeometry(st.spoiler.w, st.spoiler.h, st.spoiler.l),
      darkMat
    );
    spoiler.position.set(0, st.spoiler.y, st.spoiler.z);
    g.add(spoiler);
    for (const side of [-1, 1]) {
      const support = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.28, 0.05),
        darkMat
      );
      support.position.set(side * 0.5, st.spoiler.y - 0.15, st.spoiler.z);
      g.add(support);
    }
  }

  // Exhausts
  const exMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.9, roughness: 0.3 });
  const nEx = st.exhausts;
  const spacing = nEx === 1 ? [0] : nEx === 2 ? [-0.35, 0.35] : [-0.55, -0.2, 0.2, 0.55];
  for (const x of spacing) {
    const ex = new THREE.Mesh(
      new THREE.CylinderGeometry(nEx >= 4 ? 0.06 : 0.08, nEx >= 4 ? 0.06 : 0.08, 0.25, 8),
      exMat
    );
    ex.rotation.x = Math.PI / 2;
    ex.position.set(x, 0.22, st.bumperR.z - 0.15);
    g.add(ex);
  }

  // Mirror stalks (sport+)
  if (carId !== 'starter') {
    for (const side of [-1, 1]) {
      const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, 0.12),
        darkMat
      );
      mirror.position.set(side * (st.cab.w / 2 + 0.12), st.cab.y, st.cab.z + 0.35);
      g.add(mirror);
    }
  }

  return g;
}

export function createVehicle(colorHex, startIdx, isPlayer, name, skill, carId = null) {
  const scene = getScene();
  const physicsWorld = getPhysicsWorld();
  const startPos = getTrackStartPos();
  const startDir = getTrackStartDir();
  const scn = getCurrentSceneDef();

  let resolvedId = carId;
  if (isPlayer && !resolvedId) {
    try {
      resolvedId = getActiveCarDef().id;
    } catch {
      resolvedId = 'starter';
    }
  }
  if (!resolvedId) resolvedId = 'starter';

  const mesh = buildCarMesh(colorHex, resolvedId);
  scene.add(mesh);

  const compound = new Ammo.btCompoundShape();
  const boxShape = new Ammo.btBoxShape(
    new Ammo.btVector3(CFG.chassisSize.x, CFG.chassisSize.y, CFG.chassisSize.z)
  );
  const localTrans = new Ammo.btTransform();
  localTrans.setIdentity();
  localTrans.setOrigin(new Ammo.btVector3(0, CFG.chassisSize.y, 0));
  compound.addChildShape(localTrans, boxShape);

  const col = startIdx % 2;
  const row = Math.floor(startIdx / 2);
  let nx = -startDir.z, nz = startDir.x;
  const nlen = Math.hypot(nx, nz) || 1;
  nx /= nlen; nz /= nlen;
  const lateral = (col === 0 ? -1 : 1) * 2.5;
  const back = -5 * row - 1;
  const px = startPos.x + nx * lateral + startDir.x * back;
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
  body.setActivationState(4);
  body.setDamping(0.3, 0.95);
  body.setFriction(0.5);
  physicsWorld.addRigidBody(body);

  const tuning = new Ammo.btVehicleTuning();
  const rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
  const vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
  vehicle.setCoordinateSystem(0, 1, 2);
  physicsWorld.addAction(vehicle);

  const frictionSlip = (scn ? scn.trackFriction : 0.88) * 10 * (isPlayer ? getFrictionMultiplier() : 1.0);
  const wheelDir = new Ammo.btVector3(0, -1, 0);
  const wheelAxle = new Ammo.btVector3(-1, 0, 0);
  const suspensionRest = 0.35;
  const wheels = [];

  const wheelPositions = [
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, front: true },
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, front: true },
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, front: false },
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, front: false },
  ];

  // Hyper/super get slightly wider visual wheels
  const wheelScale = resolvedId === 'hyper' || resolvedId === 'super' ? 1.08 : 1.0;

  for (let i = 0; i < 4; i++) {
    const wp = wheelPositions[i];
    const conn = new Ammo.btVector3(wp.x * (wheelScale > 1 ? 1.05 : 1), wp.y, wp.z);
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

    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(CFG.wheelRadius * wheelScale, CFG.wheelRadius * wheelScale, CFG.wheelWidth * wheelScale, 16),
      new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);
    const rimColor = resolvedId === 'hyper' ? 0xffd700 : resolvedId === 'super' ? 0xeeeeee : 0xcccccc;
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(CFG.wheelRadius * 0.55 * wheelScale, CFG.wheelRadius * 0.55 * wheelScale, CFG.wheelWidth * 1.1 * wheelScale, 12),
      new THREE.MeshStandardMaterial({ color: rimColor, metalness: 0.85, roughness: 0.25 })
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
    carId: resolvedId,
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
    exhaust: null,
    dustSys: null,
    prevSpeed: 0,
    lastAction: null,
    lastState: null,
    lastProgress: 0,
    engineMult: isPlayer ? getEngineForceMultiplier() : 1.0,
    downforceMult: isPlayer ? getAeroDownforceMultiplier() : 1.0,
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
