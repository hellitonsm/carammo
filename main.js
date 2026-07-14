import * as THREE from 'three';

// ============================================================================
//  CarAmmo — corrida com Ammo.js + Three.js
//  W/S acelerar/frear · A/D virar · Espaço freio · R reset
// ============================================================================

let Ammo = window.Ammo;
const tmpVec3 = () => new Ammo.btVector3(0, 0, 0);
const tmpTrans = () => new Ammo.btTransform();

const CFG = {
  chassisSize: { x: 1.0, y: 0.5, z: 2.2 },
  chassisMass: 800,
  wheelRadius: 0.4,
  wheelWidth: 0.3,
  wheelAxisOffset: { x: 0.9, y: -0.2, z: 1.4 },
  engineForce: 2800,
  brakingForce: 90,
  maxSteer: 0.55,
  steerSpeed: 0.05,
  cameraHeight: 4.0,
  cameraDistance: 9.0,
  groundFriction: 0.9,
  trackWidth: 12,
  worldSize: 600,
  treeCount: 350,
  raceLaps: 3,
};

let selectedCarColor = 0xd62828;

let renderer, scene, camera, clock, sun;
let carMesh, wheelMeshes = [];
let headlightBeamL, headlightBeamR;
let vehicle, chassisBody;
let physicsWorld;
let lap = 0;
let raceState = 'menu'; // menu | countdown | racing | finished
let countdownValue = 3;
let countdownTimer = 0;
let lapStartTime = 0;
let bestLapMs = null;
let totalRaceMs = 0;
let raceAccumMs = 0;
let controlsEnabled = false;
let frameProgress = 0;

const skidMarks = [];
const MAX_SKIDS = 120;
let skidGeo, skidMat;

