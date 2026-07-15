import * as THREE from 'three';
import { SCENES } from './scenarios.js';

// ============================================================================
//  CarAmmo DELUXE — corrida 3D com Ammo.js + Three.js
//  3 cenários distintos · IA · Nitro · Multi-câmera · Partículas · Som de motor
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
  const speck = scn.id==='snow'?80:scn.id==='desert'?50:40;
  for (let i=0;i<6000;i++){
    const g = speck+Math.random()*40;
    ctx.fillStyle = `rgba(${g},${g},${g},${0.12+Math.random()*0.2})`;
    ctx.fillRect(Math.random()*size, Math.random()*size, 1+Math.random()*2, 1);
  }
  if (scn.id==='snow') {
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
  scene.background = new THREE.Color(scn.fogColor);
  scene.fog = new THREE.FogExp2(scn.fogColor, scn.fogDensity);
  scene.children.filter(o => o.isLight || o.isSky).forEach(o => scene.remove(o));
  scene.add(new THREE.HemisphereLight(scn.hemiSky, scn.hemiGround, scn.hemiInt ?? 0.55));
  scene.add(new THREE.AmbientLight(scn.ambientColor, scn.ambientInt ?? 0.3));
  sun = new THREE.DirectionalLight(scn.sunColor, scn.sunIntensity);
  sun.position.set(scn.sunAz ?? 60, scn.sunEl ?? 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048,2048); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.03;
  const s = 180;
  sun.shadow.camera.left=-s; sun.shadow.camera.right=s; sun.shadow.camera.top=s; sun.shadow.camera.bottom=-s;
  sun.shadow.camera.far=400; sun.shadow.camera.near=10;
  scene.add(sun); scene.add(sun.target);
  renderer.toneMappingExposure = scn.exposure ?? 1.1;
  const skyGeo = new THREE.SphereGeometry(1200,32,16);
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

  const bound = computeTrackBounds(trackCurve, 220);
  const worldSize = Math.max(bound.sizeX, bound.sizeZ)*1.7 + 220;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize,worldSize,1,1),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(scn.groundTex), color: scn.groundColor, roughness: scn.groundRoughness ?? 0.95 })
  );
  ground.rotation.x = -Math.PI/2; ground.position.set(bound.cx,-1.5,bound.cz); ground.receiveShadow=true; scene.add(ground);

  const asphaltGeo = buildRibbon(trackCurve, trackWidth/2, 1400, wFn);
  const asphaltMat = new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(scn), roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat); asphalt.receiveShadow = true; scene.add(asphalt);

  addRumbleStrips(scn,wFn); addLaneMarkings(scn,wFn); addSideLines(scn,wFn); addBarriers(scn,wFn);

  // Collision mesh
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
  tbody.setFriction(scn.trackFriction); physicsWorld.addRigidBody(tbody);

  addStartLine();
  addIcePatches(scn);
  buildEnvironment(scn, trackCurve, bound, wFn);

  minimapPath = [];
  for (let i=0;i<=140;i++){ const p=trackCurve.getPointAt(i/140); minimapPath.push({x:p.x,z:p.z}); }
  minimapBounds = null;
}

function addRumbleStrips(scn,wFn){
  const rw=1.0, segs=260;
  const mA=new THREE.MeshStandardMaterial({color: scn.rumbleColorA ?? 0xd82222,roughness:0.75});
  const mB=new THREE.MeshStandardMaterial({color: scn.rumbleColorB ?? 0xffffff,roughness:0.75});
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
  const dm=new THREE.MeshStandardMaterial({color:scn.id==='snow'?0xffd86b:0xffffff,roughness:0.6,side:THREE.DoubleSide});
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
  if (!scn.hasBarriers) return;
  const off=trackWidth/2+0.8;
  const col = scn.barrierColor ?? 0xc03030;
  const bm=new THREE.MeshStandardMaterial({color:col,roughness:0.6,metalness:0.2,side:THREE.DoubleSide});
  // Red stripes on barriers for visual interest
  const L=new THREE.Mesh(buildSegmentedBarrier(trackCurve,off,1,0.6,wFn),bm);
  const R=new THREE.Mesh(buildSegmentedBarrier(trackCurve,off,-1,0.6,wFn),bm);
  L.castShadow=R.castShadow=true; L.receiveShadow=R.receiveShadow=true;
  scene.add(L); scene.add(R);
  // Barrier posts every so often
  const postGeo = new THREE.BoxGeometry(0.15, 1.1, 0.15);
  const postMat = new THREE.MeshStandardMaterial({color: 0xdddddd, metalness:0.6, roughness:0.3});
  const segs = Math.floor(trackLength/10);
  for (let i=0;i<segs;i++){
    const t = i/segs;
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const w = wFn?off*wFn(t):off;
    for (let side=-1;side<=1;side+=2){
      const pp = p.clone().addScaledVector(n, side*w);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pp.x, p.y+0.6, pp.z);
      post.castShadow = true;
      scene.add(post);
    }
  }
}

