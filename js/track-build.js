// ============================================================================
//  Track build — road surface, barriers, rumble strips, lane markings,
//  start line, ice patches, collision mesh, minimap path
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { scene, physicsWorld, trackCurve, trackLength, trackStartPos, trackStartDir, trackWidth,
         minimapPath, minimapBounds,
         setTrackCurve, setTrackLength, setTrackStartPos, setTrackStartDir,
         setTrackWidth, setMinimapPath, setMinimapBounds } from './state.js';
import { buildRibbon, offsetCurve, buildSegmentedBarrier, widthFnFor, nearestOnCurve } from './track-helpers.js';
import { buildEnvironment } from './track-environment.js';
import { makeAsphaltTexture, makeGroundTexture } from './textures.js';



export function buildTrack(scn) {
  const Ammo = window.Ammo;
  const pts = scn.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  const length = curve.getLength();
  const width = scn.trackWidth;
  const wFn = widthFnFor(scn);

  const startPos = curve.getPointAt(0).clone();
  startPos.y += CFG.wheelRadius + 0.6;
  const startDir = curve.getTangentAt(0).clone();

  setTrackCurve(curve);
  setTrackLength(length);
  setTrackWidth(width);
  setTrackStartPos(startPos);
  setTrackStartDir(startDir);

  const bound = computeTrackBounds(curve, 220);
  const worldSize = Math.max(bound.sizeX, bound.sizeZ) * 1.7 + 220;
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(worldSize, worldSize, 1, 1),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(scn.groundTex), color: scn.groundColor, roughness: scn.groundRoughness ?? 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(bound.cx, 0, bound.cz);
  ground.receiveShadow = true;
  scene.add(ground);

  const asphaltGeo = buildRibbon(curve, width / 2, 1400, wFn);
  const asphaltMat = new THREE.MeshStandardMaterial({ map: makeAsphaltTexture(scn), roughness: 0.9, metalness: 0.04, side: THREE.DoubleSide });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.receiveShadow = true;
  scene.add(asphalt);

  addRumbleStrips(scn, wFn, curve, width);
  addLaneMarkings(scn, wFn, curve, width, length);
  addSideLines(scn, wFn, curve, width);
  addBarriers(scn, wFn, curve, width, length);

  // Collision mesh
  const tp = asphaltGeo.attributes.position.array;
  const ti = asphaltGeo.index.array;
  const tmesh = new Ammo.btTriangleMesh();
  for (let i = 0; i < ti.length; i += 3) {
    const a = ti[i] * 3, b = ti[i + 1] * 3, c = ti[i + 2] * 3;
    const v0 = new Ammo.btVector3(tp[a], tp[a + 1], tp[a + 2]);
    const v1 = new Ammo.btVector3(tp[b], tp[b + 1], tp[b + 2]);
    const v2 = new Ammo.btVector3(tp[c], tp[c + 1], tp[c + 2]);
    tmesh.addTriangle(v0, v1, v2, true);
    Ammo.destroy(v0); Ammo.destroy(v1); Ammo.destroy(v2);
  }
  const tshape = new Ammo.btBvhTriangleMeshShape(tmesh, true);
  const tr = new Ammo.btTransform(); tr.setIdentity();
  const tbody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(0, new Ammo.btDefaultMotionState(tr), tshape, new Ammo.btVector3(0, 0, 0)));
  tbody.setFriction(scn.trackFriction);
  physicsWorld.addRigidBody(tbody);

  addStartLine(curve, width);
  addIcePatches(scn, curve, width);
  buildEnvironment(scn, curve, bound, wFn);

  // Minimap path
  const path = [];
  for (let i = 0; i <= 140; i++) {
    const p = curve.getPointAt(i / 140);
    path.push({ x: p.x, z: p.z });
  }
  setMinimapPath(path);
  setMinimapBounds(null);
}

function addRumbleStrips(scn, wFn, curve, trackWidth) {
  const rw = 1.0, segs = 260;
  const mA = new THREE.MeshStandardMaterial({ color: scn.rumbleColorA ?? 0xd82222, roughness: 0.75 });
  const mB = new THREE.MeshStandardMaterial({ color: scn.rumbleColorB ?? 0xffffff, roughness: 0.75 });
  const half = trackWidth / 2;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < segs; i++) {
      const t1 = i / segs, t2 = (i + 1) / segs;
      const p1 = curve.getPointAt(t1), p2 = curve.getPointAt(t2);
      const tA = curve.getTangentAt(t1).normalize(), tB = curve.getTangentAt(t2).normalize();
      const n1 = new THREE.Vector3(-tA.z, 0, tA.x).normalize();
      const n2 = new THREE.Vector3(-tB.z, 0, tB.x).normalize();
      const i1 = wFn ? half * wFn(t1) - rw : half - rw;
      const o1 = wFn ? half * wFn(t1) : half;
      const i2 = wFn ? half * wFn(t2) - rw : half - rw;
      const o2 = wFn ? half * wFn(t2) : half;
      const pos = [
        p1.x + n1.x * side * i1, p1.y + 0.15, p1.z + n1.z * side * i1,
        p1.x + n1.x * side * o1, p1.y + 0.15, p1.z + n1.z * side * o1,
        p2.x + n2.x * side * i2, p2.y + 0.15, p2.z + n2.z * side * i2,
        p2.x + n2.x * side * o2, p2.y + 0.15, p2.z + n2.z * side * o2,
      ];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex([0, 2, 1, 1, 2, 3]); g.computeVertexNormals();
      scene.add(new THREE.Mesh(g, i % 2 === 0 ? mA : mB));
    }
  }
}