function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '1';
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87b8d8);
  scene.fog = new THREE.FogExp2(0x9ec5de, 0.0018);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 10, 20);

  // Céu em hemisfério (mais vivo que cor flat)
  const hemi = new THREE.HemisphereLight(0xc8e4ff, 0x3d5c2e, 0.55);
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(0xffffff, 0.28);
  scene.add(ambient);

  sun = new THREE.DirectionalLight(0xfff2d6, 1.35);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  sun.shadow.camera.left = -140;
  sun.shadow.camera.right = 140;
  sun.shadow.camera.top = 140;
  sun.shadow.camera.bottom = -140;
  sun.shadow.camera.far = 320;
  sun.shadow.camera.near = 10;
  scene.add(sun);
  scene.add(sun.target);

  // Gradiente de céu simples (domo)
  const skyGeo = new THREE.SphereGeometry(900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4a90c8) },
      bottomColor: { value: new THREE.Color(0xd4e8f5) },
      offset: { value: 40 },
      exponent: { value: 0.55 },
    },
    vertexShader: `
      varying vec3 vWorldPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPos;
      void main() {
        float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
        float t = max(pow(max(h, 0.0), exponent), 0.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);

  // Pool de marcas de freio
  skidGeo = new THREE.PlaneGeometry(0.35, 1.1);
  skidMat = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  });
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function makeAsphaltTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2c2c2c';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 6000; i++) {
    const g = 35 + Math.random() * 40;
    ctx.fillStyle = `rgba(${g},${g},${g},${0.15 + Math.random() * 0.25})`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 1);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGrassTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3f6e35';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const r = 40 + Math.random() * 50;
    const g = 90 + Math.random() * 70;
    const b = 35 + Math.random() * 30;
    ctx.fillStyle = `rgba(${r},${g},${b},0.35)`;
    ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(80, 80);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function initPhysics() {
  const collisionConfig = new Ammo.btDefaultCollisionConfiguration();
  const dispatcher = new Ammo.btCollisionDispatcher(collisionConfig);
  const broadphase = new Ammo.btDbvtBroadphase();
  const solver = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, broadphase, solver, collisionConfig);
  physicsWorld.setGravity(new Ammo.btVector3(0, -9.81, 0));
}

function makeBox(half, pos, mass, color) {
  const geo = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);

  const shape = new Ammo.btBoxShape(new Ammo.btVector3(half.x, half.y, half.z));
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));

  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  if (mass > 0) shape.calculateLocalInertia(mass, localInertia);

  const info = new Ammo.btRigidBodyConstructionInfo(mass, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(info);
  body.setFriction(CFG.groundFriction);
  if (mass === 0) body.setCollisionFlags(body.getCollisionFlags() | 2);
  physicsWorld.addRigidBody(body);

  return { mesh, body };
}

function buildEnvironment() {
  const grassGeo = new THREE.PlaneGeometry(CFG.worldSize, CFG.worldSize, 1, 1);
  const grassMat = new THREE.MeshStandardMaterial({
    map: makeGrassTexture(),
    color: 0xffffff,
    roughness: 0.95,
  });
  const grass = new THREE.Mesh(grassGeo, grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -1.5;
  grass.receiveShadow = true;
  scene.add(grass);

  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
  const leafGeo = new THREE.ConeGeometry(1.6, 4, 8);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 0.8 });

  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, CFG.treeCount);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, CFG.treeCount);
  trunkMesh.castShadow = true;
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  scene.add(trunkMesh);
  scene.add(leafMesh);

  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < CFG.treeCount && attempts < CFG.treeCount * 8) {
    attempts++;
    const x = (Math.random() - 0.5) * CFG.worldSize * 0.9;
    const z = (Math.random() - 0.5) * CFG.worldSize * 0.9;

    const nearest = nearestOnCurve(trackCurve, new THREE.Vector3(x, 0, z));
    if (nearest.dist < 14) continue;
    if (Math.hypot(x, z) < 25) continue;

    const scale = 0.8 + Math.random() * 1.6;
    dummy.position.set(x, 0.75 * scale, z);
    dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(placed, dummy.matrix);

    dummy.position.y = 1.5 * scale + 1.5 * scale;
    dummy.updateMatrix();
    leafMesh.setMatrixAt(placed, dummy.matrix);

    placed++;
  }
  trunkMesh.count = placed;
  leafMesh.count = placed;
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
}

function nearestOnCurve(curve, p) {
  const N = 200;
  let best = Infinity;
  let bestT = 0;
  let bestPt = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const q = curve.getPointAt(t);
    const d = q.distanceTo(p);
    if (d < best) { best = d; bestT = t; bestPt = q; }
  }
  return { dist: best, t: bestT, point: bestPt };
}

function getProgressOnTrack(pos) {
  return nearestOnCurve(trackCurve, pos).t;
}

let trackCurve = null;
let trackLength = 0;
let trackStartPos = new THREE.Vector3();
let trackStartDir = new THREE.Vector3();
let trackPrevProgress = 0;
let minimapPath = null;

function buildTrack() {
  const pts = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(24, 0, 2),
    new THREE.Vector3(50, 0, 5),
    new THREE.Vector3(100, 0, 0),
    new THREE.Vector3(130, 0.2, -20),
    new THREE.Vector3(140, 0.4, -50),
    new THREE.Vector3(130, 0.6, -80),
    new THREE.Vector3(100, 0.4, -100),
    new THREE.Vector3(60, 0.2, -110),
    new THREE.Vector3(20, 0, -100),
    new THREE.Vector3(0, 0, -80),
    new THREE.Vector3(-22, 0.2, -68),
    new THREE.Vector3(-26, 0.3, -50),
    new THREE.Vector3(-24, 0.35, -34),
    new THREE.Vector3(-38, 0.4, -16),
    new THREE.Vector3(-58, 0.5, -4),
    new THREE.Vector3(-82, 0.6, 20),
    new THREE.Vector3(-96, 0.7, 44),
    new THREE.Vector3(-86, 0.55, 66),
    new THREE.Vector3(-64, 0.4, 80),
    new THREE.Vector3(-38, 0.3, 80),
    new THREE.Vector3(-18, 0.2, 66),
    new THREE.Vector3(-8, 0.15, 48),
    new THREE.Vector3(-5, 0.05, 28),
  ];

  trackCurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  trackLength = trackCurve.getLength();

  trackStartPos = trackCurve.getPointAt(0).clone();
  trackStartPos.y += CFG.wheelRadius + 0.6;
  trackStartDir = trackCurve.getTangentAt(0).clone();

  const asphaltGeo = buildRibbon(trackCurve, CFG.trackWidth / 2, 1000);
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: makeAsphaltTexture(),
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  const rumbleWidth = 1.0;
  const rumbleSegments = 200;
  const rumbleMatRed = new THREE.MeshStandardMaterial({ color: 0xff2222, roughness: 0.8 });
  const rumbleMatWhite = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });

  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < rumbleSegments; i++) {
      const t1 = i / rumbleSegments;
      const t2 = (i + 1) / rumbleSegments;

      const p1 = trackCurve.getPointAt(t1);
      const p2 = trackCurve.getPointAt(t2);
      const tan1 = trackCurve.getTangentAt(t1);
      const tan2 = trackCurve.getTangentAt(t2);

      const n1 = new THREE.Vector3(-tan1.z, 0, tan1.x).normalize();
      const n2 = new THREE.Vector3(-tan2.z, 0, tan2.x).normalize();

      const offset = side * (CFG.trackWidth / 2 - rumbleWidth / 2);

      const geo = new THREE.BufferGeometry();
      const positions = [
        p1.x + n1.x * offset, p1.y + 0.15, p1.z + n1.z * offset,
        p1.x + n1.x * (offset + side * rumbleWidth), p1.y + 0.15, p1.z + n1.z * (offset + side * rumbleWidth),
        p2.x + n2.x * offset, p2.y + 0.15, p2.z + n2.z * offset,
        p2.x + n2.x * (offset + side * rumbleWidth), p2.y + 0.15, p2.z + n2.z * (offset + side * rumbleWidth),
      ];
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex([0, 2, 1, 1, 2, 3]);
      geo.computeVertexNormals();

      const mat = i % 2 === 0 ? rumbleMatRed : rumbleMatWhite;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      scene.add(mesh);
    }
  }

  const sideLineGeoL = buildRibbon(offsetCurve(trackCurve, CFG.trackWidth / 2 - 0.4, false), 0.15, 1000);
  const sideLineGeoR = buildRibbon(offsetCurve(trackCurve, CFG.trackWidth / 2 - 0.4, true), 0.15, 1000);
  const sideLineMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.55, emissive: 0x332200, emissiveIntensity: 0.15 });
  scene.add(new THREE.Mesh(sideLineGeoL, sideLineMat));
  scene.add(new THREE.Mesh(sideLineGeoR, sideLineMat));

  const dashLength = 2;
  const dashGap = 3;
  const dashCount = Math.floor(trackLength / (dashLength + dashGap));
  const dashGeo = new THREE.PlaneGeometry(0.2, dashLength);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, side: THREE.DoubleSide });

  for (let i = 0; i < dashCount; i++) {
    const t = (i * (dashLength + dashGap)) / trackLength;
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);

    const dash = new THREE.Mesh(dashGeo, dashMat);
    dash.position.set(p.x, p.y + 0.16, p.z);
    const slope = Math.atan2(tan.y, Math.sqrt(tan.x * tan.x + tan.z * tan.z));
    dash.rotation.x = -Math.PI / 2 + slope;
    dash.rotation.z = Math.atan2(tan.x, tan.z);
    scene.add(dash);
  }

  const off = CFG.trackWidth / 2 + 0.8;
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xc03030, roughness: 0.65, metalness: 0.15, side: THREE.DoubleSide });
  const barrierL = new THREE.Mesh(buildSegmentedBarrier(trackCurve, off, 1, 0.6), barrierMat);
  const barrierR = new THREE.Mesh(buildSegmentedBarrier(trackCurve, off, -1, 0.6), barrierMat);
  barrierL.castShadow = barrierR.castShadow = true;
  barrierL.receiveShadow = barrierR.receiveShadow = true;
  scene.add(barrierL);
  scene.add(barrierR);

  const poleGeo = new THREE.CylinderGeometry(0.1, 0.15, 6, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5, metalness: 0.8 });
  const lightGeo = new THREE.SphereGeometry(0.22, 10, 10);
  const lightMat = new THREE.MeshStandardMaterial({
    color: 0xffffcc,
    emissive: 0xffff88,
    emissiveIntensity: 1.1,
  });

  const poleCount = Math.floor(trackLength / 30);
  for (let i = 0; i < poleCount; i++) {
    const t = i / poleCount;
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    for (let side = -1; side <= 1; side += 2) {
      const polePos = p.clone().addScaledVector(n, side * (CFG.trackWidth / 2 + 2));

      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(polePos.x, p.y + 3, polePos.z);
      pole.castShadow = true;
      scene.add(pole);

      const light = new THREE.Mesh(lightGeo, lightMat);
      light.position.set(polePos.x, p.y + 6.2, polePos.z);
      scene.add(light);
    }
  }

  const coneGeo = new THREE.ConeGeometry(0.2, 0.6, 8);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.55 });
  const coneCount = Math.floor(trackLength / 12);
  for (let i = 0; i < coneCount; i++) {
    const t = i / coneCount;
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    const side = (i % 2 === 0) ? 1 : -1;
    const conePos = p.clone().addScaledVector(n, side * (CFG.trackWidth / 2 + 1.5));

    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(conePos.x, p.y + 0.4, conePos.z);
    cone.castShadow = true;
    scene.add(cone);
  }

  const rockGeo = new THREE.DodecahedronGeometry(0.4, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.95 });
  for (let i = 0; i < 80; i++) {
    const t = Math.random();
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

    const side = (Math.random() > 0.5) ? 1 : -1;
    const dist = CFG.trackWidth / 2 + 2 + Math.random() * 5;
    const rockPos = p.clone().addScaledVector(n, side * dist);

    const rock = new THREE.Mesh(rockGeo, rockMat);
    const scale = 0.5 + Math.random() * 1.5;
    rock.position.set(rockPos.x, p.y + scale * 0.3, rockPos.z);
    rock.scale.set(scale, scale * 0.6, scale);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }

  const trackPositions = asphaltGeo.attributes.position.array;
  const trackIndices = asphaltGeo.index.array;

  const triangleMesh = new Ammo.btTriangleMesh();
  for (let i = 0; i < trackIndices.length; i += 3) {
    const i0 = trackIndices[i] * 3;
    const i1 = trackIndices[i + 1] * 3;
    const i2 = trackIndices[i + 2] * 3;

    const v0 = new Ammo.btVector3(trackPositions[i0], trackPositions[i0 + 1], trackPositions[i0 + 2]);
    const v1 = new Ammo.btVector3(trackPositions[i1], trackPositions[i1 + 1], trackPositions[i1 + 2]);
    const v2 = new Ammo.btVector3(trackPositions[i2], trackPositions[i2 + 1], trackPositions[i2 + 2]);

    triangleMesh.addTriangle(v0, v1, v2, true);

    Ammo.destroy(v0);
    Ammo.destroy(v1);
    Ammo.destroy(v2);
  }

  const trackShape = new Ammo.btBvhTriangleMeshShape(triangleMesh, true);
  const trackTransform = new Ammo.btTransform();
  trackTransform.setIdentity();
  const trackMotionState = new Ammo.btDefaultMotionState(trackTransform);
  const trackInfo = new Ammo.btRigidBodyConstructionInfo(0, trackMotionState, trackShape, new Ammo.btVector3(0, 0, 0));
  const trackBody = new Ammo.btRigidBody(trackInfo);
  trackBody.setFriction(0.85);
  physicsWorld.addRigidBody(trackBody);

  const startTangent = trackCurve.getTangentAt(0).clone();
  const startPos = trackCurve.getPointAt(0).clone();
  const startGeo = new THREE.BoxGeometry(CFG.trackWidth, 0.05, 1.6);
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 8;
  const ctx = canvas.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#fff' : '#111';
    ctx.fillRect(i * 8, 0, 8, 8);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const startMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
  const startMesh = new THREE.Mesh(startGeo, startMat);
  startMesh.position.copy(startPos);
  startMesh.position.y += 0.12;
  startMesh.lookAt(startPos.clone().add(startTangent));
  scene.add(startMesh);

  // Pré-calcula path do minimapa
  minimapPath = [];
  for (let i = 0; i <= 120; i++) {
    const p = trackCurve.getPointAt(i / 120);
    minimapPath.push({ x: p.x, z: p.z });
  }

  trackPrevProgress = 0;
}

function buildRibbon(curve, halfWidth, segments) {
  const positions = [];
  const indices = [];
  const uvs = [];
  for (let i = 0; i <= segments; i++) {
    const t = i === segments ? 0 : i / segments;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const left = p.clone().addScaledVector(n, -halfWidth);
    const right = p.clone().addScaledVector(n, halfWidth);
    positions.push(left.x, left.y, left.z);
    positions.push(right.x, right.y, right.z);
    uvs.push(0, t * 40);
    uvs.push(1, t * 40);
    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function offsetCurve(curve, dist, outward) {
  const samples = 400;
  const newPts = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    if (!outward) n.negate();
    newPts.push(p.clone().addScaledVector(n, dist));
  }
  newPts.push(newPts[0].clone());
  return new THREE.CatmullRomCurve3(newPts, true, 'centripetal', 0.5);
}

/** Barreira — placa flat (guard rail) seguindo o offset da pista. */
function buildSegmentedBarrier(curve, offsetDist, sideSign, height, segments = 600) {
  const positions = [];
  const indices = [];
  const uvs = [];
  const _n = new THREE.Vector3();
  const _tan = new THREE.Vector3();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    _tan.copy(curve.getTangentAt(t)).normalize();
    _n.set(-_tan.z, 0, _tan.x).normalize().multiplyScalar(sideSign);

    const bx = p.x + _n.x * offsetDist;
    const bz = p.z + _n.z * offsetDist;
    const by = p.y;

    positions.push(bx, by, bz);
    positions.push(bx, by + height, bz);
    uvs.push(0, t * 40);
    uvs.push(1, t * 40);

    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCar() {
  const half = CFG.chassisSize;

  const geo = new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2);
  const mat = new THREE.MeshStandardMaterial({
    color: selectedCarColor,
    roughness: 0.28,
    metalness: 0.75,
  });
  carMesh = new THREE.Mesh(geo, mat);
  carMesh.castShadow = true;
  scene.add(carMesh);

  const cabGeo = new THREE.BoxGeometry(half.x * 1.6, half.y * 1.2, half.z * 0.9);
  const cabMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 0.08,
    metalness: 0.9,
    transparent: true,
    opacity: 0.72,
  });
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.y = half.y + half.y * 0.4;
  cab.position.z = -half.z * 0.1;
  cab.castShadow = true;
  carMesh.add(cab);

  const bumperGeo = new THREE.BoxGeometry(half.x * 2.1, half.y * 0.8, 0.3);
  const bumperMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.55 });
  const frontBumper = new THREE.Mesh(bumperGeo, bumperMat);
  frontBumper.position.z = half.z + 0.15;
  frontBumper.position.y = -half.y * 0.2;
  carMesh.add(frontBumper);

  const rearBumper = new THREE.Mesh(bumperGeo, bumperMat);
  rearBumper.position.z = -half.z - 0.15;
  rearBumper.position.y = -half.y * 0.2;
  carMesh.add(rearBumper);

  const headlightGeo = new THREE.SphereGeometry(0.15, 12, 12);
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffee,
    emissive: 0xffffaa,
    emissiveIntensity: 1.4,
  });
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat);
  headlightL.position.set(-half.x * 0.7, 0, half.z + 0.1);
  carMesh.add(headlightL);
  const headlightR = new THREE.Mesh(headlightGeo, headlightMat);
  headlightR.position.set(half.x * 0.7, 0, half.z + 0.1);
  carMesh.add(headlightR);

  headlightBeamL = new THREE.SpotLight(0xfff5d6, 2.2, 35, Math.PI / 7, 0.45, 1.2);
  headlightBeamL.position.copy(headlightL.position);
  headlightBeamL.target.position.set(-half.x * 0.7, -0.4, half.z + 12);
  carMesh.add(headlightBeamL);
  carMesh.add(headlightBeamL.target);

  headlightBeamR = new THREE.SpotLight(0xfff5d6, 2.2, 35, Math.PI / 7, 0.45, 1.2);
  headlightBeamR.position.copy(headlightR.position);
  headlightBeamR.target.position.set(half.x * 0.7, -0.4, half.z + 12);
  carMesh.add(headlightBeamR);
  carMesh.add(headlightBeamR.target);

  const taillightGeo = new THREE.SphereGeometry(0.12, 12, 12);
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 0.45,
  });
  carMesh.userData.taillightMat = taillightMat;
  const taillightL = new THREE.Mesh(taillightGeo, taillightMat);
  taillightL.position.set(-half.x * 0.7, 0, -half.z - 0.1);
  carMesh.add(taillightL);
  const taillightR = new THREE.Mesh(taillightGeo, taillightMat);
  taillightR.position.set(half.x * 0.7, 0, -half.z - 0.1);
  carMesh.add(taillightR);

  const spoilerGeo = new THREE.BoxGeometry(half.x * 1.8, 0.1, 0.4);
  const spoilerMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.35 });
  const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
  spoiler.position.set(0, half.y * 1.2, -half.z * 0.8);
  carMesh.add(spoiler);

  const supportGeo = new THREE.BoxGeometry(0.1, 0.3, 0.1);
  const supportL = new THREE.Mesh(supportGeo, spoilerMat);
  supportL.position.set(-half.x * 0.7, half.y * 0.9, -half.z * 0.8);
  carMesh.add(supportL);
  const supportR = new THREE.Mesh(supportGeo, spoilerMat);
  supportR.position.set(half.x * 0.7, half.y * 0.9, -half.z * 0.8);
  carMesh.add(supportR);

  const compound = new Ammo.btCompoundShape();
  const boxShape = new Ammo.btBoxShape(new Ammo.btVector3(half.x, half.y, half.z));
  const childTransform = new Ammo.btTransform();
  childTransform.setIdentity();
  childTransform.setOrigin(new Ammo.btVector3(0, 2.0, 0));
  compound.addChildShape(childTransform, boxShape);

  const startTransform = new Ammo.btTransform();
  startTransform.setIdentity();
  startTransform.setOrigin(new Ammo.btVector3(trackStartPos.x, trackStartPos.y, trackStartPos.z));
  const yaw = Math.atan2(trackStartDir.x, trackStartDir.z);
  const q = new Ammo.btQuaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
  startTransform.setRotation(q);

  const motionState = new Ammo.btDefaultMotionState(startTransform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  compound.calculateLocalInertia(CFG.chassisMass, localInertia);

  const info = new Ammo.btRigidBodyConstructionInfo(CFG.chassisMass, motionState, compound, localInertia);
  chassisBody = new Ammo.btRigidBody(info);
  chassisBody.setDamping(0.3, 0.95);
  physicsWorld.addRigidBody(chassisBody);

  const tuning = new Ammo.btVehicleTuning();
  const raycaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
  vehicle = new Ammo.btRaycastVehicle(tuning, chassisBody, raycaster);
  vehicle.setCoordinateSystem(0, 1, 2);
  physicsWorld.addAction(vehicle);

  const wheelDir = new Ammo.btVector3(0, -1, 0);
  const wheelAxle = new Ammo.btVector3(-1, 0, 0);
  const suspensionRest = 0.4;

  const tireGeo = new THREE.CylinderGeometry(CFG.wheelRadius, CFG.wheelRadius, CFG.wheelWidth, 18);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
  const rimGeo = new THREE.CylinderGeometry(CFG.wheelRadius * 0.6, CFG.wheelRadius * 0.6, CFG.wheelWidth * 0.9, 12);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.25, metalness: 0.85 });

  const positions = [
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, isFront: true },
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: CFG.wheelAxisOffset.z, isFront: true },
    { x: -CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, isFront: false },
    { x: CFG.wheelAxisOffset.x, y: CFG.wheelAxisOffset.y, z: -CFG.wheelAxisOffset.z, isFront: false },
  ];

  wheelMeshes = [];
  positions.forEach((p) => {
    const connection = new Ammo.btVector3(p.x, p.y, p.z);
    vehicle.addWheel(connection, wheelDir, wheelAxle, suspensionRest, CFG.wheelRadius, tuning, p.isFront);

    const wheelGroup = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    scene.add(wheelGroup);
    wheelMeshes.push(wheelGroup);
  });

  for (let i = 0; i < 4; i++) {
    const wi = vehicle.getWheelInfo(i);
    wi.set_m_suspensionStiffness(50);
    wi.set_m_wheelsDampingRelaxation(8.0);
    wi.set_m_wheelsDampingCompression(20.0);
    wi.set_m_frictionSlip(8.0);
    wi.set_m_rollInfluence(0.005);
  }
}

const keys = { w: false, s: false, a: false, d: false, space: false, r: false };
let currentSteer = 0;
let currentEngineRamp = 0;
let skidCooldown = 0;

function initInput() {
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') keys.w = true;
    if (k === 's') keys.s = true;
    if (k === 'a') keys.a = true;
    if (k === 'd') keys.d = true;
    if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
    if (k === 'r') keys.r = true;
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w') keys.w = false;
    if (k === 's') keys.s = false;
    if (k === 'a') keys.a = false;
    if (k === 'd') keys.d = false;
    if (e.code === 'Space') keys.space = false;
    if (k === 'r') keys.r = false;
  });
}

function spawnSkid() {
  if (skidCooldown > 0) return;
  skidCooldown = 0.04;
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(carMesh.quaternion);
  const yaw = Math.atan2(fwd.x, fwd.z);
  for (const pos of [wheelMeshes[2]?.position, wheelMeshes[3]?.position]) {
    if (!pos) continue;
    const mark = new THREE.Mesh(skidGeo, skidMat.clone());
    mark.position.set(pos.x, 0.17, pos.z);
    mark.rotation.x = -Math.PI / 2;
    mark.rotation.z = yaw;
    mark.material.opacity = 0.5;
    scene.add(mark);
    skidMarks.push({ mesh: mark, life: 4.5 });
    if (skidMarks.length > MAX_SKIDS) {
      const old = skidMarks.shift();
      scene.remove(old.mesh);
      old.mesh.material.dispose();
    }
  }
}

function updateSkids(dt) {
  skidCooldown = Math.max(0, skidCooldown - dt);
  for (let i = skidMarks.length - 1; i >= 0; i--) {
    const s = skidMarks[i];
    s.life -= dt;
    s.mesh.material.opacity = Math.max(0, s.life / 4.5 * 0.5);
    if (s.life <= 0) {
      scene.remove(s.mesh);
      s.mesh.material.dispose();
      skidMarks.splice(i, 1);
    }
  }
}

function updateVehicleControls(dt) {
  if (keys.r && raceState === 'racing') resetCar(false);

  if (!controlsEnabled || raceState !== 'racing') {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(CFG.brakingForce * 0.4, 0);
    vehicle.setBrake(CFG.brakingForce * 0.4, 1);
    vehicle.setBrake(CFG.brakingForce * 0.4, 2);
    vehicle.setBrake(CFG.brakingForce * 0.4, 3);
    return;
  }

  const vel = chassisBody.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;

  let engineForce = 0;
  let brakeForce = 0;

  if (keys.w) {
    const maxRamp = speedKmh < 30 ? 1.0 : speedKmh < 80 ? 1.5 : speedKmh < 120 ? 2.0 : 2.5;
    currentEngineRamp += (maxRamp - currentEngineRamp) * 0.015;
    engineForce = CFG.engineForce * currentEngineRamp;

    if (speedMs < 0.2) {
      chassisBody.activate();
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(carMesh.quaternion);
      const impulse = new Ammo.btVector3(fwd.x * 20, 0, fwd.z * 20);
      chassisBody.applyCentralImpulse(impulse);
      Ammo.destroy(impulse);
    }
  } else {
    currentEngineRamp = Math.max(0, currentEngineRamp - 0.03);
  }

  if (keys.s) {
    engineForce = -CFG.engineForce * 0.6;
    currentEngineRamp = 0;
  }

  vehicle.applyEngineForce(engineForce, 2);
  vehicle.applyEngineForce(engineForce, 3);

  if (speedMs > 1) {
    const downforce = speedMs * speedMs * 8;
    const force = new Ammo.btVector3(0, -downforce, 0);
    chassisBody.applyCentralForce(force);
    Ammo.destroy(force);
  }

  let target = 0;
  if (keys.a) target = CFG.maxSteer;
  if (keys.d) target = -CFG.maxSteer;
  currentSteer += (target - currentSteer) * CFG.steerSpeed;
  vehicle.setSteeringValue(currentSteer, 0);
  vehicle.setSteeringValue(currentSteer, 1);

  if (keys.space) {
    brakeForce = CFG.brakingForce;
    if (speedKmh > 25) spawnSkid();
  }
  vehicle.setBrake(brakeForce, 0);
  vehicle.setBrake(brakeForce, 1);
  vehicle.setBrake(brakeForce * 0.3, 2);
  vehicle.setBrake(brakeForce * 0.3, 3);

  // Lanternas mais fortes no freio
  if (carMesh.userData.taillightMat) {
    carMesh.userData.taillightMat.emissiveIntensity = keys.space ? 2.2 : 0.45;
  }
}

function resetCar(fullRaceReset = true) {
  const t = new Ammo.btTransform();
  t.setIdentity();
  t.setOrigin(new Ammo.btVector3(trackStartPos.x, trackStartPos.y, trackStartPos.z));
  const yaw = Math.atan2(trackStartDir.x, trackStartDir.z);
  const q = new Ammo.btQuaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2));
  t.setRotation(q);
  chassisBody.setWorldTransform(t);
  chassisBody.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
  chassisBody.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
  chassisBody.activate();
  trackPrevProgress = 0;
  currentEngineRamp = 0;
  currentSteer = 0;

  if (fullRaceReset) {
    lap = 0;
    bestLapMs = null;
    raceAccumMs = 0;
    lapStartTime = performance.now();
  }
}

function syncCar() {
  const wt = vehicle.getChassisWorldTransform();
  const o = wt.getOrigin();
  const q = wt.getRotation();
  carMesh.position.set(o.x(), o.y(), o.z());
  carMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());

  // Sombra do sol segue o carro
  if (sun) {
    sun.target.position.copy(carMesh.position);
    sun.position.set(
      carMesh.position.x + 60,
      carMesh.position.y + 90,
      carMesh.position.z + 40
    );
  }

  for (let i = 0; i < 4; i++) {
    vehicle.updateWheelTransform(i, true);
    const wt2 = vehicle.getWheelTransformWS(i);
    const o2 = wt2.getOrigin();
    const q2 = wt2.getRotation();
    const m = wheelMeshes[i];
    m.position.set(o2.x(), o2.y(), o2.z());
    m.quaternion.set(q2.x(), q2.y(), q2.z(), q2.w());
  }
}

const _camOffset = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camLook = new THREE.Vector3();
let _camShake = 0;

function updateCamera(dt) {
  const vel = chassisBody.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;

  const dist = CFG.cameraDistance + Math.min(speedKmh * 0.035, 5);
  const height = CFG.cameraHeight + Math.min(speedKmh * 0.008, 1.2);
  const targetFov = 58 + Math.min(speedKmh * 0.08, 14);
  camera.fov += (targetFov - camera.fov) * 0.06;
  camera.updateProjectionMatrix();

  _camOffset.set(0, height, -dist);
  _camOffset.applyQuaternion(carMesh.quaternion);
  _camDesired.copy(carMesh.position).add(_camOffset);

  // Shake leve em alta velocidade / freio de mão
  if (speedKmh > 100 || keys.space) {
    _camShake = Math.min(_camShake + dt * 2, 1);
  } else {
    _camShake = Math.max(_camShake - dt * 3, 0);
  }
  if (_camShake > 0) {
    _camDesired.x += (Math.random() - 0.5) * 0.12 * _camShake;
    _camDesired.y += (Math.random() - 0.5) * 0.08 * _camShake;
  }

  const lerp = speedKmh > 80 ? 0.14 : 0.1;
  camera.position.lerp(_camDesired, lerp);

  _camLook.set(0, 0.6, dist * 0.45);
  _camLook.applyQuaternion(carMesh.quaternion);
  _camLook.add(carMesh.position);
  camera.lookAt(_camLook);
}

function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const msPart = Math.floor(total % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`;
}