function addIcePatches(scn){
  if (!scn.hasIcePatches) return;
  const iceMat = new THREE.MeshStandardMaterial({color:0xb8d4e8, roughness:0.05, metalness:0.4, transparent:true, opacity:0.75, side:THREE.DoubleSide});
  // Place 8-12 ice patches across the track
  const patches = 10;
  for (let i=0;i<patches;i++){
    const t = (i+0.3)/patches;
    const p = trackCurve.getPointAt(t);
    const tan = trackCurve.getTangentAt(t);
    const patch = new THREE.Mesh(
      new THREE.CircleGeometry(2.5+Math.random()*2, 12),
      iceMat
    );
    patch.rotation.x = -Math.PI/2;
    const offset = (Math.random()-0.5) * (trackWidth*0.5);
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    patch.position.set(p.x+n.x*offset, p.y+0.06, p.z+n.z*offset);
    patch.rotation.z = Math.atan2(tan.x,tan.z);
    patch.receiveShadow = true;
    scene.add(patch);
  }
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
  // ---- TREES / CACTI / PINES (instanced) ----
  let trunkGeo, trunkMat, leafGeo, leafMat;
  const treeType = scn.treeType || 'pine';

  if (treeType === 'cactus') {
    trunkGeo = new THREE.CylinderGeometry(0.5, 0.55, 4, 10);
    trunkMat = new THREE.MeshStandardMaterial({color: scn.treeTrunkColor ?? 0x5a7a3a, roughness: 0.85});
    leafGeo = trunkGeo; leafMat = trunkMat; // cactus is single green trunk
  } else if (treeType === 'pine-snow') {
    trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 2.0, 8);
    trunkMat = new THREE.MeshStandardMaterial({color: scn.treeTrunkColor ?? 0x3a2818, roughness: 0.95});
    // Multi-cone pine (built later as compound via stacked cones — but for instanced simplicity use single cone with caps)
    leafGeo = new THREE.ConeGeometry(1.9, 5, 9);
    leafMat = new THREE.MeshStandardMaterial({color: 0x2a4030, roughness: 0.9});
  } else {
    // Normal pine
    trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.8, 8);
    trunkMat = new THREE.MeshStandardMaterial({color: scn.treeTrunkColor ?? 0x6b4423, roughness: 0.9});
    leafGeo = new THREE.ConeGeometry(1.7, 4.5, 8);
    leafMat = new THREE.MeshStandardMaterial({color: 0x2f6b2f, roughness: 0.85});
  }

  const n = scn.treeCount;
  const tMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const lMesh = treeType==='cactus' ? null : new THREE.InstancedMesh(leafGeo, leafMat, n);
  tMesh.castShadow = true;
  if (lMesh) { lMesh.castShadow = true; lMesh.receiveShadow = true; scene.add(lMesh); }
  scene.add(tMesh);

  // Extra meshes for cactus arms or snow caps
  let armMesh = null, capMesh = null, capMesh2 = null;
  if (treeType === 'cactus') {
    const armGeo = new THREE.CylinderGeometry(0.25, 0.28, 1.6, 8);
    armMesh = new THREE.InstancedMesh(armGeo, trunkMat, n*2);
    armMesh.castShadow = true; scene.add(armMesh);
  }
  if (treeType === 'pine-snow') {
    const capGeo = new THREE.ConeGeometry(1.5, 1.4, 9);
    const capMat = new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.4});
    capMesh = new THREE.InstancedMesh(capGeo, capMat, n);
    capMesh.castShadow = true; scene.add(capMesh);
    // Second cone layer (for multi-tier look, drawn as another instanced mesh)
    const capGeo2 = new THREE.ConeGeometry(2.2, 0.8, 9);
    capMesh2 = new THREE.InstancedMesh(capGeo2, capMat, n);
    capMesh2.castShadow = true; scene.add(capMesh2);
  }

  const dummy = new THREE.Object3D();
  let placed = 0, armPlaced = 0, attempts = 0;
  const minDist = scn.treeDensity ?? 15;
  while (placed < n && attempts < n*12) {
    attempts++;
    const x = bound.minX + Math.random()*(bound.maxX-bound.minX);
    const z = bound.minZ + Math.random()*(bound.maxZ-bound.minZ);
    const nr = nearestOnCurve(curve, new THREE.Vector3(x,0,z));
    if (nr.dist < minDist) continue;
    if (Math.hypot(x-trackStartPos.x, z-trackStartPos.z) < 30) continue;

    const scale = 0.7 + Math.random()*1.6;
    if (treeType === 'cactus') {
      // Cactus trunk
      const th = 4*scale;
      dummy.position.set(x, th/2, z);
      dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
      dummy.scale.set(scale*0.9, scale, scale*0.9);
      dummy.updateMatrix();
      tMesh.setMatrixAt(placed, dummy.matrix);
      // 1 or 2 arms
      const arms = Math.random() < 0.7 ? (Math.random() < 0.5 ? 1 : 2) : 0;
      for (let a=0;a<arms;a++){
        const side = a===0?1:-1;
        const armH = 1.4*scale;
        dummy.position.set(x+side*0.55*scale, th*0.5, z);
        dummy.rotation.set(0,0,side*0.3);
        dummy.scale.set(scale*0.7, scale*0.7, scale*0.7);
        dummy.updateMatrix();
        if (armPlaced < n*2) { armMesh.setMatrixAt(armPlaced, dummy.matrix); armPlaced++; }
      }
    } else if (treeType === 'pine-snow') {
      const th = 2.0*scale;
      dummy.position.set(x, th/2, z);
      dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      tMesh.setMatrixAt(placed, dummy.matrix);
      const lh = 5*scale;
      dummy.position.set(x, th+lh/2-0.2, z);
      dummy.updateMatrix();
      lMesh.setMatrixAt(placed, dummy.matrix);
      // Snow cap on tip
      dummy.position.set(x, th+lh-0.5, z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      capMesh.setMatrixAt(placed, dummy.matrix);
      // Snow collar
      dummy.position.set(x, th+lh*0.45, z);
      dummy.updateMatrix();
      capMesh2.setMatrixAt(placed, dummy.matrix);
    } else {
      // Normal forest pine
      const th = 1.8*scale;
      dummy.position.set(x, th/2, z);
      dummy.rotation.set(0, Math.random()*Math.PI*2, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      tMesh.setMatrixAt(placed, dummy.matrix);
      const lh = 4.5*scale;
      dummy.position.set(x, th+lh/2, z);
      dummy.updateMatrix();
      lMesh.setMatrixAt(placed, dummy.matrix);
    }
    placed++;
  }
  tMesh.count = placed; tMesh.instanceMatrix.needsUpdate = true;
  if (lMesh) { lMesh.count = placed; lMesh.instanceMatrix.needsUpdate = true; }
  if (armMesh) { armMesh.count = armPlaced; armMesh.instanceMatrix.needsUpdate = true; }
  if (capMesh) { capMesh.count = placed; capMesh.instanceMatrix.needsUpdate = true; }
  if (capMesh2) { capMesh2.count = placed; capMesh2.instanceMatrix.needsUpdate = true; }

  // ---- LAMP POSTS ----
  if (scn.hasLamps){
    const spacing = scn.lampSpacing ?? 35;
    const pG = new THREE.CylinderGeometry(0.1, 0.16, 7.5, 8);
    const pM = new THREE.MeshStandardMaterial({color: 0x555, roughness: 0.5, metalness: 0.85});
    const armG = new THREE.BoxGeometry(1.5, 0.1, 0.1);
    const bG = new THREE.SphereGeometry(0.28, 10, 10);
    const bM = new THREE.MeshStandardMaterial({color:0xffffcc, emissive:0xffffaa, emissiveIntensity:1.3});
    const pCount = Math.floor(trackLength/spacing);
    for (let i=0;i<pCount;i++){
      const t = i/pCount;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
      for (let side=-1;side<=1;side+=2){
        const pp = p.clone().addScaledVector(n, side*(trackWidth/2+2.8));
        const pole = new THREE.Mesh(pG, pM);
        pole.position.set(pp.x, p.y+3.7, pp.z);
        pole.castShadow = true; scene.add(pole);
        // arm pointing over track
        const arm = new THREE.Mesh(armG, pM);
        arm.position.set(pp.x - n.x*side*0.75, p.y+7.2, pp.z - n.z*side*0.75);
        arm.rotation.y = Math.atan2(n.x, n.z);
        arm.castShadow = true; scene.add(arm);
        const bulb = new THREE.Mesh(bG, bM);
        bulb.position.set(pp.x - n.x*side*1.5, p.y+7.2, pp.z - n.z*side*1.5);
        scene.add(bulb);
        // Point light
        const pl = new THREE.PointLight(0xffeecc, 0.6, 20, 2);
        pl.position.copy(bulb.position);
        scene.add(pl);
      }
    }
  }

  // ---- CONES ----
  if (scn.hasCones){
    const every = scn.conesEvery ?? 16;
    const cG = new THREE.ConeGeometry(0.24, 0.7, 10);
    const cM = new THREE.MeshStandardMaterial({color:0xff6600, roughness:0.55});
    // white stripe
    const sG = new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10);
    const sM = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.5});
    const cCount = Math.floor(trackLength/every);
    for (let i=0;i<cCount;i++){
      const t = i/cCount;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
      const side = i%2===0?1:-1;
      const w = wFn ? (trackWidth/2+1.4)*wFn(t) : trackWidth/2+1.4;
      const cp = p.clone().addScaledVector(n, side*w);
      const cone = new THREE.Mesh(cG, cM);
      cone.position.set(cp.x, p.y+0.4, cp.z);
      cone.castShadow = true; scene.add(cone);
      const stripe = new THREE.Mesh(sG, sM);
      stripe.position.set(cp.x, p.y+0.45, cp.z);
      scene.add(stripe);
    }
  }

  // ---- ROCKS ----
  if (scn.hasRocks){
    const rCount = scn.rockCount ?? 100;
    const rG = new THREE.DodecahedronGeometry(0.5, 0);
    const rM = new THREE.MeshStandardMaterial({color: scn.rockColor||0x7a7a7a, roughness:0.95});
    for (let i=0;i<rCount;i++){
      const t = Math.random();
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
      const side = Math.random()>0.5?1:-1;
      const base = wFn?(trackWidth/2+2)*wFn(t):trackWidth/2+2;
      const dist = base + Math.random()*8;
      const rp = p.clone().addScaledVector(n, side*dist);
      const rock = new THREE.Mesh(rG, rM);
      const s = 0.4 + Math.random()*2;
      rock.position.set(rp.x, p.y+s*0.3, rp.z);
      rock.scale.set(s, s*0.7, s);
      rock.rotation.set(Math.random(),Math.random(),Math.random());
      rock.castShadow = true; scene.add(rock);
    }
  }

  // ==== SCENE-SPECIFIC EXTRAS ====

  if (scn.id === 'forest') {
    // Small flower patches (colored spots)
    if (scn.hasFlowers) addFlowers(curve, bound, wFn);
    if (scn.hasSheds) addSheds(curve, bound, wFn);
    if (scn.hasSigns) addSigns(curve);
    // A few extra broadleaf trees (sphere clusters) in the distance
    addBroadleafTrees(curve, bound);
  }

  if (scn.id === 'desert') {
    addDunes(curve, wFn);
    addCanyon(curve, wFn);
    if (scn.hasBarrels) addBarrels(curve, wFn);
    if (scn.hasTumbleweeds) addTumbleweeds(curve, bound, wFn);
  }

  if (scn.id === 'snow') {
    if (scn.hasSnowPiles) addSnowPiles(curve, wFn);
    if (scn.hasSnowmen) addSnowmen(curve, wFn);
    addSnowTracks(curve, wFn);
    addBridge(curve, wFn);
    // Pine trees are already covered above; add a couple of frozen lakes in the distance
    addFrozenLakes(curve, bound);
  }

  // Snow particles
  if (scn.snowParticles) createSnowParticles();
}

