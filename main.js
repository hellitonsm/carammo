import * as THREE from 'three';

// ============================================================================
//  CarAmmo DELUXE — corrida 3D com Ammo.js + Three.js
//  3 cenários · IA · Nitro · Multi-câmera · Partículas · Som de motor
// ============================================================================

let Ammo = window.Ammo;

// ======================= CONFIG =======================
const CFG = {
  chassisSize: { x: 1.0, y: 0.5, z: 2.2 },
  chassisMass: 800,
  wheelRadius: 0.4,
  wheelWidth: 0.3,
  wheelAxisOffset: { x: 0.9, y: -0.2, z: 1.4 },
  engineForce: 2800,
  nitroForce: 5400,
  brakingForce: 90,
  maxSteer: 0.55,
  steerSpeed: 0.06,
  cameraHeight: 4.0,
  cameraDistance: 9.0,
  groundFriction: 0.9,
  raceLaps: 3,
  maxNitro: 100,
  nitroDrainRate: 35,
  nitroRegenRate: 8,
};

// ======================= SCENES =======================
const SCENES = {
  forest: {
    name: 'Floresta', skyTop: 0x4a90c8, skyBottom: 0xd4e8f5, fog: 0x9ec5de, fogDensity: 0.0018,
    sunColor: 0xfff2d6, sunIntensity: 1.35, ambientColor: 0xffffff, hemiSky: 0xc8e4ff, hemiGround: 0x3d5c2e,
    groundColor: 0x3f6e35, groundTex: 'grass', trackColor: 0x2c2c2c, friction: 0.85,
    treeCount: 380, treeTrunk: 0x6b4423, treeLeaf: 0x2f6b2f, treeScaleRange: [0.8, 1.7],
    rocks: true, cones: true, lamps: true, dustColor: 0xffffff, dustAlpha: 0.2,
    points: [
      [0,0,0],[25,0,4],[55,0.2,8],[90,0.1,0],[120,0.3,-15],[138,0.5,-40],[140,0.6,-70],[125,0.5,-95],
      [100,0.4,-110],[65,0.2,-118],[30,0.1,-108],[5,0,-90],[-15,0.15,-75],[-28,0.3,-55],[-30,0.35,-32],
      [-45,0.4,-14],[-70,0.5,0],[-95,0.55,22],[-100,0.6,48],[-88,0.5,70],[-65,0.4,85],[-38,0.3,82],
      [-20,0.2,70],[-10,0.1,48],[-5,0.02,25],
    ],
    trackWidth: 12, widthVariation: 0,
  },
  desert: {
    name: 'Deserto', skyTop: 0xe89a50, skyBottom: 0xf9d89a, fog: 0xe8c288, fogDensity: 0.0030,
    sunColor: 0xffe0b0, sunIntensity: 1.6, ambientColor: 0xffe6c0, hemiSky: 0xffd9a8, hemiGround: 0xc07a3a,
    groundColor: 0xd6a668, groundTex: 'sand', trackColor: 0x6b5a44, friction: 0.78,
    treeCount: 180, treeTrunk: 0x8a5a30, treeLeaf: 0x556b2f, treeScaleRange: [0.7, 1.4],
    rocks: true, cones: false, lamps: false, dustColor: 0xd6a668, dustAlpha: 0.6,
    points: [
      [0,0,0],[40,0.1,-8],[80,0.3,-30],[100,0.5,-60],[90,0.7,-95],[60,0.6,-120],[20,0.4,-130],
      [-15,0.3,-120],[-40,0.2,-95],[-55,0.15,-60],[-45,0.3,-25],[-25,0.4,5],[-50,0.6,40],[-80,0.7,70],
      [-95,0.6,105],[-70,0.5,120],[-30,0.3,115],[0,0.2,90],[25,0.15,55],[18,0.1,25],
    ],
    trackWidth: 11, widthVariation: 1, rockColor: 0xa87745,
  },
  snow: {
    name: 'Nevasca', skyTop: 0x9fb8cc, skyBottom: 0xe8eff5, fog: 0xcfd9e2, fogDensity: 0.0038,
    sunColor: 0xffffff, sunIntensity: 1.05, ambientColor: 0xdde6f0, hemiSky: 0xe6eef5, hemiGround: 0xbfcdd8,
    groundColor: 0xe8eef5, groundTex: 'snow', trackColor: 0x505860, friction: 0.55,
    treeCount: 280, treeTrunk: 0x4a3525, treeLeaf: 0x2a4030, treeScaleRange: [0.9, 2.0],
    rocks: true, cones: true, lamps: true, snowParticles: true, dustColor: 0xffffff, dustAlpha: 0.5,
    points: [
      [0,0,0],[30,0.1,3],[65,0.05,-5],[110,-0.1,-25],[145,0.2,-60],[140,0.4,-100],[110,0.5,-130],
      [65,0.3,-140],[20,0.1,-125],[-15,0.2,-95],[-5,0.4,-60],[25,0.5,-30],[30,0.3,0],[10,0.2,35],
      [-30,0.1,55],[-70,0.3,70],[-110,0.5,75],[-140,0.6,55],[-145,0.5,20],[-125,0.3,-10],[-90,0.1,-20],[-55,0,-5],
    ],
    trackWidth: 13, widthVariation: 2, rockColor: 0x8a95a0,
  },
};

// ======================= STATE =======================
let selectedCarColor = 0xd62828, selectedScene = 'forest', aiEnabled = true, nitroEnabled = true, paused = false;
let renderer, scene, camera, clock, sun;
let vehicles = [], playerVehicle, physicsWorld, currentSceneDef;
let trackCurve, trackLength, trackStartPos, trackStartDir, trackWidth;
let minimapPath, minimapBounds;
let lap = 0, raceState = 'menu', countdownValue = 3, countdownTimer = 0;
let lapStartTime = 0, bestLapMs = null, totalRaceMs = 0, raceAccumMs = 0;
let controlsEnabled = false, frameProgress = 0;
let nitro = CFG.maxNitro, nitroActive = false, camMode = 0;
let snowParticles = null;
let skidMarks = [], MAX_SKIDS = 240, skidGeo, skidMat;
let keys = { w:false,s:false,a:false,d:false,space:false,shift:false,r:false,c:false,escape:false };
let currentSteer = 0, skidCooldown = 0, cameraToggleCooldown = 0, escapeCooldown = 0;
let audioCtx = null, engineOsc = null, engineGain = null;

// Speed lines
let speedLines = null;
// Wheel dust/snow/sand spray particles per vehicle
const worldParticles = []; // {geo, mat, data, index, sceneObj, count}

// ======================= INIT =======================
function initThree() {
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0'; renderer.domElement.style.left = '0'; renderer.domElement.style.zIndex = '1';
  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 10, 20);
  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);

  skidGeo = new THREE.PlaneGeometry(0.35, 1.1);
  skidMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.5, depthWrite: false });

  initSpeedLines();
  initAudio();
}

function initSpeedLines() {
  // Fullscreen-ish streaks, parented to camera
  const count = 80;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count*3);
  const alphas = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i*3] = (Math.random()-0.5) * 40;
    positions[i*3+1] = (Math.random()-0.5) * 20 - 2;
    positions[i*3+2] = -20 - Math.random()*30;
    alphas[i] = 0;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false });
  speedLines = new THREE.LineSegments(new THREE.BufferGeometry(), mat);
  // Use segments: each "line" is 2 points
  const segCount = 60;
  const segPos = new Float32Array(segCount * 6);
  const segData = [];
  for (let i = 0; i < segCount; i++) {
    const idx = i*6;
    segPos[idx] = 0; segPos[idx+1] = 0; segPos[idx+2] = 0;
    segPos[idx+3] = 0; segPos[idx+4] = 0; segPos[idx+5] = 0;
    segData.push({ life: 0, maxLife: 0 });
  }
  const segGeo = new THREE.BufferGeometry();
  segGeo.setAttribute('position', new THREE.BufferAttribute(segPos, 3));
  const segMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  speedLines = new THREE.LineSegments(segGeo, segMat);
  speedLines.frustumCulled = false;
  speedLines.userData.data = segData;
  speedLines.userData.segCount = segCount;
  camera.add(speedLines);
  scene.add(camera); // camera re-added explicitly (already in scene, but ensure parent)
}

function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    engineOsc = audioCtx.createOscillator();
    engineGain = audioCtx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineOsc.start();
  } catch(e) {
    audioCtx = null;
  }
}

function updateEngineSound(speedKmh, accel, braking) {
  if (!audioCtx) return;
  // Frequency based on speed + a little rev on accel
  const base = 50 + speedKmh * 1.4 + (accel ? 40 : 0);
  const target = Math.min(380, Math.max(55, base));
  engineOsc.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.08);
  const vol = Math.min(0.05, 0.015 + speedKmh/3500 + (accel?0.015:0) - (braking?0.005:0));
  engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
}