function updateHUD() {
  if (raceState === 'menu') return;

  const v = chassisBody.getLinearVelocity();
  const speedMs = Math.hypot(v.x(), v.y(), v.z());
  const speedKmh = Math.round(Math.abs(speedMs) * 3.6);
  const speedEl = document.getElementById('speed');
  speedEl.innerHTML = `${speedKmh}<span>km/h</span>`;

  const displayLap = Math.min(lap + 1, CFG.raceLaps);
  document.getElementById('lap').textContent = `Volta ${displayLap} / ${CFG.raceLaps}`;

  if (raceState === 'racing') {
    const elapsed = performance.now() - lapStartTime;
    document.getElementById('lap-time').textContent = formatTime(elapsed);
  }

  document.getElementById('best-time').textContent =
    bestLapMs != null ? `Melhor ${formatTime(bestLapMs)}` : 'Melhor —';

  if (raceState !== 'racing') return;

  if (trackPrevProgress > 0.9 && frameProgress < 0.1) {
    const lapMs = performance.now() - lapStartTime;
    if (bestLapMs == null || lapMs < bestLapMs) bestLapMs = lapMs;
    raceAccumMs += lapMs;
    lap++;
    lapStartTime = performance.now();

    if (lap >= CFG.raceLaps) {
      finishRace();
    }
  }
  trackPrevProgress = frameProgress;
}