// ---------- helpers for scene extras ----------
function addFlowers(curve, bound, wFn) {
  const colors = [0xff3366, 0xffffff, 0xffeb3b, 0xe91e63, 0xba68c8];
  for (let c=0;c<5;c++){
    const geo = new THREE.IcosahedronGeometry(0.18, 0);
    const mat = new THREE.MeshStandardMaterial({color: colors[c%colors.length], roughness:0.7});
    const count = 60;
    const im = new THREE.InstancedMesh(geo, mat, count);
    const d = new THREE.Object3D();
    for (let i=0;i<count;i++){
      let tries=0;
      while(tries<20){
        tries++;
        const x = bound.minX+Math.random()*(bound.maxX-bound.minX);
        const z = bound.minZ+Math.random()*(bound.maxZ-bound.minZ);
        const nr = nearestOnCurve(curve, new THREE.Vector3(x,0,z));
        if (nr.dist > 10 && nr.dist < 40){
          d.position.set(x, 0.1, z);
          d.scale.setScalar(0.5+Math.random()*0.7);
          d.updateMatrix(); im.setMatrixAt(i, d.matrix); break;
        }
      }
    }
    im.instanceMatrix.needsUpdate=true;
    scene.add(im);
  }
}

function addSheds(curve, bound, wFn) {
  // Small wooden sheds off-track
  const shedCount = 5;
  for (let i=0;i<shedCount;i++){
    const t = (i+0.4)/shedCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const side = i%2===0?1:-1;
    const dist = 25+Math.random()*20;
    const pos = p.clone().addScaledVector(n, side*dist);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3,2,2.5),
      new THREE.MeshStandardMaterial({color:0x8a5a30, roughness:0.9})
    );
    body.position.y = 1; body.castShadow=true; group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 1.5, 4),
      new THREE.MeshStandardMaterial({color:0x6b2e20, roughness:0.8})
    );
    roof.position.y = 2.7; roof.rotation.y = Math.PI/4; roof.castShadow=true; group.add(roof);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.7,1.2,0.1),
      new THREE.MeshStandardMaterial({color:0x3a2010, roughness:0.9})
    );
    door.position.set(0,0.6,1.26); group.add(door);
    group.position.set(pos.x, p.y, pos.z);
    group.rotation.y = Math.random()*Math.PI*2;
    group.castShadow=true; scene.add(group);
  }
}