function beep(freq = 440, dur = 0.15, vol = 0.2) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.value = vol;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ======================= TEXTURES =======================
function makeAsphaltTexture(scn) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const col = new THREE.Color(scn.trackColor);
  ctx.fillStyle = `rgb(${col.r*255|0},${col.g*255|0},${col.b*255|0})`;
  ctx.fillRect(0,0,size,size);
  const speck = scn.name==='Nevasca'?80:scn.name==='Deserto'?50:40;
  for (let i=0;i<6000;i++){
    const g = speck+Math.random()*40;
    ctx.fillStyle = `rgba(${g},${g},${g},${0.12+Math.random()*0.2})`;
    ctx.fillRect(Math.random()*size, Math.random()*size, 1+Math.random()*2, 1);
  }
  if (scn.name==='Nevasca') {
    for (let i=0;i<140;i++){
      ctx.strokeStyle = `rgba(30,30,35,${0.08+Math.random()*0.15})`;
      ctx.lineWidth = 1; ctx.beginPath();
      const y = Math.random()*size;
      ctx.moveTo(0,y);
      ctx.bezierCurveTo(size*0.3,y+(Math.random()-0.5)*10,size*0.7,y+(Math.random()-0.5)*10,size,y+(Math.random()-0.5)*6);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(40,1);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGroundTexture(type) {
  const size = 256;
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  let base, speck;
  if (type==='grass') { base='#3f6e35'; speck = () => {
    const r=40+Math.random()*50,g=90+Math.random()*70,b=35+Math.random()*30; return `rgba(${r},${g},${b},0.4)`; }; }
  else if (type==='sand') { base='#d6a668'; speck = () => {
    const v=160+Math.random()*60; return `rgba(${v},${v-20},${v-60},0.35)`; }; }
  else { base='#e8eef5'; speck = () => { const v=200+Math.random()*55; return `rgba(${v},${v},${v+5},0.35)`; }; }
  ctx.fillStyle = base; ctx.fillRect(0,0,size,size);
  for (let i=0;i<5000;i++){ ctx.fillStyle=speck(); ctx.fillRect(Math.random()*size,Math.random()*size,1+Math.random()*2,1+Math.random()*2); }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(80,80);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ======================= PHYSICS =======================
function initPhysics() {
  const cc = new Ammo.btDefaultCollisionConfiguration();
  const dp = new Ammo.btCollisionDispatcher(cc);
  const bp = new Ammo.btDbvtBroadphase();
  const sl = new Ammo.btSequentialImpulseConstraintSolver();
  physicsWorld = new Ammo.btDiscreteDynamicsWorld(dp, bp, sl, cc);
  physicsWorld.setGravity(new Ammo.btVector3(0,-9.81,0));
}

// ======================= SKY =======================
function buildSky(scn) {
  scene.background = new THREE.Color(scn.fog);
  scene.fog = new THREE.FogExp2(scn.fog, scn.fogDensity);
  scene.children.filter(o => o.isLight || o.isSky).forEach(o => scene.remove(o));
  scene.add(new THREE.HemisphereLight(scn.hemiSky, scn.hemiGround, 0.55));
  scene.add(new THREE.AmbientLight(scn.ambientColor, 0.3));
  sun = new THREE.DirectionalLight(scn.sunColor, scn.sunIntensity);
  sun.position.set(60,90,40); sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
  const s = 160;
  sun.shadow.camera.left=-s; sun.shadow.camera.right=s; sun.shadow.camera.top=s; sun.shadow.camera.bottom=-s;
  sun.shadow.camera.far=350; sun.shadow.camera.near=10;
  scene.add(sun); scene.add(sun.target);
  const skyGeo = new THREE.SphereGeometry(1100,32,16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { topColor:{value:new THREE.Color(scn.skyTop)}, bottomColor:{value:new THREE.Color(scn.skyBottom)}, offset:{value:60}, exponent:{value:0.55} },
    vertexShader: `varying vec3 vWP; void main(){ vec4 w=modelMatrix*vec4(position,1.); vWP=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 topColor,bottomColor; uniform float offset,exponent; varying vec3 vWP; void main(){ float h=normalize(vWP+vec3(0.,offset,0.)).y; float t=max(pow(max(h,0.),exponent),0.); gl_FragColor=vec4(mix(bottomColor,topColor,t),1.);}`,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat); sky.isSky = true; scene.add(sky);
}

// ======================= TRACK HELPERS =======================
function buildRibbon(curve, halfW, segs, wFn) {
  const pos=[], idx=[], uv=[];
  for (let i=0;i<=segs;i++){
    const t = i===segs?0:i/segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const w = wFn?halfW*wFn(t):halfW;
    const L=p.clone().addScaledVector(n,-w), R=p.clone().addScaledVector(n,w);
    pos.push(L.x,L.y,L.z); pos.push(R.x,R.y,R.z);
    uv.push(0,t*50); uv.push(1,t*50);
    if (i<segs){const a=i*2,b=a+1,c=a+2,d=a+3; idx.push(a,c,b,b,c,d);}
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function offsetCurve(curve, dist, outward, wFn) {
  const pts = []; const samples=400;
  for (let i=0;i<samples;i++){
    const t=i/samples; const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t); const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    if (!outward) n.negate();
    const w = wFn?dist*wFn(t):dist;
    pts.push(p.clone().addScaledVector(n,w));
  }
  pts.push(pts[0].clone());
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
}
function buildSegmentedBarrier(curve, off, side, height, wFn, segs=500) {
  const pos=[], idx=[], uv=[];
  const n=new THREE.Vector3(), tan=new THREE.Vector3();
  for (let i=0;i<=segs;i++){
    const t=i/segs; const p=curve.getPointAt(t);
    tan.copy(curve.getTangentAt(t)).normalize();
    n.set(-tan.z,0,tan.x).normalize().multiplyScalar(side);
    const w = wFn?off*wFn(t):off;
    pos.push(p.x+n.x*w, p.y, p.z+n.z*w);
    pos.push(p.x+n.x*w, p.y+height, p.z+n.z*w);
    uv.push(0,t*40); uv.push(1,t*40);
    if (i<segs){const a=i*2; idx.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function widthFnFor(scn){
  if (!scn.widthVariation) return null;
  return t => 1 + Math.sin(t*Math.PI*4)*0.08*scn.widthVariation + Math.sin(t*Math.PI*9+1.3)*0.06*scn.widthVariation;
}

// ======================= TRACK BUILD =======================
function buildTrack(scn) {
  const pts = scn.points.map(p => new THREE.Vector3(p[0],p[1],p[2]));
  trackCurve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  trackLength = trackCurve.getLength();
  trackWidth = scn.trackWidth;
  const wFn = widthFnFor(scn);

  trackStartPos = trackCurve.getPointAt(0).clone();
  trackStartPos.y += CFG.wheelRadius + 0.6;
  trackStartDir = trackCurve.getTangentAt(0).clone();

  const bound = computeTrackBounds(trackCurve, 200);
  const worldSize = Math.max(bound.sizeX, bound.sizeZ)*1.6 + 200;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize,worldSize,1,1),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(scn.groundTex), color: scn.groundColor, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI/2; ground.position.set(bound.cx,-1.5,bound.cz); ground.receiveShadow=true; scene.add(ground);

  const asphaltGeo = buildRibbon(trackCurve, trackWidth/2, 1200, wFn);
  const asphaltMat = new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(scn), roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat); asphalt.receiveShadow = true; scene.add(asphalt);

  addRumbleStrips(scn,wFn); addLaneMarkings(scn,wFn); addSideLines(scn,wFn); addBarriers(scn,wFn);

  // Collision
  const tp = asphaltGeo.attributes.position.array;
  const ti = asphaltGeo.index.array;
  const tmesh = new Ammo.btTriangleMesh();
  for (let i=0;i<ti.length;i+=3){
    const a=ti[i]*3,b=ti[i+1]*3,c=ti[i+2]*3;
    const v0=new Ammo.btVector3(tp[a],tp[a+1],tp[a+2]), v1=new Ammo.btVector3(tp[b],tp[b+1],tp[b+2]), v2=new Ammo.btVector3(tp[c],tp[c+1],tp[c+2]);
    tmesh.addTriangle(v0,v1,v2,true);
    Ammo.destroy(v0); Ammo.destroy(v1); Ammo.destroy(v2);
  }
  const tshape = new Ammo.btBvhTriangleMeshShape(tmesh,true);
  const tr = new Ammo.btTransform(); tr.setIdentity();
  const tbody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(0,new Ammo.btDefaultMotionState(tr),tshape,new Ammo.btVector3(0,0,0)));
  tbody.setFriction(scn.friction); physicsWorld.addRigidBody(tbody);

  addStartLine();
  buildEnvironment(scn, trackCurve, bound, wFn);

  minimapPath = [];
  for (let i=0;i<=140;i++){ const p=trackCurve.getPointAt(i/140); minimapPath.push({x:p.x,z:p.z}); }
  minimapBounds = null;
}

function addRumbleStrips(scn,wFn){
  const rw=1.0, segs=240;
  const mA=new THREE.MeshStandardMaterial({color: scn.name==='Nevasca'?0x2244aa:0xff2222,roughness:0.75});
  const mB=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.75});
  const half=trackWidth/2;
  for (let side=-1;side<=1;side+=2){
    for (let i=0;i<segs;i++){
      const t1=i/segs, t2=(i+1)/segs;
      const p1=trackCurve.getPointAt(t1), p2=trackCurve.getPointAt(t2);
      const tA=trackCurve.getTangentAt(t1).normalize(), tB=trackCurve.getTangentAt(t2).normalize();
      const n1=new THREE.Vector3(-tA.z,0,tA.x).normalize(), n2=new THREE.Vector3(-tB.z,0,tB.x).normalize();
      const i1=wFn?half*wFn(t1)-rw:half-rw, o1=wFn?half*wFn(t1):half;
      const i2=wFn?half*wFn(t2)-rw:half-rw, o2=wFn?half*wFn(t2):half;
      const pos=[
        p1.x+n1.x*side*i1,p1.y+0.15,p1.z+n1.z*side*i1,
        p1.x+n1.x*side*o1,p1.y+0.15,p1.z+n1.z*side*o1,
        p2.x+n2.x*side*i2,p2.y+0.15,p2.z+n2.z*side*i2,
        p2.x+n2.x*side*o2,p2.y+0.15,p2.z+n2.z*side*o2,
      ];
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
      g.setIndex([0,2,1,1,2,3]); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, i%2===0?mA:mB));
    }
  }
}
function addLaneMarkings(scn,wFn){
  const dl=2.2, dg=3.2;
  const dashCount=Math.floor(trackLength/(dl+dg));
  const dg2=new THREE.PlaneGeometry(0.22,dl);
  const dm=new THREE.MeshStandardMaterial({color:scn.name==='Nevasca'?0xffd86b:0xffffff,roughness:0.6,side:THREE.DoubleSide});
  for (let i=0;i<dashCount;i++){
    const t=(i*(dl+dg))/trackLength; const p=trackCurve.getPointAt(t); const tan=trackCurve.getTangentAt(t);
    const dash=new THREE.Mesh(dg2,dm); dash.position.set(p.x,p.y+0.16,p.z);
    const slope=Math.atan2(tan.y,Math.sqrt(tan.x*tan.x+tan.z*tan.z));
    dash.rotation.x=-Math.PI/2+slope; dash.rotation.z=Math.atan2(tan.x,tan.z);
    scene.add(dash);
  }
}
function addSideLines(scn,wFn){
  const m=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.5});
  const w=trackWidth/2-0.4;
  scene.add(new THREE.Mesh(buildRibbon(offsetCurve(trackCurve,w,false,wFn),0.12,800),m));
  scene.add(new THREE.Mesh(buildRibbon(offsetCurve(trackCurve,w,true,wFn),0.12,800),m));
}
function addBarriers(scn,wFn){
  if (scn.name==='Deserto') return;
  const off=trackWidth/2+0.8;
  const col = scn.name==='Nevasca'?0x2a6090:0xc03030;
  const bm=new THREE.MeshStandardMaterial({color:col,roughness:0.6,metalness:0.2,side:THREE.DoubleSide});
  const L=new THREE.Mesh(buildSegmentedBarrier(trackCurve,off,1,0.6,wFn),bm);
  const R=new THREE.Mesh(buildSegmentedBarrier(trackCurve,off,-1,0.6,wFn),bm);
  L.castShadow=R.castShadow=true; L.receiveShadow=R.receiveShadow=true;
  scene.add(L); scene.add(R);
}
function addStartLine(){
  const p=trackCurve.getPointAt(0), tan=trackCurve.getTangentAt(0);
  const cv=document.createElement('canvas'); cv.width=64; cv.height=8;
  const cx=cv.getContext('2d');
  for (let i=0;i<8;i++){cx.fillStyle=i%2?'#fff':'#111'; cx.fillRect(i*8,0,8,8);}
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.BoxGeometry(trackWidth,0.05,2), new THREE.MeshStandardMaterial({map:tex,roughness:0.7}));
  m.position.copy(p); m.position.y+=0.12; m.lookAt(p.clone().add(tan)); scene.add(m);
  for (let side=-1;side<=1;side+=2){
    const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const pp=p.clone().addScaledVector(n,side*(trackWidth/2+1));
    const pillar=new THREE.Mesh(new THREE.BoxGeometry(0.4,4,0.4),new THREE.MeshStandardMaterial({color:0xffffff}));
    pillar.position.set(pp.x,p.y+2,pp.z); pillar.castShadow=true; scene.add(pillar);
  }
}
function computeTrackBounds(curve,extra){
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for (let i=0;i<=200;i++){
    const p=curve.getPointAt(i/200);
    if (p.x<minX) minX=p.x; if (p.x>maxX) maxX=p.x;
    if (p.z<minZ) minZ=p.z; if (p.z>maxZ) maxZ=p.z;
  }
  return {minX:minX-extra,maxX:maxX+extra,minZ:minZ-extra,maxZ:maxZ+extra,cx:(minX+maxX)/2,cz:(minZ+maxZ)/2,sizeX:maxX-minX+extra*2,sizeZ:maxZ-minZ+extra*2};
}