function finishRace() {
  raceState = 'finished';
  controlsEnabled = false;
  totalRaceMs = raceAccumMs;
  document.getElementById('finish-best').textContent = `Melhor volta: ${formatTime(bestLapMs)}`;
  document.getElementById('finish-total').textContent = `Tempo total: ${formatTime(totalRaceMs)}`;
  document.getElementById('finish').hidden = false;
}

const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');
let minimapBounds = null;

function updateMinimap() {
  if (!minimapPath || !carMesh) return;

  const width = minimapCanvas.width;
  const height = minimapCanvas.height;
  const padding = 16;

  if (!minimapBounds) {
    const minX = Math.min(...minimapPath.map((p) => p.x));
    const maxX = Math.max(...minimapPath.map((p) => p.x));
    const minZ = Math.min(...minimapPath.map((p) => p.z));
    const maxZ = Math.max(...minimapPath.map((p) => p.z));
    const scaleX = (width - padding * 2) / (maxX - minX || 1);
    const scaleZ = (height - padding * 2) / (maxZ - minZ || 1);
    const scale = Math.min(scaleX, scaleZ);
    minimapBounds = {
      minX, minZ, scale,
      offsetX: (width - (maxX - minX) * scale) / 2,
      offsetZ: (height - (maxZ - minZ) * scale) / 2,
    };
  }

  const { minX, minZ, scale, offsetX, offsetZ } = minimapBounds;

  minimapCtx.fillStyle = 'rgba(6, 12, 9, 0.85)';
  minimapCtx.fillRect(0, 0, width, height);

  minimapCtx.strokeStyle = 'rgba(232, 93, 4, 0.35)';
  minimapCtx.lineWidth = 8;
  minimapCtx.beginPath();
  minimapPath.forEach((p, i) => {
    if (i / (minimapPath.length - 1) > frameProgress) return;
    const x = (p.x - minX) * scale + offsetX;
    const y = (p.z - minZ) * scale + offsetZ;
    if (i === 0) minimapCtx.moveTo(x, y);
    else minimapCtx.lineTo(x, y);
  });
  minimapCtx.stroke();

  minimapCtx.strokeStyle = 'rgba(255,255,255,0.85)';
  minimapCtx.lineWidth = 2.5;
  minimapCtx.beginPath();
  minimapPath.forEach((p, i) => {
    const x = (p.x - minX) * scale + offsetX;
    const y = (p.z - minZ) * scale + offsetZ;
    if (i === 0) minimapCtx.moveTo(x, y);
    else minimapCtx.lineTo(x, y);
  });
  minimapCtx.closePath();
  minimapCtx.stroke();

  const carX = (carMesh.position.x - minX) * scale + offsetX;
  const carY = (carMesh.position.z - minZ) * scale + offsetZ;

  const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(carMesh.quaternion);
  minimapCtx.fillStyle = '#e85d04';
  minimapCtx.beginPath();
  const ang = Math.atan2(dir.x, dir.z);
  minimapCtx.moveTo(carX + Math.sin(ang) * 8, carY + Math.cos(ang) * 8);
  minimapCtx.lineTo(carX + Math.sin(ang + 2.5) * 6, carY + Math.cos(ang + 2.5) * 6);
  minimapCtx.lineTo(carX + Math.sin(ang - 2.5) * 6, carY + Math.cos(ang - 2.5) * 6);
  minimapCtx.closePath();
  minimapCtx.fill();
}