function addSigns(curve) {
  // Chequered/arrow signs at corners
  const signCount = 8;
  for (let i=0;i<signCount;i++){
    const t = (i+0.2)/signCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z,0,tan.x).normalize();
    // Estimate curvature by sampling ahead
    const ahead = curve.getPointAt(Math.min(1, t+0.03));
    const toAhead = new THREE.Vector3().subVectors(ahead, p);
    const cross = tan.x*toAhead.z - tan.z*toAhead.x;
    const side = cross > 0 ? 1 : -1;
    const pos = p.clone().addScaledVector(n, side*(trackWidth/2+3));
    const group = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08,0.08,2.2,6),
      new THREE.MeshStandardMaterial({color:0x555,metalness:0.7,roughness:0.4})
    );
    post.position.y = 1.1; post.castShadow=true; group.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.4,0.9,0.1),
      new THREE.MeshStandardMaterial({color:side>0?0x1565c0:0xc62828, roughness:0.5})
    );
    board.position.y=2.2; board.castShadow=true; group.add(board);
    // White arrow
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.22,0.35,3),
      new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.6})
    );
    arrow.position.set(0, 2.2, 0.08);
    arrow.rotation.z = side>0? -Math.PI/2 : Math.PI/2;
    group.add(arrow);
    group.position.set(pos.x, p.y, pos.z);
    group.lookAt(p.x, p.y, p.z);
    scene.add(group);
  }
}