// ======================= ENVIRONMENT =======================
function nearestOnCurve(curve,p){
  let best=Infinity, bestT=0, bestP=null;
  for (let i=0;i<=220;i++){const t=i/220;const q=curve.getPointAt(t);const d=q.distanceTo(p);if(d<best){best=d;bestT=t;bestP=q;}}
  return {dist:best,t:bestT,point:bestP};
}

function buildEnvironment(scn,curve,bound,wFn){
  // Trees/cacti/pines as instanced meshes
  const trunkGeo=new THREE.CylinderGeometry(0.3,0.45,1.5,7);
  const trunkMat=new THREE.MeshStandardMaterial({color:scn.treeTrunk,roughness:0.9});
  let leafGeo,leafMat;
  if (scn.name==='Deserto'){ leafGeo=new THREE.CylinderGeometry(0.55,0.55,3.5,8); leafMat=new THREE.MeshStandardMaterial({color:scn.treeLeaf,roughness:0.8}); }
  else if (scn.name==='Nevasca'){ leafGeo=new THREE.ConeGeometry(1.8,4.5,8); leafMat=new THREE.MeshStandardMaterial({color:scn.treeLeaf,roughness:0.85}); }
  else { leafGeo=new THREE.ConeGeometry(1.7,4.2,8); leafMat=new THREE.MeshStandardMaterial({color:scn.treeLeaf,roughness:0.8}); }

  const n=scn.treeCount;
  const tMesh=new THREE.InstancedMesh(trunkGeo,trunkMat,n);
  const lMesh=new THREE.InstancedMesh(leafGeo,leafMat,n);
  tMesh.castShadow=true; lMesh.castShadow=true; lMesh.receiveShadow=true;
  scene.add(tMesh); scene.add(lMesh);
  let capMesh=null;
  if (scn.name==='Nevasca'){
    const cG=new THREE.ConeGeometry(1.3,1.6,8); const cM=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.5});
    capMesh=new THREE.InstancedMesh(cG,cM,n); capMesh.castShadow=true; scene.add(capMesh);
  }
  const d=new THREE.Object3D();
  let placed=0,attempts=0;
  while (placed<n && attempts<n*10){
    attempts++;
    const x=bound.minX+Math.random()*(bound.maxX-bound.minX), z=bound.minZ+Math.random()*(bound.maxZ-bound.minZ);
    const nr=nearestOnCurve(curve,new THREE.Vector3(x,0,z));
    if (nr.dist<14) continue;
    if (Math.hypot(x-trackStartPos.x,z-trackStartPos.z)<30) continue;
    const scale=scn.treeScaleRange[0]+Math.random()*(scn.treeScaleRange[1]-scn.treeScaleRange[0]);
    const th=1.5*scale;
    d.position.set(x,th/2,z); d.rotation.set(0,Math.random()*Math.PI*2,0); d.scale.set(scale,scale,scale); d.updateMatrix();
    tMesh.setMatrixAt(placed,d.matrix);
    const lh=scn.name==='Deserto'?3.5*scale:(scn.name==='Nevasca'?4.5*scale:4.2*scale);
    d.position.set(x, scn.name==='Deserto'?th+lh/2-0.3:th+lh/2, z); d.updateMatrix(); lMesh.setMatrixAt(placed,d.matrix);
    if (capMesh){ d.position.set(x,th+lh-0.3,z); d.updateMatrix(); capMesh.setMatrixAt(placed,d.matrix); }
    placed++;
  }
  tMesh.count=lMesh.count=placed; tMesh.instanceMatrix.needsUpdate=true; lMesh.instanceMatrix.needsUpdate=true;
  if (capMesh){capMesh.count=placed; capMesh.instanceMatrix.needsUpdate=true;}

  if (scn.lamps){
    const pG=new THREE.CylinderGeometry(0.1,0.15,7,8), pM=new THREE.MeshStandardMaterial({color:0x555,roughness:0.5,metalness:0.8});
    const bG=new THREE.SphereGeometry(0.25,10,10), bM=new THREE.MeshStandardMaterial({color:0xffffcc,emissive:0xffffaa,emissiveIntensity:1.2});
    const pCount=Math.floor(trackLength/35);
    for (let i=0;i<pCount;i++){
      const t=i/pCount; const p=curve.getPointAt(t); const tan=curve.getTangentAt(t);
      const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
      for (let s=-1;s<=1;s+=2){
        const pp=p.clone().addScaledVector(n,s*(trackWidth/2+2.5));
        const pole=new THREE.Mesh(pG,pM); pole.position.set(pp.x,p.y+3.5,pp.z); pole.castShadow=true; scene.add(pole);
        const bulb=new THREE.Mesh(bG,bM); bulb.position.set(pp.x,p.y+7,pp.z); scene.add(bulb);
      }
    }
  }

  if (scn.cones){
    const cG=new THREE.ConeGeometry(0.22,0.65,8), cM=new THREE.MeshStandardMaterial({color:0xff6600,roughness:0.55});
    const cCount=Math.floor(trackLength/14);
    for (let i=0;i<cCount;i++){
      const t=i/cCount; const p=curve.getPointAt(t); const tan=curve.getTangentAt(t);
      const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
      const side=i%2===0?1:-1;
      const w=wFn?(trackWidth/2+1.3)*wFn(t):trackWidth/2+1.3;
      const cp=p.clone().addScaledVector(n,side*w);
      const cone=new THREE.Mesh(cG,cM); cone.position.set(cp.x,p.y+0.4,cp.z); cone.castShadow=true; scene.add(cone);
    }
  }

  if (scn.rocks){
    const rG=new THREE.DodecahedronGeometry(0.45,0), rM=new THREE.MeshStandardMaterial({color:scn.rockColor||0x7a7a7a,roughness:0.95});
    for (let i=0;i<100;i++){
      const t=Math.random(); const p=curve.getPointAt(t); const tan=curve.getTangentAt(t);
      const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
      const side=Math.random()>0.5?1:-1;
      const base=wFn?(trackWidth/2+2)*wFn(t):trackWidth/2+2;
      const dist=base+Math.random()*6;
      const rp=p.clone().addScaledVector(n,side*dist);
      const rock=new THREE.Mesh(rG,rM);
      const s=0.4+Math.random()*1.8;
      rock.position.set(rp.x,p.y+s*0.3,rp.z); rock.scale.set(s,s*0.65,s);
      rock.rotation.set(Math.random(),Math.random(),Math.random()); rock.castShadow=true; scene.add(rock);
    }
  }

  if (scn.name==='Deserto'){
    const dM=new THREE.MeshStandardMaterial({color:0xc8923a,roughness:1});
    for (let i=0;i<45;i++){
      const t=Math.random(); const p=curve.getPointAt(t); const tan=curve.getTangentAt(t);
      const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
      const side=Math.random()>0.5?1:-1; const dist=30+Math.random()*80;
      const dp=p.clone().addScaledVector(n,side*dist);
      const dune=new THREE.Mesh(new THREE.SphereGeometry(10+Math.random()*12,12,8,0,Math.PI*2,0,Math.PI/2),dM);
      dune.position.set(dp.x,-1.5,dp.z); dune.scale.y=0.3+Math.random()*0.2; dune.receiveShadow=true; scene.add(dune);
    }
  }

  if (scn.snowParticles){
    const count=1500;
    const g=new THREE.BufferGeometry(); const pos=new Float32Array(count*3); const vel=new Float32Array(count);
    for (let i=0;i<count;i++){
      pos[i*3]=(Math.random()-0.5)*300; pos[i*3+1]=Math.random()*60-5; pos[i*3+2]=(Math.random()-0.5)*300;
      vel[i]=0.08+Math.random()*0.15;
    }
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    const m=new THREE.PointsMaterial({color:0xffffff,size:0.25,transparent:true,opacity:0.85,depthWrite:false});
    snowParticles=new THREE.Points(g,m); snowParticles.userData.vel=vel; scene.add(snowParticles);
  }
}

