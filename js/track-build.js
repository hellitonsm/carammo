import * as THREE from 'three';
import {
  getScene,
  getPhysicsWorld,
  setTrackCurve,
  setTrackLength,
  setTrackStartPos,
  setTrackStartDir,
  setTrackWidth,
  setMinimapPath,
  setMinimapBounds,
  getCurrentSceneDef,
} from './state.js';
import { CFG } from './config.js';
import { widthFnFor } from '../scenarios.js';
import {
  buildRibbon,
  buildSegmentedBarrier,
  computeTrackBounds,
} from './track-helpers.js';
import { makeAsphaltTexture, makeGroundTexture } from './textures.js';
import { buildEnvironment } from './track-environment.js';

export function buildTrack(scn) {
  const scene = getScene();
  const physicsWorld = getPhysicsWorld();

  const pts = scn.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  // Ensure closed loop doesn't duplicate last if already same as first
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  const length = curve.getLength();
  const width = scn.trackWidth;
  const wFn = widthFnFor(scn);

  setTrackCurve(curve);
  setTrackLength(length);
  setTrackWidth(width);

  const startPos = curve.getPointAt(0).clone();
  startPos.y += CFG.wheelRadius + 0.6;
  const startDir = curve.getTangentAt(0).clone().normalize();
  setTrackStartPos(startPos);
  setTrackStartDir(startDir);

  const bound = computeTrackBounds(curve, 220);
  setMinimapBounds(bound);

  // Ground under track area
  const worldSize = Math.max(bound.sizeX, bound.sizeZ) + 100;
  const groundTex = makeGroundTexture(scn.groundTex);
  const groundGeo = new THREE.PlaneGeometry(worldSize, worldSize);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    color: scn.groundColor,
    roughness: 0.95,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(bound.cx, -0.05, bound.cz);
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Asphalt ribbon
  const asphaltGeo = buildRibbon(curve, width / 2, 1400, wFn);
  const asphaltTex = makeAsphaltTexture(scn);
  const asphaltMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    color: 0xffffff,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
  asphalt.receiveShadow = true;
  asphalt.castShadow = false;
  scene.add(asphalt);

  // Rumble strips
  const rumbleSegs = 260;
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < rumbleSegs; i++) {
      const t0 = i / rumbleSegs;
      const t1 = (i + 1) / rumbleSegs;
      const p0 = curve.getPointAt(t0);
      const p1 = curve.getPointAt(t1);
      const tan = curve.getTangentAt(t0);
      let nx = -tan.z, nz = tan.x;
      const nlen = Math.hypot(nx, nz) || 1;
      nx /= nlen; nz /= nlen;
      const hw = (width / 2) * (wFn ? wFn(t0) : 1);
      const ox = nx * side * (hw + 0.4);
      const oz = nz * side * (hw + 0.4);
      const col = i % 2 === 0 ? scn.rumbleColorA : scn.rumbleColorB;
      const len = p0.distanceTo(p1);
      const geo = new THREE.BoxGeometry(0.8, 0.06, Math.max(len, 0.2));
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        (p0.x + p1.x) / 2 + ox,
        (p0.y + p1.y) / 2 + 0.04,
        (p0.z + p1.z) / 2 + oz
      );
      mesh.lookAt(p1.x + ox, p1.y + 0.04, p1.z + oz);
      scene.add(mesh);
    }
  }

  // Lane markings (dashed center)
  const dashLen = 2.2;
  const gapLen = 3.2;
  const totalDash = dashLen + gapLen;
  const numDashes = Math.floor(length / totalDash);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x222222 });
  for (let i = 0; i < numDashes; i++) {
    const t = (i * totalDash + dashLen / 2) / length;
    if (t >= 1) break;
    const p = curve.getPointAt(t % 1);
    const tan = curve.getTangentAt(t % 1);
    const geo = new THREE.BoxGeometry(0.18, 0.03, dashLen);
    const mesh = new THREE.Mesh(geo, dashMat);
    mesh.position.set(p.x, p.y + 0.05, p.z);
    mesh.lookAt(p.x + tan.x, p.y + 0.05, p.z + tan.z);
    scene.add(mesh);
  }

  // Side lines
  for (let side = -1; side <= 1; side += 2) {
    const sideGeo = buildRibbon(curve, 0.12, 800, (t) => {
      const hw = (width / 2 - 0.4) * (wFn ? wFn(t) : 1);
      // offset by placing thin ribbon at edge — approximate via wFn override
      return 1;
    });
    // Better approach: offset positions manually
    const positions = [];
    const indices = [];
    const segs = 800;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      let nx = -tan.z, nz = tan.x;
      const nlen = Math.hypot(nx, nz) || 1;
      nx /= nlen; nz /= nlen;
      const hw = (width / 2 - 0.4) * (wFn ? wFn(t) : 1);
      const cx = p.x + nx * side * hw;
      const cz = p.z + nz * side * hw;
      positions.push(cx - nx * 0.1, p.y + 0.04, cz - nz * 0.1);
      positions.push(cx + nx * 0.1, p.y + 0.04, cz + nz * 0.1);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.6 });
    scene.add(new THREE.Mesh(geo, mat));
  }

  // Barriers
  if (scn.hasBarriers) {
    for (let side = -1; side <= 1; side += 2) {
      const barGeo = buildSegmentedBarrier(curve, width / 2 + 0.6, side, 0.6, wFn, 500);
      const barMat = new THREE.MeshStandardMaterial({
        color: scn.barrierColor,
        roughness: 0.5,
        metalness: 0.3,
        side: THREE.DoubleSide,
      });
      scene.add(new THREE.Mesh(barGeo, barMat));

      // Posts every 10u
      const postCount = Math.floor(length / 10);
      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.9, 6);
      const postMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6 });
      for (let i = 0; i < postCount; i++) {
        const t = i / postCount;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t);
        let nx = -tan.z, nz = tan.x;
        const nlen = Math.hypot(nx, nz) || 1;
        nx /= nlen; nz /= nlen;
        const hw = (width / 2 + 0.6) * (wFn ? wFn(t) : 1);
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(p.x + nx * side * hw, p.y + 0.45, p.z + nz * side * hw);
        post.castShadow = true;
        scene.add(post);
      }
    }
  }

  // Collision mesh from asphalt
  addTrackCollision(asphaltGeo, scn.trackFriction, physicsWorld);

  // Flat ground collision plane (fallback so cars don't fall forever near track)
  addGroundPlane(physicsWorld, bound, scn.trackFriction * 0.6);

  // Start line
  const startLineCanvas = document.createElement('canvas');
  startLineCanvas.width = 64;
  startLineCanvas.height = 8;
  const sctx = startLineCanvas.getContext('2d');
  for (let x = 0; x < 64; x += 8) {
    for (let y = 0; y < 8; y += 4) {
      sctx.fillStyle = ((x / 8 + y / 4) % 2 === 0) ? '#fff' : '#111';
      sctx.fillRect(x, y, 8, 4);
    }
  }
  const startTex = new THREE.CanvasTexture(startLineCanvas);
  startTex.colorSpace = THREE.SRGBColorSpace;
  const startGeo = new THREE.BoxGeometry(width, 0.05, 2);
  const startMat = new THREE.MeshStandardMaterial({ map: startTex, roughness: 0.7 });
  const startLine = new THREE.Mesh(startGeo, startMat);
  const sp = curve.getPointAt(0);
  const sd = curve.getTangentAt(0);
  startLine.position.set(sp.x, sp.y + 0.06, sp.z);
  startLine.lookAt(sp.x + sd.x, sp.y + 0.06, sp.z + sd.z);
  scene.add(startLine);

  // Start pillars
  const pillarGeo = new THREE.BoxGeometry(0.3, 1.8, 0.3);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  for (let side = -1; side <= 1; side += 2) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    let nx = -sd.z, nz = sd.x;
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen; nz /= nlen;
    pillar.position.set(sp.x + nx * side * (width / 2 + 0.5), sp.y + 0.9, sp.z + nz * side * (width / 2 + 0.5));
    pillar.castShadow = true;
    scene.add(pillar);
  }

  // Ice patches
  if (scn.hasIcePatches) {
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0xa0d0e8,
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
      metalness: 0.4,
    });
    for (let i = 0; i < 10; i++) {
      const t = (i + 0.5) / 10;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      let nx = -tan.z, nz = tan.x;
      const nlen = Math.hypot(nx, nz) || 1;
      nx /= nlen; nz /= nlen;
      const side = i % 2 === 0 ? 1 : -1;
      const r = 1.5 + Math.random() * 2.5;
      const ice = new THREE.Mesh(new THREE.CircleGeometry(r, 16), iceMat);
      ice.rotation.x = -Math.PI / 2;
      ice.position.set(
        p.x + nx * side * (width * 0.25 + Math.random()),
        p.y + 0.07,
        p.z + nz * side * (width * 0.25 + Math.random())
      );
      scene.add(ice);
    }
  }

  // Environment
  buildEnvironment(scn, curve, bound, wFn);

  // Minimap path
  const miniPts = [];
  for (let i = 0; i <= 140; i++) {
    const p = curve.getPointAt(i / 140);
    miniPts.push({ x: p.x, z: p.z });
  }
  setMinimapPath(miniPts);
}