function addLaneMarkings(scn, wFn, curve, trackWidth, trackLength) {
  const dl = 2.2, dg = 3.2;
  const dashCount = Math.floor(trackLength / (dl + dg));
  const dg2 = new THREE.PlaneGeometry(0.22, dl);
  const dm = new THREE.MeshStandardMaterial({ color: scn.id === 'snow' ? 0xffd86b : 0xffffff, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < dashCount; i++) {
    const t = (i * (dl + dg)) / trackLength;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const dash = new THREE.Mesh(dg2, dm);
    dash.position.set(p.x, p.y + 0.16, p.z);
    const slope = Math.atan2(tan.y, Math.sqrt(tan.x * tan.x + tan.z * tan.z));
    dash.rotation.x = -Math.PI / 2 + slope;
    dash.rotation.z = Math.atan2(tan.x, tan.z);
    scene.add(dash);
  }
}

function addSideLines(scn, wFn, curve, trackWidth) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const w = trackWidth / 2 - 0.4;
  scene.add(new THREE.Mesh(buildRibbon(offsetCurve(curve, w, false, wFn), 0.12, 800), m));
  scene.add(new THREE.Mesh(buildRibbon(offsetCurve(curve, w, true, wFn), 0.12, 800), m));
}

function addBarriers(scn, wFn, curve, trackWidth, trackLength) {
  if (!scn.hasBarriers) return;
  const off = trackWidth / 2 + 0.8;
  const col = scn.barrierColor ?? 0xc03030;
  const bm = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide });
  const L = new THREE.Mesh(buildSegmentedBarrier(curve, off, 1, 0.6, wFn), bm);
  const R = new THREE.Mesh(buildSegmentedBarrier(curve, off, -1, 0.6, wFn), bm);
  L.castShadow = R.castShadow = true;
  L.receiveShadow = R.receiveShadow = true;
  scene.add(L); scene.add(R);
  const postGeo = new THREE.BoxGeometry(0.15, 1.1, 0.15);
  const postMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.6, roughness: 0.3 });
  const segs = Math.floor(trackLength / 10);
  for (let i = 0; i < segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? off * wFn(t) : off;
    for (let side = -1; side <= 1; side += 2) {
      const pp = p.clone().addScaledVector(n, side * w);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(pp.x, p.y + 0.6, pp.z);
      post.castShadow = true;
      scene.add(post);
    }
  }
}

function addIcePatches(scn, curve, trackWidth) {
  if (!scn.hasIcePatches) return;
  const iceMat = new THREE.MeshStandardMaterial({ color: 0xb8d4e8, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
  const patches = 10;
  for (let i = 0; i < patches; i++) {
    const t = (i + 0.3) / patches;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const patch = new THREE.Mesh(new THREE.CircleGeometry(2.5 + Math.random() * 2, 12), iceMat);
    patch.rotation.x = -Math.PI / 2;
    const offset = (Math.random() - 0.5) * (trackWidth * 0.5);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    patch.position.set(p.x + n.x * offset, p.y + 0.06, p.z + n.z * offset);
    patch.rotation.z = Math.atan2(tan.x, tan.z);
    patch.receiveShadow = true;
    scene.add(patch);
  }
}

function addStartLine(curve, trackWidth) {
  const p = curve.getPointAt(0);
  const tan = curve.getTangentAt(0);
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 8;
  const cx = cv.getContext('2d');
  for (let i = 0; i < 8; i++) { cx.fillStyle = i % 2 ? '#fff' : '#111'; cx.fillRect(i * 8, 0, 8, 8); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(trackWidth, 0.05, 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
  m.position.copy(p); m.position.y += 0.12; m.lookAt(p.clone().add(tan)); scene.add(m);
  for (let side = -1; side <= 1; side += 2) {
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const pp = p.clone().addScaledVector(n, side * (trackWidth / 2 + 1));
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pillar.position.set(pp.x, p.y + 2, pp.z);
    pillar.castShadow = true;
    scene.add(pillar);
  }
}

function computeTrackBounds(curve, extra) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = curve.getPointAt(i / 200);
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  return {
    minX: minX - extra, maxX: maxX + extra,
    minZ: minZ - extra, maxZ: maxZ + extra,
    cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
    sizeX: maxX - minX + extra * 2, sizeZ: maxZ - minZ + extra * 2,
  };
}