// ======================= CAR =======================
function buildCarMesh(colorHex){
  const h=CFG.chassisSize;
  const g=new THREE.Group();
  const bodyMat=new THREE.MeshStandardMaterial({color:colorHex,roughness:0.28,metalness:0.75});
  const body=new THREE.Mesh(new THREE.BoxGeometry(h.x*2,h.y*2,h.z*2),bodyMat); body.castShadow=true; g.add(body);
  const hood=new THREE.Mesh(new THREE.BoxGeometry(h.x*1.9,h.y*0.7,h.z*0.7),bodyMat);
  hood.position.set(0,h.y*0.35,h.z*0.65); hood.castShadow=true; g.add(hood);
  const cabMat=new THREE.MeshStandardMaterial({color:0x111,roughness:0.08,metalness:0.9,transparent:true,opacity:0.65});
  const cab=new THREE.Mesh(new THREE.BoxGeometry(h.x*1.55,h.y*1.1,h.z*1.0),cabMat);
  cab.position.set(0,h.y+h.y*0.35,-h.z*0.05); cab.castShadow=true; g.add(cab);
  const bm=new THREE.MeshStandardMaterial({color:0x222,roughness:0.55}), bg=new THREE.BoxGeometry(h.x*2.1,h.y*0.7,0.3);
  const fb=new THREE.Mesh(bg,bm); fb.position.set(0,-h.y*0.2,h.z+0.15); g.add(fb);
  const rb=new THREE.Mesh(bg,bm); rb.position.set(0,-h.y*0.2,-h.z-0.15); g.add(rb);
  const hlM=new THREE.MeshStandardMaterial({color:0xffffee,emissive:0xffffaa,emissiveIntensity:1.3}), hlG=new THREE.SphereGeometry(0.14,12,12);
  const hlL=new THREE.Mesh(hlG,hlM); hlL.position.set(-h.x*0.7,0,h.z+0.1); g.add(hlL);
  const hlR=new THREE.Mesh(hlG,hlM); hlR.position.set(h.x*0.7,0,h.z+0.1); g.add(hlR);
  // Headlights beams
  const beamL=new THREE.SpotLight(0xfff5d6,1.8,30,Math.PI/7,0.5,1.3); beamL.position.set(-h.x*0.7,0,h.z+0.1);
  beamL.target.position.set(-h.x*0.7,-0.4,h.z+12); g.add(beamL); g.add(beamL.target);
  const beamR=new THREE.SpotLight(0xfff5d6,1.8,30,Math.PI/7,0.5,1.3); beamR.position.set(h.x*0.7,0,h.z+0.1);
  beamR.target.position.set(h.x*0.7,-0.4,h.z+12); g.add(beamR); g.add(beamR.target);
  const tlM=new THREE.MeshStandardMaterial({color:0xff2020,emissive:0xff0000,emissiveIntensity:0.5}), tlG=new THREE.SphereGeometry(0.11,12,12);
  const tlL=new THREE.Mesh(tlG,tlM); tlL.position.set(-h.x*0.7,0,-h.z-0.1); g.add(tlL);
  const tlR=new THREE.Mesh(tlG,tlM); tlR.position.set(h.x*0.7,0,-h.z-0.1); g.add(tlR);
  const spM=new THREE.MeshStandardMaterial({color:0x111,roughness:0.3}), spG=new THREE.BoxGeometry(h.x*1.7,0.08,0.35);
  const sp=new THREE.Mesh(spG,spM); sp.position.set(0,h.y*1.15,-h.z*0.8); g.add(sp);
  const supG=new THREE.BoxGeometry(0.08,0.3,0.08);
  const suL=new THREE.Mesh(supG,spM); suL.position.set(-h.x*0.65,h.y*0.95,-h.z*0.8); g.add(suL);
  const suR=new THREE.Mesh(supG,spM); suR.position.set(h.x*0.65,h.y*0.95,-h.z*0.8); g.add(suR);
  const exG=new THREE.CylinderGeometry(0.08,0.08,0.25,8), exM=new THREE.MeshStandardMaterial({color:0x888,metalness:0.9,roughness:0.3});
  const eL=new THREE.Mesh(exG,exM); eL.rotation.x=Math.PI/2; eL.position.set(-h.x*0.4,-h.y*0.7,-h.z-0.25); g.add(eL);
  const eR=new THREE.Mesh(exG,exM); eR.rotation.x=Math.PI/2; eR.position.set(h.x*0.4,-h.y*0.7,-h.z-0.25); g.add(eR);
  g.userData.tlMat=tlM; g.userData.bodyMat=bodyMat;
  return g;
}

function createVehicle(colorHex, startIdx=0, isPlayer=false, name='Player', skill=0.85){
  const h=CFG.chassisSize;
  const mesh=buildCarMesh(colorHex);
  scene.add(mesh);
  const compound=new Ammo.btCompoundShape();
  const box=new Ammo.btBoxShape(new Ammo.btVector3(h.x,h.y,h.z));
  const ch=new Ammo.btTransform(); ch.setIdentity(); ch.setOrigin(new Ammo.btVector3(0,2.0,0));
  compound.addChildShape(ch,box);

  const col=startIdx%2, row=Math.floor(startIdx/2);
  const startP=trackStartPos.clone();
  const right=new THREE.Vector3(-trackStartDir.z,0,trackStartDir.x).normalize();
  startP.addScaledVector(right,(col===0?-1:1)*2.5);
  startP.addScaledVector(trackStartDir,-row*5-1);

  const st=new Ammo.btTransform(); st.setIdentity();
  st.setOrigin(new Ammo.btVector3(startP.x,startP.y,startP.z));
  const yaw=Math.atan2(trackStartDir.x,trackStartDir.z);
  st.setRotation(new Ammo.btQuaternion(0,Math.sin(yaw/2),0,Math.cos(yaw/2)));

  const ms=new Ammo.btDefaultMotionState(st);
  const li=new Ammo.btVector3(0,0,0);
  compound.calculateLocalInertia(CFG.chassisMass,li);
  const body=new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(CFG.chassisMass,ms,compound,li));
  body.setDamping(0.3,0.95); physicsWorld.addRigidBody(body);

  const tuning=new Ammo.btVehicleTuning();
  const ray=new Ammo.btDefaultVehicleRaycaster(physicsWorld);
  const veh=new Ammo.btRaycastVehicle(tuning,body,ray);
  veh.setCoordinateSystem(0,1,2); physicsWorld.addAction(veh);

  const wd=new Ammo.btVector3(0,-1,0), wa=new Ammo.btVector3(-1,0,0), sr=0.4;
  const tG=new THREE.CylinderGeometry(CFG.wheelRadius,CFG.wheelRadius,CFG.wheelWidth,18);
  const tM=new THREE.MeshStandardMaterial({color:0x111,roughness:0.9});
  const rG=new THREE.CylinderGeometry(CFG.wheelRadius*0.6,CFG.wheelRadius*0.6,CFG.wheelWidth*0.9,12);
  const rM=new THREE.MeshStandardMaterial({color:0xccc,roughness:0.25,metalness:0.85});
  const wPos=[
    {x:-CFG.wheelAxisOffset.x,y:CFG.wheelAxisOffset.y,z:CFG.wheelAxisOffset.z,f:true},
    {x:CFG.wheelAxisOffset.x,y:CFG.wheelAxisOffset.y,z:CFG.wheelAxisOffset.z,f:true},
    {x:-CFG.wheelAxisOffset.x,y:CFG.wheelAxisOffset.y,z:-CFG.wheelAxisOffset.z,f:false},
    {x:CFG.wheelAxisOffset.x,y:CFG.wheelAxisOffset.y,z:-CFG.wheelAxisOffset.z,f:false},
  ];
  const wheels=[];
  wPos.forEach(p=>{
    veh.addWheel(new Ammo.btVector3(p.x,p.y,p.z),wd,wa,sr,CFG.wheelRadius,tuning,p.f);
    const gr=new THREE.Group();
    const tire=new THREE.Mesh(tG,tM); tire.castShadow=true; tire.rotation.z=Math.PI/2; gr.add(tire);
    const rim=new THREE.Mesh(rG,rM); rim.rotation.z=Math.PI/2; gr.add(rim);
    scene.add(gr); wheels.push(gr);
  });
  for (let i=0;i<4;i++){
    const wi=veh.getWheelInfo(i);
    wi.set_m_suspensionStiffness(50); wi.set_m_wheelsDampingRelaxation(8); wi.set_m_wheelsDampingCompression(20);
    wi.set_m_frictionSlip(currentSceneDef.friction*10); wi.set_m_rollInfluence(0.005);
  }

  // Wheel dust particle system (added to scene so it stays in world space)
  const dust = createWheelDust(colorHex, isPlayer);
  const exhaust = createExhaust();

  return {
    mesh, body, vehicle:veh, wheels, color:colorHex, isPlayer, name,
    progress:0, lap:0, lastT:0, finished:false, finishTime:0,
    aiSkill:skill, aiState:{steer:0,accel:0,lookahead:35+Math.random()*10,error:0,errorTimer:0,stuckTimer:0},
    exhaust, dust, ramp:0, startP,
  };
}