function addBroadleafTrees(curve, bound) {
  const tG = new THREE.CylinderGeometry(0.25, 0.4, 2.2, 6);
  const tM = new THREE.MeshStandardMaterial({color:0x5a3a20,roughness:0.95});
  const lG = new THREE.IcosahedronGeometry(1.6,1);
  const lM = new THREE.MeshStandardMaterial({color:0x3a8a2a,roughness:0.85});
  const count = 60;
  const iT = new THREE.InstancedMesh(tG, tM, count);
  const iL = new THREE.InstancedMesh(lG, lM, count*2);
  scene.add(iT); scene.add(iL);
  const d = new THREE.Object3D();
  let tp=0, lp=0;
  for (let i=0;i<count;i++){
    let tries=0;
    while(tries<20){
      tries++;
      const x=bound.minX+Math.random()*(bound.maxX-bound.minX);
      const z=bound.minZ+Math.random()*(bound.maxZ-bound.minZ);
      const nr=nearestOnCurve(curve,new THREE.Vector3(x,0,z));
      if (nr.dist>20 && nr.dist<80){
        const s=0.8+Math.random()*1.1;
        d.position.set(x, 1.1*s, z); d.scale.set(s,s,s); d.rotation.y=Math.random()*Math.PI*2;
        d.updateMatrix(); iT.setMatrixAt(tp++, d.matrix);
        // 1-2 leaf blobs
        for (let k=0;k<2;k++){
          d.position.set(x+(Math.random()-0.5)*1.2, 2.2*s+Math.random()*0.5, z+(Math.random()-0.5)*1.2);
          d.scale.set(s*(0.8+Math.random()*0.4),s*(0.8+Math.random()*0.4),s*(0.8+Math.random()*0.4));
          d.updateMatrix(); if (lp<count*2){iL.setMatrixAt(lp++,d.matrix);}
        }
        break;
      }
    }
  }
  iT.count=tp; iL.count=lp;
  iT.instanceMatrix.needsUpdate=true; iL.instanceMatrix.needsUpdate=true;
}

function addDunes(curve, wFn) {
  const dM = new THREE.MeshStandardMaterial({color:0xc8923a, roughness:1});
  for (let i=0;i<55;i++){
    const t=Math.random(); const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t);
    const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const side=Math.random()>0.5?1:-1;
    const dist=30+Math.random()*90;
    const dp=p.clone().addScaledVector(n,side*dist);
    const dune=new THREE.Mesh(
      new THREE.SphereGeometry(10+Math.random()*14, 14, 10, 0, Math.PI*2, 0, Math.PI/2), dM);
    dune.position.set(dp.x,-1.5,dp.z);
    dune.scale.y=0.3+Math.random()*0.25;
    dune.receiveShadow=true; scene.add(dune);
  }
}