function showCountdown(text, isGo = false) {
  const el = document.getElementById('countdown');
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle('go', isGo);
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function hideCountdown() {
  document.getElementById('countdown').hidden = true;
}

function startCountdown() {
  raceState = 'countdown';
  controlsEnabled = false;
  countdownValue = 3;
  countdownTimer = 1;
  showCountdown('3');
  resetCar(true);
}

function updateCountdown(dt) {
  if (raceState !== 'countdown') return;
  countdownTimer -= dt;
  if (countdownTimer > 0) return;

  countdownValue -= 1;
  if (countdownValue > 0) {
    showCountdown(String(countdownValue));
    countdownTimer = 1;
  } else if (countdownValue === 0) {
    showCountdown('GO!', true);
    raceState = 'racing';
    controlsEnabled = true;
    lapStartTime = performance.now();
    setTimeout(hideCountdown, 700);
  } else {
    hideCountdown();
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);

  updateCountdown(dt);
  updateVehicleControls(dt);
  physicsWorld.stepSimulation(dt, 4, 1 / 120);
  vehicle.updateVehicle(dt);
  syncCar();
  if (carMesh) frameProgress = getProgressOnTrack(carMesh.position);
  updateCamera(dt);
  updateHUD();
  updateMinimap();
  updateSkids(dt);

  if (carMesh && carMesh.position.y < -45 && raceState === 'racing') {
    resetCar(false);
  }

  renderer.render(scene, camera);
}

function waitForAmmo() {
  return new Promise((resolve) => {
    const start = performance.now();
    (function check() {
      if (typeof window.Ammo === 'function') return resolve();
      if (performance.now() - start > 30000) {
        return resolve(new Error('Ammo.js não carregou em 30s (verifique conexão/CDN).'));
      }
      setTimeout(check, 30);
    })();
  });
}

let ammoLoaded = false;
const _menuOptions = document.querySelectorAll('.car-option');
const _startBtn = document.getElementById('start-btn');

_menuOptions.forEach((opt) => {
  opt.addEventListener('click', () => {
    _menuOptions.forEach((o) => o.classList.remove('selected'));
    opt.classList.add('selected');
    selectedCarColor = parseInt(opt.dataset.color);
    if (ammoLoaded) _startBtn.disabled = false;
  });
});

_startBtn.addEventListener('click', () => {
  document.getElementById('menu').hidden = true;
  document.getElementById('hud').hidden = false;
  document.getElementById('finish').hidden = true;
  if (!carMesh) {
    buildCar();
    initInput();
    animate();
  } else {
    // Repinta carcaça se já existia
    carMesh.material.color.setHex(selectedCarColor);
  }
  startCountdown();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  document.getElementById('finish').hidden = true;
  startCountdown();
});

async function main() {
  const err = await waitForAmmo();
  if (err instanceof Error) throw err;

  await window.Ammo();
  Ammo = window.Ammo;

  initThree();
  initPhysics();
  buildTrack();
  buildEnvironment();

  ammoLoaded = true;
  _menuOptions[0].classList.add('selected');
  _startBtn.disabled = false;
}

main().catch((err) => {
  console.error('Falha ao iniciar o jogo:', err);
  const hint = document.querySelector('.menu-hint');
  if (hint) {
    hint.textContent = 'Erro ao carregar Ammo.js. Use: python3 -m http.server';
    hint.style.color = '#ff6b4a';
  }
});