// ======================= WORLD PARTICLES =======================
// Generic world-space particle system using Points (add to scene, not to car)
function createWorldPointSystem(count, color, size, maxLife){
  const geo=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3);
  const col=new Float32Array(count*3);
  const sizes=new Float32Array(count);
  const c=new THREE.Color(color);
  for (let i=0;i<count;i++){
    pos[i*3]=0;pos[i*3+1]=-999;pos[i*3+2]=0;
    col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;
    sizes[i]=0;
  }
  geo.setAttribute('position',new THREE.BufferAttribute(pos,3));
  geo.setAttribute('color',new THREE.BufferAttribute(col,3));
  const mat=new THREE.PointsMaterial({size,transparent:true,opacity:0.6,depthWrite:false,vertexColors:true,sizeAttenuation:true});
  const pts=new THREE.Points(geo,mat);
  scene.add(pts);
  const data = new Array(count).fill(null).map(()=>({life:1,maxLife:1,vx:0,vy:0,vz:0,size:0}));
  return { mesh:pts, geo, mat, pos, col, data, index:0, count, maxLife };
}

function emitParticle(sys,wx,wy,wz,vx,vy,vz,size,color){
  const i=sys.index; sys.index=(sys.index+1)%sys.count;
  const p=sys.data[i];
  p.life=0; p.maxLife=sys.maxLife*(0.7+Math.random()*0.6);
  p.vx=vx; p.vy=vy; p.vz=vz; p.size=size;
  sys.pos[i*3]=wx; sys.pos[i*3+1]=wy; sys.pos[i*3+2]=wz;
  if (color){
    const c=new THREE.Color(color);
    sys.col[i*3]=c.r; sys.col[i*3+1]=c.g; sys.col[i*3+2]=c.b;
  }
}

function updateWorldParticles(sys,dt,gravity){
  const {pos,data}=sys;
  for (let i=0;i<sys.count;i++){
    const p=data[i];
    if (p.life>=p.maxLife){ pos[i*3+1]=-999; continue; }
    p.life+=dt;
    pos[i*3]+=p.vx*dt; pos[i*3+1]+=p.vy*dt; pos[i*3+2]+=p.vz*dt;
    p.vy += gravity*dt;
    p.vx*=0.96; p.vz*=0.96;
  }
  sys.geo.attributes.position.needsUpdate=true;
  const alpha = 1 - (performance.now()*0.001%1); // no-op; we fade per-point via life? simpler: keep uniform
  sys.mat.opacity = 0.55;
}

let exhaustSys = null, dustSys = null, nitroFlameSys = null;

function createExhaust(){
  if (!exhaustSys) exhaustSys = createWorldPointSystem(200, 0xeeeeee, 0.35, 0.8);
  return exhaustSys;
}
function createWheelDust(carColor, isPlayer){
  if (!dustSys) {
    const col = currentSceneDef.dustColor || 0xffffff;
    dustSys = createWorldPointSystem(400, col, 0.3, 1.2);
    dustSys.maxLife = currentSceneDef.name==='Nevasca'?1.5:1.0;
  }
  return dustSys;
}
function getNitroSys(){
  if (!nitroFlameSys) nitroFlameSys = createWorldPointSystem(250, 0x44aaff, 0.4, 0.4);
  return nitroFlameSys;
}

// ======================= PLAYER CONTROL =======================
function initInput(){
  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    if (k==='w'||k==='arrowup') keys.w=true;
    if (k==='s'||k==='arrowdown') keys.s=true;
    if (k==='a'||k==='arrowleft') keys.a=true;
    if (k==='d'||k==='arrowright') keys.d=true;
    if (e.code==='Space'){keys.space=true;e.preventDefault();}
    if (e.code==='ShiftLeft'||e.code==='ShiftRight') keys.shift=true;
    if (k==='r') keys.r=true;
    if (k==='c') keys.c=true;
    if (k==='escape') keys.escape=true;
  });
  window.addEventListener('keyup', e=>{
    const k=e.key.toLowerCase();
    if (k==='w'||k==='arrowup') keys.w=false;
    if (k==='s'||k==='arrowdown') keys.s=false;
    if (k==='a'||k==='arrowleft') keys.a=false;
    if (k==='d'||k==='arrowright') keys.d=false;
    if (e.code==='Space') keys.space=false;
    if (e.code==='ShiftLeft'||e.code==='ShiftRight') keys.shift=false;
    if (k==='r') keys.r=false;
    if (k==='c') keys.c=false;
    if (k==='escape') keys.escape=false;
  });
}

function updatePlayerVehicle(dt){
  if (keys.r && raceState==='racing') resetVehicle(playerVehicle,false);
  cameraToggleCooldown=Math.max(0,cameraToggleCooldown-dt);
  escapeCooldown=Math.max(0,escapeCooldown-dt);
  if (keys.c && cameraToggleCooldown<=0){ camMode=(camMode+1)%3; cameraToggleCooldown=0.3; }
  if (keys.escape && escapeCooldown<=0 && raceState==='racing'){ togglePause(); escapeCooldown=0.3; }

  if (paused){
    applyBrakes(playerVehicle, 0);
    playerVehicle.vehicle.applyEngineForce(0,2); playerVehicle.vehicle.applyEngineForce(0,3);
    return;
  }
  if (!controlsEnabled || raceState!=='racing'){
    applyBrakes(playerVehicle, CFG.brakingForce*0.5); playerVehicle.ramp=0; return;
  }
  const v=playerVehicle;
  const vel=v.body.getLinearVelocity();
  const speedMs=Math.hypot(vel.x(),vel.y(),vel.z());
  const speedKmh=speedMs*3.6;

  nitroActive = nitroEnabled && keys.shift && nitro>0 && keys.w;
  if (nitroActive) nitro=Math.max(0,nitro-CFG.nitroDrainRate*dt);
  else nitro=Math.min(CFG.maxNitro,nitro+CFG.nitroRegenRate*dt);
  updateNitroBar();

  let engine=0, brake=0;
  const maxE = nitroActive?CFG.nitroForce:CFG.engineForce;
  if (keys.w){
    const ramp = speedKmh<30?1:speedKmh<80?1.5:speedKmh<130?2:2.4;
    v.ramp += (ramp-v.ramp)*(nitroActive?0.04:0.018);
    engine = maxE*v.ramp;
    if (speedMs<0.3){
      v.body.activate();
      const fwd=new THREE.Vector3(0,0,1).applyQuaternion(v.mesh.quaternion);
      const im=new Ammo.btVector3(fwd.x*25,0,fwd.z*25); v.body.applyCentralImpulse(im); Ammo.destroy(im);
    }
  } else v.ramp=Math.max(0,v.ramp-0.04);

  if (keys.s){
    if (speedKmh>5) brake=CFG.brakingForce*0.6;
    else engine=-CFG.engineForce*0.55;
  }
  v.vehicle.applyEngineForce(engine,2); v.vehicle.applyEngineForce(engine,3);

  if (speedMs>1){
    const df=speedMs*speedMs*8+(nitroActive?1800:0);
    const f=new Ammo.btVector3(0,-df,0); v.body.applyCentralForce(f); Ammo.destroy(f);
  }
  let target=0;
  if (keys.a) target=CFG.maxSteer;
  if (keys.d) target=-CFG.maxSteer;
  currentSteer+=(target-currentSteer)*CFG.steerSpeed;
  v.vehicle.setSteeringValue(currentSteer,0); v.vehicle.setSteeringValue(currentSteer,1);

  if (keys.space){ brake=CFG.brakingForce; if (speedKmh>20) spawnSkid(v); }
  v.vehicle.setBrake(brake,0);v.vehicle.setBrake(brake,1);v.vehicle.setBrake(brake*0.35,2);v.vehicle.setBrake(brake*0.35,3);

  const tl=v.mesh.userData.tlMat; if (tl) tl.emissiveIntensity=keys.space?2.2:0.5;

  const lv=getLocalVelocity(v);
  const drifting = Math.abs(lv.x)>4 && speedKmh>25;
  if (drifting) spawnSkid(v);

  // Engine sound
  updateEngineSound(speedKmh, keys.w && !keys.s, keys.space);

  // Exhaust
  emitExhaustFx(v, speedKmh, drifting);
  // Wheel dust
  emitWheelDust(v, speedKmh, drifting || keys.space);
  // Nitro flames
  if (nitroActive) emitNitroFlames(v);
  // Speed lines
  updateSpeedLines(speedKmh);
}