function addCanyon(curve, wFn) {
  const canyonT = 0.38;
  const p = curve.getPointAt(canyonT);
  const tan = curve.getTangentAt(canyonT).normalize();
  const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a5a28, roughness: 0.95 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6a4020, roughness: 0.9 });

  for (let side = -1; side <= 1; side += 2) {
    const wallGroup = new THREE.Group();

    const mainWall = new THREE.Mesh(
      new THREE.BoxGeometry(18, 22, 28),
      wallMat
    );
    mainWall.position.set(0, 10, 0);
    mainWall.castShadow = true;
    mainWall.receiveShadow = true;
    wallGroup.add(mainWall);

    const topRock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(6, 1),
      rockMat
    );
    topRock.position.set(0, 22, 0);
    topRock.scale.set(1.2, 0.7, 1.0);
    topRock.castShadow = true;
    wallGroup.add(topRock);

    for (let i = 0; i < 8; i++) {
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.5 + Math.random() * 2.5, 0),
        rockMat
      );
      boulder.position.set(
        (Math.random() - 0.5) * 16,
        Math.random() * 8,
        (Math.random() - 0.5) * 24
      );
      boulder.rotation.set(Math.random(), Math.random(), Math.random());
      boulder.castShadow = true;
      wallGroup.add(boulder);
    }

    const wallPos = p.clone().addScaledVector(n, side * (trackWidth / 2 + 10));
    wallGroup.position.set(wallPos.x, p.y - 1, wallPos.z);
    wallGroup.rotation.y = Math.atan2(tan.x, tan.z);
    scene.add(wallGroup);
  }

  const archGeo = new THREE.TorusGeometry(trackWidth / 2 + 2, 1.5, 8, 12, Math.PI);
  const archMat = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.9 });
  const arch = new THREE.Mesh(archGeo, archMat);
  arch.position.set(p.x, p.y + 14, p.z);
  arch.rotation.y = Math.atan2(tan.x, tan.z);
  arch.rotation.z = Math.PI;
  arch.castShadow = true;
  scene.add(arch);

  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x9a6a38, roughness: 0.95 });
  for (let i = 0; i < 12; i++) {
    const t2 = canyonT + (i - 6) * 0.008;
    const p2 = curve.getPointAt(Math.max(0.01, Math.min(0.99, t2)));
    const tan2 = curve.getTangentAt(Math.max(0.01, Math.min(0.99, t2)));
    const n2 = new THREE.Vector3(-tan2.z, 0, tan2.x).normalize();
    for (let side = -1; side <= 1; side += 2) {
      const cliff = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2 + Math.random() * 3, 0),
        cliffMat
      );
      const dist = trackWidth / 2 + 3 + Math.random() * 5;
      const cp = p2.clone().addScaledVector(n2, side * dist);
      cliff.position.set(cp.x, p2.y + Math.random() * 4, cp.z);
      cliff.rotation.set(Math.random(), Math.random(), Math.random());
      cliff.scale.set(1, 0.6 + Math.random() * 0.8, 1);
      cliff.castShadow = true;
      scene.add(cliff);
    }
  }
}

function addBarrels(curve, wFn) {
  const bG = new THREE.CylinderGeometry(0.35,0.4,0.9,10);
  const bM = new THREE.MeshStandardMaterial({color:0xb04020, roughness:0.5, metalness:0.3});
  const ringG = new THREE.TorusGeometry(0.38,0.03,6,12);
  const ringM = new THREE.MeshStandardMaterial({color:0x888,metalness:0.7,roughness:0.3});
  const count = 25;
  for (let i=0;i<count;i++){
    const t=Math.random(); const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t);
    const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const side=Math.random()>0.5?1:-1;
    const base = wFn?(trackWidth/2+2)*wFn(t):trackWidth/2+2;
    const dist = base+2+Math.random()*4;
    const bp=p.clone().addScaledVector(n,side*dist);
    const barrel = new THREE.Mesh(bG,bM);
    barrel.position.set(bp.x, p.y+0.5, bp.z);
    barrel.rotation.z = (Math.random()-0.5)*0.3;
    barrel.castShadow=true; scene.add(barrel);
    for (let r=0;r<2;r++){
      const ring=new THREE.Mesh(ringG,ringM);
      ring.position.set(bp.x, p.y+0.2+r*0.5, bp.z);
      ring.rotation.x=Math.PI/2;
      scene.add(ring);
    }
  }
}

function addTumbleweeds(curve, bound, wFn) {
  const g = new THREE.IcosahedronGeometry(0.4, 0);
  const m = new THREE.MeshStandardMaterial({color:0x8a6a38, wireframe:true, roughness:1});
  const count = 20;
  for (let i=0;i<count;i++){
    const t=Math.random(); const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t);
    const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const side=Math.random()>0.5?1:-1;
    const base = wFn?(trackWidth/2+2)*wFn(t):trackWidth/2+2;
    const dist = base+3+Math.random()*8;
    const pp=p.clone().addScaledVector(n,side*dist);
    const tw = new THREE.Mesh(g,m);
    tw.position.set(pp.x, p.y+0.4, pp.z);
    tw.castShadow=true; scene.add(tw);
  }
}

function addSnowPiles(curve, wFn) {
  const count = 50;
  const g = new THREE.SphereGeometry(1, 10, 8);
  const m = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.5});
  for (let i=0;i<count;i++){
    const t=Math.random(); const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t);
    const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const side=Math.random()>0.5?1:-1;
    const base = wFn?(trackWidth/2+1)*wFn(t):trackWidth/2+1;
    const dist = base+Math.random()*6;
    const pp=p.clone().addScaledVector(n,side*dist);
    const s = 0.6+Math.random()*1.4;
    const pile = new THREE.Mesh(g,m);
    pile.position.set(pp.x, p.y+s*0.4-0.1, pp.z);
    pile.scale.set(s*1.2, s*0.6, s*1.2);
    pile.castShadow=true; pile.receiveShadow=true;
    scene.add(pile);
  }
}