function addGroundPlane(physicsWorld, bound, friction) {
  // Large thin box as safety ground under the whole track area
  const halfX = Math.max(bound.sizeX, 400) / 2;
  const halfZ = Math.max(bound.sizeZ, 400) / 2;
  const shape = new Ammo.btBoxShape(new Ammo.btVector3(halfX, 0.5, halfZ));
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(bound.cx, -1.0, bound.cz));
  const motionState = new Ammo.btDefaultMotionState(transform);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(
    0,
    motionState,
    shape,
    new Ammo.btVector3(0, 0, 0)
  );
  const body = new Ammo.btRigidBody(rbInfo);
  body.setFriction(friction);
  body.setRestitution(0.0);
  physicsWorld.addRigidBody(body);
}

function addTrackCollision(asphaltGeo, friction, physicsWorld) {
  const posAttr = asphaltGeo.getAttribute('position');
  const index = asphaltGeo.getIndex();
  const mesh = new Ammo.btTriangleMesh(true, true);

  const vA = new Ammo.btVector3();
  const vB = new Ammo.btVector3();
  const vC = new Ammo.btVector3();

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const ia = index.getX(i);
      const ib = index.getX(i + 1);
      const ic = index.getX(i + 2);
      vA.setValue(posAttr.getX(ia), posAttr.getY(ia), posAttr.getZ(ia));
      vB.setValue(posAttr.getX(ib), posAttr.getY(ib), posAttr.getZ(ib));
      vC.setValue(posAttr.getX(ic), posAttr.getY(ic), posAttr.getZ(ic));
      mesh.addTriangle(vA, vB, vC, true);
    }
  } else {
    for (let i = 0; i < posAttr.count; i += 3) {
      vA.setValue(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
      vB.setValue(posAttr.getX(i + 1), posAttr.getY(i + 1), posAttr.getZ(i + 1));
      vC.setValue(posAttr.getX(i + 2), posAttr.getY(i + 2), posAttr.getZ(i + 2));
      mesh.addTriangle(vA, vB, vC, true);
    }
  }

  const shape = new Ammo.btBvhTriangleMeshShape(mesh, true, true);
  const transform = new Ammo.btTransform();
  transform.setIdentity();
  const motionState = new Ammo.btDefaultMotionState(transform);
  const localInertia = new Ammo.btVector3(0, 0, 0);
  const rbInfo = new Ammo.btRigidBodyConstructionInfo(0, motionState, shape, localInertia);
  const body = new Ammo.btRigidBody(rbInfo);
  body.setFriction(friction);
  body.setRestitution(0.1);
  physicsWorld.addRigidBody(body);
}