function applyBrakes(v,f){
  for (let i=0;i<4;i++) v.vehicle.setBrake(f,i);
  v.vehicle.applyEngineForce(0,2); v.vehicle.applyEngineForce(0,3);
}
function getLocalVelocity(v){
  const vel=v.body.getLinearVelocity();
  const wv=new THREE.Vector3(vel.x(),vel.y(),vel.z());
  return wv.applyQuaternion(v.mesh.quaternion.clone().invert());
}

// ======================= AI =======================
function updateAI(dt){
  if (!aiEnabled) return;
  for (const v of vehicles){
    if (v.isPlayer||v.finished) continue;
    if (paused||!controlsEnabled||raceState!=='racing'){applyBrakes(v,CFG.brakingForce*0.4); v.aiState.accel=0; continue;}
    const ai=v.aiState;
    ai.errorTimer-=dt;
    if (ai.errorTimer<=0){ai.error=(Math.random()-0.5)*(1-v.aiSkill)*1.2; ai.errorTimer=0.4+Math.random()*0.7;}
    const aheadT=(v.progress+(ai.lookahead+Math.random()*4)/trackLength)%1;
    const ahead=trackCurve.getPointAt(aheadT);
    const here=v.mesh.position;
    const to=new THREE.Vector3().subVectors(ahead,here); to.y=0; to.normalize();
    const fwd=new THREE.Vector3(0,0,1).applyQuaternion(v.mesh.quaternion);
    let ang=Math.atan2(to.x,to.z)-Math.atan2(fwd.x,fwd.z);
    while (ang>Math.PI) ang-=Math.PI*2; while (ang<-Math.PI) ang+=Math.PI*2;
    ang+=ai.error;
    let steer=0;
    if (ang>0.05) steer=Math.min(CFG.maxSteer,ang*2.2);
    else if (ang<-0.05) steer=Math.max(-CFG.maxSteer,ang*2.2);
    v.vehicle.setSteeringValue(steer,0); v.vehicle.setSteeringValue(steer,1);

    const vel=v.body.getLinearVelocity();
    const speedMs=Math.hypot(vel.x(),vel.y(),vel.z());
    const speedKmh=speedMs*3.6;
    const sharp=Math.abs(ang);
    const target=Math.max(40,160-sharp*120)*v.aiSkill;
    let engine=0, brake=0;
    if (speedKmh<target-5){engine=CFG.engineForce*(1+(target-speedKmh)/80); ai.accel=Math.min(1,(target-speedKmh)/60);}
    else if (speedKmh>target+10){brake=CFG.brakingForce*0.4; ai.accel=0;}
    else {engine=CFG.engineForce*0.4; ai.accel=0.3;}
    v.vehicle.applyEngineForce(engine,2); v.vehicle.applyEngineForce(engine,3);
    v.vehicle.setBrake(brake,0);v.vehicle.setBrake(brake,1);v.vehicle.setBrake(brake*0.3,2);v.vehicle.setBrake(brake*0.3,3);

    const lv=getLocalVelocity(v);
    if (Math.abs(lv.x)>4 && speedKmh>28) spawnSkid(v);
    if (speedMs>1){const df=speedMs*speedMs*8; const f=new Ammo.btVector3(0,-df,0); v.body.applyCentralForce(f); Ammo.destroy(f);}

    emitExhaustFx(v, speedKmh, Math.abs(lv.x)>3);
    if (Math.abs(lv.x)>3 || ai.accel>0.7) emitWheelDust(v, speedKmh, Math.abs(lv.x)>3);

    ai.stuckTimer=(ai.stuckTimer||0)+dt;
    const up=new THREE.Vector3(0,1,0).applyQuaternion(v.mesh.quaternion);
    const gs=Math.hypot(lv.x,lv.z);
    if (up.y<0.3||v.mesh.position.y<-10){resetVehicle(v,false);ai.stuckTimer=0;}
    else if (ai.stuckTimer>2.5 && gs<1.5){resetVehicle(v,false);ai.stuckTimer=0;}
  }
}

function resetVehicle(v, full){
  const sp=v.startP;
  const t=new Ammo.btTransform(); t.setIdentity();
  t.setOrigin(new Ammo.btVector3(sp.x,sp.y,sp.z));
  const yaw=Math.atan2(trackStartDir.x,trackStartDir.z);
  t.setRotation(new Ammo.btQuaternion(0,Math.sin(yaw/2),0,Math.cos(yaw/2)));
  v.body.setWorldTransform(t);
  v.body.setLinearVelocity(new Ammo.btVector3(0,0,0));
  v.body.setAngularVelocity(new Ammo.btVector3(0,0,0));
  v.body.activate();
  v.progress=0;v.lastT=0;v.lap=0;v.ramp=0;
  if (full){v.finished=false;v.finishTime=0;}
}

// ======================= FX =======================
function emitExhaustFx(v, speedKmh, drifting){
  if (!exhaustSys) return;
  let intensity=0;
  if (v.isPlayer){
    if (keys.w) intensity=Math.min(1,speedKmh/80+(nitroActive?0.6:0));
    if (keys.s) intensity=Math.max(intensity,0.3);
  } else intensity=Math.min(1,v.aiState.accel);
  intensity = Math.min(1, intensity);
  if (intensity<0.1 || v.finished) return;
  if (nitroActive && v.isPlayer) return; // replaced by nitro flames
  const h=CFG.chassisSize;
  const back = new THREE.Vector3(0, 0.05, -1).applyQuaternion(v.mesh.quaternion);
  const basePos = v.mesh.position.clone();
  // Emit from two exhaust pipes (local offsets ~ (-0.4, -0.35, -2.6) in car frame)
  for (const side of [-1, 1]) {
    const local = new THREE.Vector3(side*h.x*0.4, -h.y*0.3, -h.z-0.3).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
    const col = currentSceneDef.name==='Nevasca'?(drifting?0xffffff:0xcccccc):(speedKmh>120?0x555555:0xdddddd);
    emitParticle(exhaustSys, local.x, local.y, local.z,
      back.x*(3+Math.random()*3)+(Math.random()-0.5)*1,
      back.y*2+0.5+Math.random(),
      back.z*(3+Math.random()*3)+(Math.random()-0.5)*1,
      0.2+Math.random()*0.25, col);
  }
}
function emitWheelDust(v, speedKmh, hard){
  if (!dustSys) return;
  if (speedKmh<15||v.finished) return;
  const scn=currentSceneDef;
  if (scn.name==='Floresta' && !hard) return;
  const intensity = hard ? 2 : (scn.name==='Deserto'?1:0.4);
  const q=v.mesh.quaternion;
  for (let wi=2; wi<=3; wi++){
    const wp=v.wheels[wi].position;
    for (let k=0;k<intensity;k++){
      const side = (Math.random()-0.5)*0.8;
      const up = 0.5+Math.random()*0.8;
      const back = -1-Math.random()*1.5;
      const dir=new THREE.Vector3(side,up,back).applyQuaternion(q);
      emitParticle(dustSys, wp.x+(Math.random()-0.5)*0.3, wp.y+0.1, wp.z+(Math.random()-0.5)*0.3,
        dir.x*(3+Math.random()*3)*0.5, dir.y*2, dir.z*(3+Math.random()*3)*0.5,
        0.25+Math.random()*0.3);
    }
  }
}
function emitNitroFlames(v){
  const s=getNitroSys();
  const h=CFG.chassisSize;
  const back = new THREE.Vector3(0, 0.05, -1).applyQuaternion(v.mesh.quaternion);
  for (const side of [-1,1]){
    const local = new THREE.Vector3(side*h.x*0.4, -h.y*0.25, -h.z-0.35).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
    const col = Math.random()<0.5?0x00e5ff:0xff6a00;
    emitParticle(s, local.x, local.y, local.z,
      back.x*6+(Math.random()-0.5)*2, back.y*2+Math.random()*1.5, back.z*10+Math.random()*5,
      0.35+Math.random()*0.3, col);
  }
}
function updateSpeedLines(speedKmh){
  if (!speedLines) return;
  const intensity = Math.max(0,(speedKmh-80)/120);
  const seg = speedLines.userData.data;
  const pos = speedLines.geometry.attributes.position.array;
  // Add new segments when going fast
  for (let i=0;i<speedLines.userData.segCount;i++){
    const p=seg[i];
    if (p.life<p.maxLife){
      p.life += 0.016;
      const i6=i*6;
      // stretch from first point forward
      pos[i6+3] = pos[i6]+(pos[i6]-pos[i6+3])*0.5; // trailing
      pos[i6+4] = pos[i6+1]+(pos[i6+1]-pos[i6+4])*0.5;
      pos[i6+5] = pos[i6+2]+(pos[i6+2]-pos[i6+5])*0.5;
      // fade by moving off? simpler: reduce opacity via alpha when life ends
      if (p.life>=p.maxLife){ pos[i6+1]=-999; pos[i6+4]=-999; }
      continue;
    }
    if (Math.random()<intensity*0.5){
      p.life=0; p.maxLife=0.25+Math.random()*0.3;
      const angle=(Math.random()-0.5)*0.6;
      const spread=10;
      const i6=i*6;
      // Start point in front of camera
      pos[i6]=(Math.random()-0.5)*spread;
      pos[i6+1]=(Math.random()-0.5)*6;
      pos[i6+2]=-5-Math.random()*5;
      pos[i6+3]=pos[i6]+Math.sin(angle)*2;
      pos[i6+4]=pos[i6+1];
      pos[i6+5]=pos[i6+2]-6-Math.random()*3;
    }
  }
  speedLines.geometry.attributes.position.needsUpdate=true;
  speedLines.material.opacity = Math.min(0.8, intensity*0.8);
}