function addSnowmen(curve, wFn) {
  const count = 6;
  for (let i=0;i<count;i++){
    const t=(i+0.3)/count; const p=curve.getPointAt(t);
    const tan=curve.getTangentAt(t);
    const n=new THREE.Vector3(-tan.z,0,tan.x).normalize();
    const side = i%2===0?1:-1;
    const base = wFn?(trackWidth/2+2)*wFn(t):trackWidth/2+2;
    const dist = base+3+Math.random()*3;
    const pp = p.clone().addScaledVector(n, side*dist);
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({color:0xffffff, roughness:0.35});
    const black = new THREE.MeshStandardMaterial({color:0x111111, roughness:0.5});
    const red = new THREE.MeshStandardMaterial({color:0xc62828, roughness:0.6});
    // Base
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.6,12,10), white);
    bottom.position.y=0.6; bottom.castShadow=true; group.add(bottom);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45,12,10), white);
    mid.position.y=1.4; mid.castShadow=true; group.add(mid);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32,12,10), white);
    head.position.y=2.05; head.castShadow=true; group.add(head);
    // Buttons
    for (let k=0;k<3;k++){
      const btn=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),black);
      btn.position.set(0,1.25+k*0.2,0.4); group.add(btn);
    }
    // Eyes
    const eyeL=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),black); eyeL.position.set(-0.1,2.1,0.27); group.add(eyeL);
    const eyeR=new THREE.Mesh(new THREE.SphereGeometry(0.05,8,8),black); eyeR.position.set(0.1,2.1,0.27); group.add(eyeR);
    // Nose (carrot)
    const nose=new THREE.Mesh(new THREE.ConeGeometry(0.06,0.25,8),new THREE.MeshStandardMaterial({color:0xff7020,roughness:0.6}));
    nose.position.set(0,2.0,0.4); nose.rotation.x=Math.PI/2; group.add(nose);
    // Hat
    const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.35,0.04,12),black); brim.position.y=2.35; group.add(brim);
    const hat=new THREE.Mesh(new THREE.CylinderGeometry(0.22,0.22,0.3,12),black); hat.position.y=2.52; group.add(hat);
    // Scarf
    const scarf=new THREE.Mesh(new THREE.TorusGeometry(0.3,0.06,6,12),red); scarf.position.y=1.72; scarf.rotation.x=Math.PI/2; group.add(scarf);
    group.position.set(pp.x, p.y, pp.z);
    group.castShadow=true; scene.add(group);
  }
}

function addSnowTracks(curve, wFn) {
  // Subtle darker packed-snow edges along track (visual only)
  const edgeMat = new THREE.MeshStandardMaterial({color:0xb8c8d4, roughness:0.8});
  const left = offsetCurve(curve, trackWidth/2+2, false, wFn);
  const right = offsetCurve(curve, trackWidth/2+2, true, wFn);
  const gL = buildRibbon(left, 1.2, 600);
  const gR = buildRibbon(right, 1.2, 600);
  const mL = new THREE.Mesh(gL, edgeMat); mL.receiveShadow = true; scene.add(mL);
  const mR = new THREE.Mesh(gR, edgeMat); mR.receiveShadow = true; scene.add(mR);
}