// ======================= SYNC / CAMERA =======================
function syncVehicle(v){
  const wt=v.vehicle.getChassisWorldTransform();
  const o=wt.getOrigin(), r=wt.getRotation();
  v.mesh.position.set(o.x(),o.y(),o.z()); v.mesh.quaternion.set(r.x(),r.y(),r.z(),r.w());
  for (let i=0;i<4;i++){
    v.vehicle.updateWheelTransform(i,true);
    const w=v.vehicle.getWheelTransformWS(i);
    const wo=w.getOrigin(), wr=w.getRotation();
    v.wheels[i].position.set(wo.x(),wo.y(),wo.z()); v.wheels[i].quaternion.set(wr.x(),wr.y(),wr.z(),wr.w());
  }
}

const _camOff=new THREE.Vector3(), _camDes=new THREE.Vector3(), _camLook=new THREE.Vector3();
let _camShake=0;
function updateCamera(dt){
  const v=playerVehicle;
  const vel=v.body.getLinearVelocity();
  const speedMs=Math.hypot(vel.x(),vel.y(),vel.z());
  const speedKmh=speedMs*3.6;
  let dist,height,fov,lerp;
  if (camMode===1){dist=1.8;height=1.4;fov=78;lerp=0.3;}
  else if (camMode===2){dist=CFG.cameraDistance*1.7+Math.min(speedKmh*0.05,7); height=CFG.cameraHeight*1.5+Math.min(speedKmh*0.01,1.5); fov=55; lerp=0.1;}
  else {dist=CFG.cameraDistance+Math.min(speedKmh*0.04,6); height=CFG.cameraHeight+Math.min(speedKmh*0.01,1.3); fov=60+Math.min(speedKmh*0.08,14); lerp=0.12;}
  camera.fov+=(fov-camera.fov)*0.08; camera.updateProjectionMatrix();
  _camOff.set(0,height,camMode===1?dist:-dist);
  _camOff.applyQuaternion(v.mesh.quaternion);
  _camDes.copy(v.mesh.position).add(_camOff);
  if (speedKmh>110||keys.space||nitroActive) _camShake=Math.min(_camShake+dt*3, nitroActive?2:1);
  else _camShake=Math.max(_camShake-dt*3,0);
  if (_camShake>0){
    _camDes.x+=(Math.random()-0.5)*0.18*_camShake;
    _camDes.y+=(Math.random()-0.5)*0.12*_camShake;
  }
  camera.position.lerp(_camDes,lerp);
  if (camMode===1) _camLook.set(0,0.5,25).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
  else _camLook.set(0,0.7,dist*0.4).applyQuaternion(v.mesh.quaternion).add(v.mesh.position);
  camera.lookAt(_camLook);
}

// ======================= LAP / RACE =======================
function updateProgress(v){ const nr=nearestOnCurve(trackCurve,v.mesh.position); v.progress=nr.t; }
function checkLaps(){
  if (raceState!=='racing') return;
  checkVehicleLap(playerVehicle);
  for (const v of vehicles) if (!v.isPlayer) checkVehicleLap(v);
}
function checkVehicleLap(v){
  if (v.finished) return;
  const t=v.progress;
  if (v.lastT>0.88 && t<0.12){
    v.lap++;
    if (v.isPlayer){
      const lm=performance.now()-lapStartTime;
      if (bestLapMs==null||lm<bestLapMs) bestLapMs=lm;
      raceAccumMs+=lm; lap++; lapStartTime=performance.now();
      beep(880,0.15,0.15);
      if (lap>=CFG.raceLaps) finishRace();
    } else if (v.lap>=CFG.raceLaps){
      v.finished=true; v.finishTime=raceAccumMs+(performance.now()-lapStartTime);
    }
  }
  v.lastT=t;
}
function finishRace(){
  raceState='finished'; controlsEnabled=false; totalRaceMs=raceAccumMs;
  playerVehicle.finished=true; playerVehicle.finishTime=totalRaceMs;
  const sorted=standings();
  const el=document.getElementById('race-results'); let html='';
  sorted.forEach((v,i)=>{
    const cls=v.isPlayer?'you':(i===0?'pos1':'');
    const medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':`${i+1}.`;
    const time=v.finishTime>0?formatTime(v.finishTime):'na pista';
    html+=`<div class="${cls}">${medal} ${v.name} · ${time}</div>`;
  });
  html+=`<hr style="margin:0.8rem 0;border:0;border-top:1px solid var(--line);">`;
  html+=`<div>Melhor volta: <b>${formatTime(bestLapMs)}</b></div>`;
  html+=`<div>Tempo total: <b>${formatTime(totalRaceMs)}</b></div>`;
  el.innerHTML=html;
  document.getElementById('finish').hidden=false;
  if (engineGain) engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
}
function standings(){
  return vehicles.slice().sort((a,b)=>{
    if (a.lap!==b.lap) return b.lap-a.lap;
    if (a.finished&&b.finished) return a.finishTime-b.finishTime;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.progress-a.progress;
  });
}
function formatTime(ms){
  if (ms==null||!Number.isFinite(ms)) return '—';
  const t=Math.max(0,ms);
  const m=Math.floor(t/60000), s=Math.floor((t%60000)/1000), mp=Math.floor(t%1000);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(mp).padStart(3,'0')}`;
}

// ======================= HUD =======================
function updateHUD(){
  if (raceState==='menu') return;
  const v=playerVehicle;
  const vel=v.body.getLinearVelocity();
  const skm=Math.round(Math.hypot(vel.x(),vel.y(),vel.z())*3.6);
  document.getElementById('speed').innerHTML=`${skm}<span>km/h</span>`;
  document.getElementById('lap').textContent=`Volta ${Math.min(lap+1,CFG.raceLaps)} / ${CFG.raceLaps}`;
  if (raceState==='racing') document.getElementById('lap-time').textContent=formatTime(performance.now()-lapStartTime);
  document.getElementById('best-time').textContent=bestLapMs!=null?`Melhor ${formatTime(bestLapMs)}`:'Melhor —';
  const st=standings(); const p=st.indexOf(playerVehicle)+1;
  document.getElementById('position-info').textContent=`Posição: ${p}/${vehicles.length}`;
  document.getElementById('pause-overlay') && (document.getElementById('pause-overlay').hidden = !paused);
}
function updateNitroBar(){
  const bar=document.getElementById('nitro-bar');
  if (!nitroEnabled){bar.style.width='0%';bar.parentElement.style.display='none';return;}
  bar.parentElement.style.display=''; bar.style.width=`${nitro}%`; bar.classList.toggle('active',nitroActive);
}
function updateMinimap(){
  if (!minimapPath||!playerVehicle) return;
  const cv=document.getElementById('minimap'), ctx=cv.getContext('2d');
  const w=cv.width, h=cv.height, pad=18;
  if (!minimapBounds){
    const mnx=Math.min(...minimapPath.map(p=>p.x)), mxx=Math.max(...minimapPath.map(p=>p.x));
    const mnz=Math.min(...minimapPath.map(p=>p.z)), mxz=Math.max(...minimapPath.map(p=>p.z));
    const sc=Math.min((w-pad*2)/(mxx-mnx||1),(h-pad*2)/(mxz-mnz||1));
    minimapBounds={minX:mnx,minZ:mnz,scale:sc,offsetX:(w-(mxx-mnx)*sc)/2,offsetZ:(h-(mxz-mnz)*sc)/2};
  }
  const b=minimapBounds;
  ctx.fillStyle='rgba(6,12,9,0.88)'; ctx.fillRect(0,0,w,h);
  ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=2.5; ctx.beginPath();
  minimapPath.forEach((p,i)=>{const x=(p.x-b.minX)*b.scale+b.offsetX,y=(p.z-b.minZ)*b.scale+b.offsetZ;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle='rgba(232,93,4,0.5)'; ctx.lineWidth=6; ctx.beginPath();
  let started=false;
  minimapPath.forEach((p,i)=>{if(i/(minimapPath.length-1)>playerVehicle.progress)return; const x=(p.x-b.minX)*b.scale+b.offsetX,y=(p.z-b.minZ)*b.scale+b.offsetZ;if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);});
  ctx.stroke();
  for (const v of vehicles){
    const x=(v.mesh.position.x-b.minX)*b.scale+b.offsetX, y=(v.mesh.position.z-b.minZ)*b.scale+b.offsetZ;
    ctx.fillStyle=v.isPlayer?'#e85d04':'#'+new THREE.Color(v.color).getHexString();
    ctx.beginPath(); ctx.arc(x,y,v.isPlayer?5:4,0,Math.PI*2); ctx.fill();
    if (v.isPlayer){
      const d=new THREE.Vector3(0,0,1).applyQuaternion(v.mesh.quaternion);
      const a=Math.atan2(d.x,d.z);
      ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+Math.sin(a)*10,y+Math.cos(a)*10); ctx.stroke();
    }
  }
}

// ======================= COUNTDOWN =======================
function showCountdown(txt,go){const el=document.getElementById('countdown');el.hidden=false;el.textContent=txt;el.classList.toggle('go',!!go);el.style.animation='none';void el.offsetWidth;el.style.animation='';}
function hideCountdown(){document.getElementById('countdown').hidden=true;}
function startCountdown(){
  raceState='countdown'; controlsEnabled=false; countdownValue=3; countdownTimer=1;
  showCountdown('3');
  for (const v of vehicles) resetVehicle(v,true);
  lap=0; bestLapMs=null; raceAccumMs=0; nitro=CFG.maxNitro;
  document.getElementById('scene-name-hud').textContent=currentSceneDef.name;
  if (audioCtx && audioCtx.state==='suspended') audioCtx.resume();
  beep(440,0.2,0.2);
}
function updateCountdown(dt){
  if (raceState!=='countdown') return;
  countdownTimer-=dt; if (countdownTimer>0) return;
  countdownValue--;
  if (countdownValue>0){showCountdown(String(countdownValue)); countdownTimer=1; beep(440,0.15,0.15);}
  else if (countdownValue===0){
    showCountdown('GO!',true); raceState='racing'; controlsEnabled=true;
    lapStartTime=performance.now(); countdownTimer=0.5; beep(880,0.3,0.25);
    setTimeout(hideCountdown,700);
  } else hideCountdown();
}
function togglePause(){
  paused = !paused;
  if (paused){
    showPause();
    if (engineGain) engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
  } else {
    hidePause();
  }
}
function showPause(){
  let ov=document.getElementById('pause-overlay');
  if (!ov){
    ov=document.createElement('div');
    ov.id='pause-overlay';
    ov.style.cssText='position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);font-family:Oswald,sans-serif;color:#fff;font-size:3rem;letter-spacing:0.3em;text-transform:uppercase;';
    ov.innerHTML='PAUSADO <div style="font-size:1rem;letter-spacing:0.2em;margin-top:1rem;opacity:0.7;font-family:IBM Plex Mono,monospace;">ESC para continuar</div>';
    document.body.appendChild(ov);
  } else ov.hidden=false;
}
function hidePause(){const ov=document.getElementById('pause-overlay'); if(ov) ov.hidden=true;}

// ======================= MAIN LOOP =======================
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),1/30);
  updateCountdown(dt);
  updatePlayerVehicle(dt);
  updateAI(dt);
  physicsWorld.stepSimulation(dt,4,1/120);
  for (const v of vehicles){
    v.vehicle.updateVehicle(dt);
    syncVehicle(v); updateProgress(v);
    if (v.mesh.position.y<-20 && raceState==='racing' && !paused) resetVehicle(v,false);
  }
  frameProgress=playerVehicle.progress;
  checkLaps();
  updateCamera(dt);
  updateHUD();
  updateMinimap();
  // Particles
  updateSkids(dt);
  if (exhaustSys) updateWorldParticles(exhaustSys, dt, 1.5);
  if (dustSys) updateWorldParticles(dustSys, dt, -2);
  if (nitroFlameSys) updateWorldParticles(nitroFlameSys, dt, -1);
  updateSnow(dt);
  // Sun follow
  if (sun && playerVehicle){
    const tx=playerVehicle.mesh.position.x, tz=playerVehicle.mesh.position.z;
    sun.target.position.set(tx,0,tz); sun.position.set(tx+80,playerVehicle.mesh.position.y+110,tz+50);
    sun.target.updateMatrixWorld();
  }
  renderer.render(scene,camera);
}

function updateSnow(dt){
  if (!snowParticles) return;
  const pos=snowParticles.geometry.attributes.position.array;
  const vel=snowParticles.userData.vel;
  const cx=playerVehicle.mesh.position.x, cz=playerVehicle.mesh.position.z;
  for (let i=0;i<pos.length/3;i++){
    pos[i*3+1]-=vel[i]*60*dt;
    pos[i*3]+=Math.sin(performance.now()*0.001+i)*0.02;
    if (pos[i*3+1]<-2){pos[i*3]=cx+(Math.random()-0.5)*200; pos[i*3+1]=40+Math.random()*20; pos[i*3+2]=cz+(Math.random()-0.5)*200;}
  }
  snowParticles.geometry.attributes.position.needsUpdate=true;
}

// ======================= SKID MARKS =======================
function spawnSkid(carData){
  if (skidCooldown>0) return;
  skidCooldown=0.04;
  const fwd=new THREE.Vector3(0,0,1).applyQuaternion(carData.mesh.quaternion);
  const yaw=Math.atan2(fwd.x,fwd.z);
  for (const pos of [carData.wheels[2]?.position, carData.wheels[3]?.position]){
    if (!pos) continue;
    const mark=new THREE.Mesh(skidGeo,skidMat.clone());
    mark.position.set(pos.x,0.17,pos.z); mark.rotation.x=-Math.PI/2; mark.rotation.z=yaw;
    mark.material.opacity=currentSceneDef.name==='Nevasca'?0.22:0.5;
    scene.add(mark); skidMarks.push({mesh:mark,life:5});
    if (skidMarks.length>MAX_SKIDS){const old=skidMarks.shift();scene.remove(old.mesh);old.mesh.material.dispose();}
  }
}
function updateSkids(dt){
  skidCooldown=Math.max(0,skidCooldown-dt);
  for (let i=skidMarks.length-1;i>=0;i--){
    const s=skidMarks[i]; s.life-=dt;
    s.mesh.material.opacity=Math.max(0,s.life/5*0.42);
    if (s.life<=0){scene.remove(s.mesh);s.mesh.material.dispose();skidMarks.splice(i,1);}
  }
}

// ======================= SETUP / MENU =======================
let ammoLoaded=false;
function clearScene(){
  while (scene.children.length>0){
    const o=scene.children[0]; scene.remove(o);
    if (o.geometry) o.geometry.dispose&&o.geometry.dispose();
    if (o.material){
      if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose&&o.material.dispose();
    }
  }
  vehicles=[]; playerVehicle=null; snowParticles=null; skidMarks.length=0;
  exhaustSys=null; dustSys=null; nitroFlameSys=null;
}
function setupRace(){
  clearScene();
  currentSceneDef=SCENES[selectedScene];
  buildSky(currentSceneDef); buildTrack(currentSceneDef);
  // Recreate dust system color based on scene
  dustSys = createWorldPointSystem(400, currentSceneDef.dustColor||0xffffff, 0.3, currentSceneDef.name==='Nevasca'?1.4:1.0);
  playerVehicle = createVehicle(selectedCarColor,0,true,'Você',1.0);
  vehicles.push(playerVehicle);
  if (aiEnabled){
    const aiColors=[0x9c27b0,0xff9800,0x00bcd4], aiNames=['Rocket','Flash','Shadow'], skills=[0.82,0.88,0.93];
    for (let i=0;i<3;i++) vehicles.push(createVehicle(aiColors[i],i+1,false,aiNames[i],skills[i]));
  }
  currentSteer=0; camMode=0; paused=false;
}
function waitForAmmo(){
  return new Promise(res=>{
    const t=performance.now();
    (function chk(){
      if (typeof window.Ammo==='function') return res();
      if (performance.now()-t>30000) return res(new Error('Ammo não carregou'));
      setTimeout(chk,30);
    })();
  });
}
function bindMenu(){
  document.querySelectorAll('.scene-option').forEach(o=>{
    o.addEventListener('click',()=>{
      document.querySelectorAll('.scene-option').forEach(x=>x.classList.remove('selected'));
      o.classList.add('selected'); selectedScene=o.dataset.scene; tryStart();
    });
  });
  document.querySelectorAll('.car-option').forEach(o=>{
    o.addEventListener('click',()=>{
      document.querySelectorAll('.car-option').forEach(x=>x.classList.remove('selected'));
      o.classList.add('selected'); selectedCarColor=parseInt(o.dataset.color); tryStart();
    });
  });
  document.getElementById('opt-ai').addEventListener('change',e=>aiEnabled=e.target.checked);
  document.getElementById('opt-nitro').addEventListener('change',e=>nitroEnabled=e.target.checked);
  document.getElementById('start-btn').addEventListener('click',()=>{
    document.getElementById('menu').hidden=true; document.getElementById('hud').hidden=false; document.getElementById('finish').hidden=true;
    setupRace(); startCountdown(); animate();
  });
  document.getElementById('restart-btn').addEventListener('click',()=>{
    document.getElementById('finish').hidden=true; setupRace(); startCountdown();
  });
  document.getElementById('menu-btn').addEventListener('click',()=>{
    document.getElementById('finish').hidden=true; document.getElementById('hud').hidden=true; document.getElementById('menu').hidden=false;
    raceState='menu'; controlsEnabled=false; paused=false; hidePause();
    if (engineGain) engineGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
  });
}
function tryStart(){document.getElementById('start-btn').disabled=!(ammoLoaded&&selectedScene&&selectedCarColor);}

async function main(){
  bindMenu();
  const err=await waitForAmmo();
  if (err instanceof Error) throw err;
  await window.Ammo(); Ammo=window.Ammo;
  initThree(); initPhysics(); initInput();
  ammoLoaded=true;
  document.querySelector('.scene-option[data-scene="forest"]').classList.add('selected');
  document.querySelector('.car-option[data-color="0xd62828"]').classList.add('selected');
  selectedScene='forest'; selectedCarColor=0xd62828;
  tryStart();
}

main().catch(err=>{
  console.error('Falha ao iniciar:', err);
  const hint=document.querySelector('.menu-hint');
  if (hint){hint.textContent='Erro ao carregar Ammo.js. Execute: python3 -m http.server 8000';hint.style.color='#ff6b4a';}
});