function addBridge(curve, wFn) {
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.4 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.5, metalness: 0.6 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.7, metalness: 0.3 });

  const bridgeStart = 0.45;
  const bridgeEnd = 0.6;
  const segs = 40;

  const pos = [], idx = [], uv = [];
  const posTop = [], idxTop = [], uvTop = [];

  for (let i = 0; i <= segs; i++) {
    const t = bridgeStart + (i / segs) * (bridgeEnd - bridgeStart);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? (trackWidth / 2 + 0.5) * wFn(t) : trackWidth / 2 + 0.5;

    const L = p.clone().addScaledVector(n, -w);
    const R = p.clone().addScaledVector(n, w);

    pos.push(L.x, L.y - 0.3, L.z);
    pos.push(R.x, R.y - 0.3, R.z);
    uv.push(0, (t - bridgeStart) * 200);
    uv.push(1, (t - bridgeStart) * 200);

    posTop.push(L.x, L.y + 0.1, L.z);
    posTop.push(R.x, R.y + 0.1, R.z);
    uvTop.push(0, (t - bridgeStart) * 200);
    uvTop.push(1, (t - bridgeStart) * 200);

    if (i < segs) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d);
      idxTop.push(a, c, b, b, c, d);
    }
  }

  const sideGeo = new THREE.BufferGeometry();
  const sidePos = [];
  const sideIdx = [];
  const sideUv = [];
  for (let i = 0; i <= segs; i++) {
    const t = bridgeStart + (i / segs) * (bridgeEnd - bridgeStart);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? (trackWidth / 2 + 0.5) * wFn(t) : trackWidth / 2 + 0.5;

    for (let side = -1; side <= 1; side += 2) {
      const bx = p.x + n.x * side * w;
      const bz = p.z + n.z * side * w;
      sidePos.push(bx, p.y - 0.3, bz);
      sidePos.push(bx, p.y + 0.6, bz);
      sideUv.push(0, (t - bridgeStart) * 200);
      sideUv.push(1, (t - bridgeStart) * 200);
    }
    if (i < segs) {
      const base = i * 4;
      sideIdx.push(base, base + 4, base + 1, base + 1, base + 4, base + 5);
      sideIdx.push(base + 2, base + 3, base + 6, base + 3, base + 7, base + 6);
    }
  }
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
  sideGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sideUv, 2));
  sideGeo.setIndex(sideIdx);
  sideGeo.computeVertexNormals();

  const sideL = new THREE.Mesh(sideGeo, railMat);
  sideL.castShadow = true;
  sideL.receiveShadow = true;
  scene.add(sideL);

  const pillarGeo = new THREE.BoxGeometry(0.8, 1, 0.8);
  const pillarCount = 8;
  for (let i = 0; i < pillarCount; i++) {
    const t = bridgeStart + ((i + 0.5) / pillarCount) * (bridgeEnd - bridgeStart);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? (trackWidth / 2 + 0.3) * wFn(t) : trackWidth / 2 + 0.3;

    for (let side = -1; side <= 1; side += 2) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      const pp = p.clone().addScaledVector(n, side * w);
      const pillarHeight = p.y + 0.3;
      pillar.scale.y = pillarHeight / 0.5;
      pillar.position.set(pp.x, pillarHeight / 2 - 0.3, pp.z);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      scene.add(pillar);
    }
  }

  const crossBeamGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  for (let i = 0; i < pillarCount - 1; i++) {
    const t1 = bridgeStart + ((i + 0.5) / pillarCount) * (bridgeEnd - bridgeStart);
    const t2 = bridgeStart + ((i + 1.5) / pillarCount) * (bridgeEnd - bridgeStart);
    const p1 = curve.getPointAt(t1);
    const p2 = curve.getPointAt(t2);
    const tan = curve.getTangentAt((t1 + t2) / 2).normalize();
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? (trackWidth / 2 + 0.3) * wFn((t1 + t2) / 2) : trackWidth / 2 + 0.3;

    for (let side = -1; side <= 1; side += 2) {
      const beam = new THREE.Mesh(crossBeamGeo, pillarMat);
      const midY = (p1.y + p2.y) / 2;
      const midX = (p1.x + p2.x) / 2 + n.x * side * w;
      const midZ = (p1.z + p2.z) / 2 + n.z * side * w;
      beam.position.set(midX, midY - 0.1, midZ);
      beam.lookAt(p2.x + n.x * side * w, p2.y - 0.1, p2.z + n.z * side * w);
      scene.add(beam);
    }
  }
}

function addFrozenLakes(curve, bound) {
  const lakeMat = new THREE.MeshStandardMaterial({color:0xa8c8e0, roughness:0.1, metalness:0.3, transparent:true, opacity:0.85});
  for (let i=0;i<2;i++){
    let tries=0;
    while(tries<40){
      tries++;
      const x=bound.minX+Math.random()*(bound.maxX-bound.minX);
      const z=bound.minZ+Math.random()*(bound.maxZ-bound.minZ);
      const nr=nearestOnCurve(curve,new THREE.Vector3(x,0,z));
      if (nr.dist>40){
        const lake = new THREE.Mesh(new THREE.CircleGeometry(15+Math.random()*12, 16), lakeMat);
        lake.rotation.x=-Math.PI/2;
        lake.position.set(x,-1.45,z);
        lake.receiveShadow=true; scene.add(lake);
        break;
      }
    }
  }
}

function createSnowParticles() {
  const count=2000;
  const g=new THREE.BufferGeometry();
  const pos=new Float32Array(count*3);
  const vel=new Float32Array(count);
  for (let i=0;i<count;i++){
    pos[i*3]=(Math.random()-0.5)*300;
    pos[i*3+1]=Math.random()*80-10;
    pos[i*3+2]=(Math.random()-0.5)*300;
    vel[i]=0.06+Math.random()*0.12;
  }
  g.setAttribute('position', new THREE.BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({color:0xffffff,size:0.28,transparent:true,opacity:0.9,depthWrite:false});
  snowParticles=new THREE.Points(g,m);
  snowParticles.userData.vel=vel;
  scene.add(snowParticles);
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
    wi.set_m_frictionSlip(currentSceneDef.trackFriction*10); wi.set_m_rollInfluence(0.005);
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
    dustSys.maxLife = currentSceneDef.id==='snow'?1.5:1.0;
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
    const col = currentSceneDef.id==='snow'?(drifting?0xffffff:0xcccccc):(speedKmh>120?0x555555:0xdddddd);
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
  if (scn.id==='forest' && !hard) return;
  const intensity = hard ? 2 : (scn.id==='desert'?1:0.4);
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
    mark.material.opacity=currentSceneDef.id==='snow'?0.22:0.5;
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
  dustSys = createWorldPointSystem(400, currentSceneDef.dustColor||0xffffff, 0.3, currentSceneDef.id==='snow'?1.4:1.0);
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
