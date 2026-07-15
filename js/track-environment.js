// ============================================================================
//  Track environment — trees, rocks, flowers, buildings, terrain features
// ============================================================================

import * as THREE from 'three';
import { scene, trackLength, trackWidth, trackStartPos, snowParticles, setSnowParticles } from './state.js';
import { nearestOnCurve, offsetCurve, buildRibbon } from './track-helpers.js';

export function buildEnvironment(scn, curve, bound, wFn) {
  placeTrees(scn, curve, bound);
  if (scn.hasLamps) placeLamps(scn, curve, wFn);
  if (scn.hasCones) placeCones(scn, curve, wFn);
  if (scn.hasRocks) placeRocks(scn, curve, wFn);

  if (scn.id === 'forest') {
    if (scn.hasFlowers) addFlowers(curve, bound, wFn);
    if (scn.hasSheds) addSheds(curve, bound, wFn);
    if (scn.hasSigns) addSigns(curve);
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
    addFrozenLakes(curve, bound);
  }
  if (scn.snowParticles) createSnowParticles();
}

function placeTrees(scn, curve, bound) {
  let trunkGeo, trunkMat, leafGeo, leafMat;
  const treeType = scn.treeType || 'pine';

  if (treeType === 'cactus') {
    trunkGeo = new THREE.CylinderGeometry(0.5, 0.55, 4, 10);
    trunkMat = new THREE.MeshStandardMaterial({ color: scn.treeTrunkColor ?? 0x5a7a3a, roughness: 0.85 });
    leafGeo = trunkGeo; leafMat = trunkMat;
  } else if (treeType === 'pine-snow') {
    trunkGeo = new THREE.CylinderGeometry(0.28, 0.4, 2.0, 8);
    trunkMat = new THREE.MeshStandardMaterial({ color: scn.treeTrunkColor ?? 0x3a2818, roughness: 0.95 });
    leafGeo = new THREE.ConeGeometry(1.9, 5, 9);
    leafMat = new THREE.MeshStandardMaterial({ color: 0x2a4030, roughness: 0.9 });
  } else {
    trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 1.8, 8);
    trunkMat = new THREE.MeshStandardMaterial({ color: scn.treeTrunkColor ?? 0x6b4423, roughness: 0.9 });
    leafGeo = new THREE.ConeGeometry(1.7, 4.5, 8);
    leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6b2f, roughness: 0.85 });
  }

  const n = scn.treeCount;
  const tMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, n);
  const lMesh = treeType === 'cactus' ? null : new THREE.InstancedMesh(leafGeo, leafMat, n);
  tMesh.castShadow = true;
  if (lMesh) { lMesh.castShadow = true; lMesh.receiveShadow = true; scene.add(lMesh); }
  scene.add(tMesh);

  let armMesh = null, capMesh = null, capMesh2 = null;
  if (treeType === 'cactus') {
    const armGeo = new THREE.CylinderGeometry(0.25, 0.28, 1.6, 8);
    armMesh = new THREE.InstancedMesh(armGeo, trunkMat, n * 2);
    armMesh.castShadow = true; scene.add(armMesh);
  }
  if (treeType === 'pine-snow') {
    const capGeo = new THREE.ConeGeometry(1.5, 1.4, 9);
    const capMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
    capMesh = new THREE.InstancedMesh(capGeo, capMat, n);
    capMesh.castShadow = true; scene.add(capMesh);
    const capGeo2 = new THREE.ConeGeometry(2.2, 0.8, 9);
    capMesh2 = new THREE.InstancedMesh(capGeo2, capMat, n);
    capMesh2.castShadow = true; scene.add(capMesh2);
  }

  const dummy = new THREE.Object3D();
  let placed = 0, armPlaced = 0, attempts = 0;
  const minDist = scn.treeDensity ?? 15;
  while (placed < n && attempts < n * 12) {
    attempts++;
    const x = bound.minX + Math.random() * (bound.maxX - bound.minX);
    const z = bound.minZ + Math.random() * (bound.maxZ - bound.minZ);
    const nr = nearestOnCurve(curve, new THREE.Vector3(x, 0, z));
    if (nr.dist < minDist) continue;
    if (Math.hypot(x - trackStartPos.x, z - trackStartPos.z) < 30) continue;

    const scale = 0.7 + Math.random() * 1.6;
    if (treeType === 'cactus') {
      const th = 4 * scale;
      dummy.position.set(x, th / 2 - 0.45, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(scale * 0.9, scale, scale * 0.9);
      dummy.updateMatrix(); tMesh.setMatrixAt(placed, dummy.matrix);
      const arms = Math.random() < 0.7 ? (Math.random() < 0.5 ? 1 : 2) : 0;
      for (let a = 0; a < arms; a++) {
        const side = a === 0 ? 1 : -1;
        dummy.position.set(x + side * 0.55 * scale, th * 0.5, z);
        dummy.rotation.set(0, 0, side * 0.3);
        dummy.scale.set(scale * 0.7, scale * 0.7, scale * 0.7);
        dummy.updateMatrix();
        if (armPlaced < n * 2) { armMesh.setMatrixAt(armPlaced, dummy.matrix); armPlaced++; }
      }
    } else if (treeType === 'pine-snow') {
      const th = 2.0 * scale;
      dummy.position.set(x, th / 2, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix(); tMesh.setMatrixAt(placed, dummy.matrix);
      const lh = 5 * scale;
      dummy.position.set(x, th + lh / 2 - 0.2, z);
      dummy.updateMatrix(); lMesh.setMatrixAt(placed, dummy.matrix);
      dummy.position.set(x, th + lh - 0.5, z);
      dummy.updateMatrix(); capMesh.setMatrixAt(placed, dummy.matrix);
      dummy.position.set(x, th + lh * 0.45, z);
      dummy.updateMatrix(); capMesh2.setMatrixAt(placed, dummy.matrix);
    } else {
      const th = 1.8 * scale;
      dummy.position.set(x, th / 2 - 0.45, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix(); tMesh.setMatrixAt(placed, dummy.matrix);
      const lh = 4.5 * scale;
      dummy.position.set(x, th + lh / 2 - 0.45, z);
      dummy.updateMatrix(); lMesh.setMatrixAt(placed, dummy.matrix);
    }
    placed++;
  }
  tMesh.count = placed; tMesh.instanceMatrix.needsUpdate = true;
  if (lMesh) { lMesh.count = placed; lMesh.instanceMatrix.needsUpdate = true; }
  if (armMesh) { armMesh.count = armPlaced; armMesh.instanceMatrix.needsUpdate = true; }
  if (capMesh) { capMesh.count = placed; capMesh.instanceMatrix.needsUpdate = true; }
  if (capMesh2) { capMesh2.count = placed; capMesh2.instanceMatrix.needsUpdate = true; }
}

function placeLamps(scn, curve, wFn) {
  const spacing = scn.lampSpacing ?? 35;
  const pG = new THREE.CylinderGeometry(0.1, 0.16, 7.5, 8);
  const pM = new THREE.MeshStandardMaterial({ color: 0x555, roughness: 0.5, metalness: 0.85 });
  const armG = new THREE.BoxGeometry(1.5, 0.1, 0.1);
  const bG = new THREE.SphereGeometry(0.28, 10, 10);
  const bM = new THREE.MeshStandardMaterial({ color: 0xffffcc, emissive: 0xffffaa, emissiveIntensity: 1.3 });
  const pCount = Math.floor(trackLength / spacing);
  for (let i = 0; i < pCount; i++) {
    const t = i / pCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    for (let side = -1; side <= 1; side += 2) {
      const pp = p.clone().addScaledVector(n, side * (trackWidth / 2 + 2.8));
      const pole = new THREE.Mesh(pG, pM);
      pole.position.set(pp.x, p.y + 3.7, pp.z);
      pole.castShadow = true; scene.add(pole);
      const arm = new THREE.Mesh(armG, pM);
      arm.position.set(pp.x - n.x * side * 0.75, p.y + 7.2, pp.z - n.z * side * 0.75);
      arm.rotation.y = Math.atan2(n.x, n.z);
      arm.castShadow = true; scene.add(arm);
      const bulb = new THREE.Mesh(bG, bM);
      bulb.position.set(pp.x - n.x * side * 1.5, p.y + 7.2, pp.z - n.z * side * 1.5);
      scene.add(bulb);
      const pl = new THREE.PointLight(0xffeecc, 0.6, 20, 2);
      pl.position.copy(bulb.position);
      scene.add(pl);
    }
  }
}

function placeCones(scn, curve, wFn) {
  const every = scn.conesEvery ?? 16;
  const cG = new THREE.ConeGeometry(0.24, 0.7, 10);
  const cM = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.55 });
  const sG = new THREE.CylinderGeometry(0.2, 0.22, 0.12, 10);
  const sM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  const cCount = Math.floor(trackLength / every);
  for (let i = 0; i < cCount; i++) {
    const t = i / cCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const w = wFn ? (trackWidth / 2 + 1.4) * wFn(t) : trackWidth / 2 + 1.4;
    const cp = p.clone().addScaledVector(n, side * w);
    const cone = new THREE.Mesh(cG, cM);
    cone.position.set(cp.x, p.y + 0.4, cp.z);
    cone.castShadow = true; scene.add(cone);
    const stripe = new THREE.Mesh(sG, sM);
    stripe.position.set(cp.x, p.y + 0.45, cp.z);
    scene.add(stripe);
  }
}

function placeRocks(scn, curve, wFn) {
  const rCount = scn.rockCount ?? 100;
  const rG = new THREE.DodecahedronGeometry(0.5, 0);
  const rM = new THREE.MeshStandardMaterial({ color: scn.rockColor || 0x7a7a7a, roughness: 0.95 });
  for (let i = 0; i < rCount; i++) {
    const t = Math.random();
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const base = wFn ? (trackWidth / 2 + 2) * wFn(t) : trackWidth / 2 + 2;
    const dist = base + Math.random() * 8;
    const rp = p.clone().addScaledVector(n, side * dist);
    const rock = new THREE.Mesh(rG, rM);
    const s = 0.4 + Math.random() * 2;
    rock.position.set(rp.x, p.y + s * 0.18 - 0.35, rp.z);
    rock.scale.set(s, s * 0.7, s);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true; scene.add(rock);
  }
}

function addFlowers(curve, bound, wFn) {
  const colors = [0xff3366, 0xffffff, 0xffeb3b, 0xe91e63, 0xba68c8];
  for (let c = 0; c < 5; c++) {
    const geo = new THREE.IcosahedronGeometry(0.18, 0);
    const mat = new THREE.MeshStandardMaterial({ color: colors[c % colors.length], roughness: 0.7 });
    const count = 60;
    const im = new THREE.InstancedMesh(geo, mat, count);
    const d = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      let tries = 0;
      while (tries < 20) {
        tries++;
        const x = bound.minX + Math.random() * (bound.maxX - bound.minX);
        const z = bound.minZ + Math.random() * (bound.maxZ - bound.minZ);
        const nr = nearestOnCurve(curve, new THREE.Vector3(x, 0, z));
        if (nr.dist > 10 && nr.dist < 40) {
          d.position.set(x, 0.1, z);
          d.scale.setScalar(0.5 + Math.random() * 0.7);
          d.updateMatrix(); im.setMatrixAt(i, d.matrix); break;
        }
      }
    }
    im.instanceMatrix.needsUpdate = true;
    scene.add(im);
  }
}

function addSheds(curve, bound, wFn) {
  const shedCount = 5;
  for (let i = 0; i < shedCount; i++) {
    const t = (i + 0.4) / shedCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const dist = 25 + Math.random() * 20;
    const pos = p.clone().addScaledVector(n, side * dist);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x8a5a30, roughness: 0.9 })
    );
    body.position.y = 0.55; body.castShadow = true; group.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.8, 1.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x6b2e20, roughness: 0.8 })
    );
    roof.position.y = 2.25; roof.rotation.y = Math.PI / 4; roof.castShadow = true; group.add(roof);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.9 })
    );
    door.position.set(0, 0.6, 1.26); group.add(door);
    group.position.set(pos.x, p.y, pos.z);
    group.rotation.y = Math.random() * Math.PI * 2;
    group.castShadow = true; scene.add(group);
  }
}

function addSigns(curve) {
  const signCount = 8;
  for (let i = 0; i < signCount; i++) {
    const t = (i + 0.2) / signCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const ahead = curve.getPointAt(Math.min(1, t + 0.03));
    const toAhead = new THREE.Vector3().subVectors(ahead, p);
    const cross = tan.x * toAhead.z - tan.z * toAhead.x;
    const side = cross > 0 ? 1 : -1;
    const pos = p.clone().addScaledVector(n, side * (trackWidth / 2 + 3));
    const group = new THREE.Group();
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 2.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x555, metalness: 0.7, roughness: 0.4 })
    );
    post.position.y = 1.1; post.castShadow = true; group.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.9, 0.1),
      new THREE.MeshStandardMaterial({ color: side > 0 ? 0x1565c0 : 0xc62828, roughness: 0.5 })
    );
    board.position.y = 2.2; board.castShadow = true; group.add(board);
    const arrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.35, 3),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    );
    arrow.position.set(0, 2.2, 0.08);
    arrow.rotation.z = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    group.add(arrow);
    group.position.set(pos.x, p.y, pos.z);
    group.lookAt(p.x, p.y, p.z);
    scene.add(group);
  }
}

function addBroadleafTrees(curve, bound) {
  const tG = new THREE.CylinderGeometry(0.25, 0.4, 2.2, 6);
  const tM = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.95 });
  const lG = new THREE.IcosahedronGeometry(1.6, 1);
  const lM = new THREE.MeshStandardMaterial({ color: 0x3a8a2a, roughness: 0.85 });
  const count = 60;
  const iT = new THREE.InstancedMesh(tG, tM, count);
  const iL = new THREE.InstancedMesh(lG, lM, count * 2);
  scene.add(iT); scene.add(iL);
  const d = new THREE.Object3D();
  let tp = 0, lp = 0;
  for (let i = 0; i < count; i++) {
    let tries = 0;
    while (tries < 20) {
      tries++;
      const x = bound.minX + Math.random() * (bound.maxX - bound.minX);
      const z = bound.minZ + Math.random() * (bound.maxZ - bound.minZ);
      const nr = nearestOnCurve(curve, new THREE.Vector3(x, 0, z));
      if (nr.dist > 20 && nr.dist < 80) {
        const s = 0.8 + Math.random() * 1.1;
        d.position.set(x, 1.1 * s, z); d.scale.set(s, s, s); d.rotation.y = Math.random() * Math.PI * 2;
        d.updateMatrix(); iT.setMatrixAt(tp++, d.matrix);
        for (let k = 0; k < 2; k++) {
          d.position.set(x + (Math.random() - 0.5) * 1.2, 2.2 * s + Math.random() * 0.5, z + (Math.random() - 0.5) * 1.2);
          d.scale.set(s * (0.8 + Math.random() * 0.4), s * (0.8 + Math.random() * 0.4), s * (0.8 + Math.random() * 0.4));
          d.updateMatrix(); if (lp < count * 2) { iL.setMatrixAt(lp++, d.matrix); }
        }
        break;
      }
    }
  }
  iT.count = tp; iL.count = lp;
  iT.instanceMatrix.needsUpdate = true; iL.instanceMatrix.needsUpdate = true;
}

function addDunes(curve, wFn) {
  const dM = new THREE.MeshStandardMaterial({ color: 0xc8923a, roughness: 1 });
  const minDist = trackWidth / 2 + 12;
  for (let i = 0; i < 38; i++) {
    const t = Math.random(); const p = curve.getPointAt(t);
    const nr = nearestOnCurve(curve, p);
    if (nr.dist < minDist) continue;
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const dist = 38 + Math.random() * 75;
    const dp = p.clone().addScaledVector(n, side * dist);
    const dpNr = nearestOnCurve(curve, dp);
    if (dpNr.dist < minDist) continue;
    const dune = new THREE.Mesh(
      new THREE.SphereGeometry(9 + Math.random() * 11, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), dM);
    dune.position.set(dp.x, p.y - 3.2, dp.z);
    dune.scale.y = 0.28 + Math.random() * 0.22;
    dune.receiveShadow = true; scene.add(dune);
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
    const mainWall = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 28), wallMat);
    mainWall.position.set(0, 10, 0);
    mainWall.castShadow = true; mainWall.receiveShadow = true; wallGroup.add(mainWall);
    const topRock = new THREE.Mesh(new THREE.DodecahedronGeometry(6, 1), rockMat);
    topRock.position.set(0, 22, 0);
    topRock.scale.set(1.2, 0.7, 1.0); topRock.castShadow = true; wallGroup.add(topRock);
    for (let i = 0; i < 8; i++) {
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + Math.random() * 2.5, 0), rockMat);
      boulder.position.set((Math.random() - 0.5) * 16, Math.random() * 8, (Math.random() - 0.5) * 24);
      boulder.rotation.set(Math.random(), Math.random(), Math.random());
      boulder.castShadow = true; wallGroup.add(boulder);
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
  arch.castShadow = true; scene.add(arch);
  const cliffMat = new THREE.MeshStandardMaterial({ color: 0x9a6a38, roughness: 0.95 });
  for (let i = 0; i < 12; i++) {
    const t2 = canyonT + (i - 6) * 0.008;
    const p2 = curve.getPointAt(Math.max(0.01, Math.min(0.99, t2)));
    const tan2 = curve.getTangentAt(Math.max(0.01, Math.min(0.99, t2)));
    const n2 = new THREE.Vector3(-tan2.z, 0, tan2.x).normalize();
    for (let side = -1; side <= 1; side += 2) {
      const cliff = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + Math.random() * 3, 0), cliffMat);
      const dist = trackWidth / 2 + 3 + Math.random() * 5;
      const cp = p2.clone().addScaledVector(n2, side * dist);
      cliff.position.set(cp.x, p2.y + Math.random() * 4, cp.z);
      cliff.rotation.set(Math.random(), Math.random(), Math.random());
      cliff.scale.set(1, 0.6 + Math.random() * 0.8, 1);
      cliff.castShadow = true; scene.add(cliff);
    }
  }
}

function addBarrels(curve, wFn) {
  const bG = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 10);
  const bM = new THREE.MeshStandardMaterial({ color: 0xb04020, roughness: 0.5, metalness: 0.3 });
  const ringG = new THREE.TorusGeometry(0.38, 0.03, 6, 12);
  const ringM = new THREE.MeshStandardMaterial({ color: 0x888, metalness: 0.7, roughness: 0.3 });
  const count = 25;
  for (let i = 0; i < count; i++) {
    const t = Math.random(); const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const base = wFn ? (trackWidth / 2 + 2) * wFn(t) : trackWidth / 2 + 2;
    const dist = base + 2 + Math.random() * 4;
    const bp = p.clone().addScaledVector(n, side * dist);
    const barrel = new THREE.Mesh(bG, bM);
    barrel.position.set(bp.x, p.y + 0.5, bp.z);
    barrel.rotation.z = (Math.random() - 0.5) * 0.3;
    barrel.castShadow = true; scene.add(barrel);
    for (let r = 0; r < 2; r++) {
      const ring = new THREE.Mesh(ringG, ringM);
      ring.position.set(bp.x, p.y + 0.2 + r * 0.5, bp.z);
      ring.rotation.x = Math.PI / 2; scene.add(ring);
    }
  }
}

function addTumbleweeds(curve, bound, wFn) {
  const g = new THREE.IcosahedronGeometry(0.4, 0);
  const m = new THREE.MeshStandardMaterial({ color: 0x8a6a38, wireframe: true, roughness: 1 });
  const count = 20;
  for (let i = 0; i < count; i++) {
    const t = Math.random(); const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const base = wFn ? (trackWidth / 2 + 2) * wFn(t) : trackWidth / 2 + 2;
    const dist = base + 3 + Math.random() * 8;
    const pp = p.clone().addScaledVector(n, side * dist);
    const tw = new THREE.Mesh(g, m);
    tw.position.set(pp.x, p.y + 0.4, pp.z);
    tw.castShadow = true; scene.add(tw);
  }
}

function addSnowPiles(curve, wFn) {
  const count = 50;
  const g = new THREE.SphereGeometry(1, 10, 8);
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
  for (let i = 0; i < count; i++) {
    const t = Math.random(); const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = Math.random() > 0.5 ? 1 : -1;
    const base = wFn ? (trackWidth / 2 + 1) * wFn(t) : trackWidth / 2 + 1;
    const dist = base + Math.random() * 6;
    const pp = p.clone().addScaledVector(n, side * dist);
    const s = 0.6 + Math.random() * 1.4;
    const pile = new THREE.Mesh(g, m);
    pile.position.set(pp.x, p.y + s * 0.4 - 0.1, pp.z);
    pile.scale.set(s * 1.2, s * 0.6, s * 1.2);
    pile.castShadow = true; pile.receiveShadow = true; scene.add(pile);
  }
}

function addSnowmen(curve, wFn) {
  const count = 6;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.3) / count; const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const side = i % 2 === 0 ? 1 : -1;
    const base = wFn ? (trackWidth / 2 + 2) * wFn(t) : trackWidth / 2 + 2;
    const dist = base + 3 + Math.random() * 3;
    const pp = p.clone().addScaledVector(n, side * dist);
    const group = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const black = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
    const red = new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.6 });
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), white);
    bottom.position.y = 0.6; bottom.castShadow = true; group.add(bottom);
    const mid = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), white);
    mid.position.y = 1.4; mid.castShadow = true; group.add(mid);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), white);
    head.position.y = 2.05; head.castShadow = true; group.add(head);
    for (let k = 0; k < 3; k++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), black);
      btn.position.set(0, 1.25 + k * 0.2, 0.4); group.add(btn);
    }
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), black); eyeL.position.set(-0.1, 2.1, 0.27); group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), black); eyeR.position.set(0.1, 2.1, 0.27); group.add(eyeR);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 8), new THREE.MeshStandardMaterial({ color: 0xff7020, roughness: 0.6 }));
    nose.position.set(0, 2.0, 0.4); nose.rotation.x = Math.PI / 2; group.add(nose);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 12), black); brim.position.y = 2.35; group.add(brim);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), black); hat.position.y = 2.52; group.add(hat);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 12), red); scarf.position.y = 1.72; scarf.rotation.x = Math.PI / 2; group.add(scarf);
    group.position.set(pp.x, p.y, pp.z);
    group.castShadow = true; scene.add(group);
  }
}

function addSnowTracks(curve, wFn) {
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xb8c8d4, roughness: 0.8 });
  const left = offsetCurve(curve, trackWidth / 2 + 2, false, wFn);
  const right = offsetCurve(curve, trackWidth / 2 + 2, true, wFn);
  const gL = buildRibbon(left, 1.2, 600);
  const gR = buildRibbon(right, 1.2, 600);
  const mL = new THREE.Mesh(gL, edgeMat); mL.receiveShadow = true; scene.add(mL);
  const mR = new THREE.Mesh(gR, edgeMat); mR.receiveShadow = true; scene.add(mR);
}

function addBridge(curve, wFn) {
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.6, metalness: 0.4 });
  const railMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.5, metalness: 0.6 });
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x667788, roughness: 0.7, metalness: 0.3 });
  const bridgeStart = 0.45, bridgeEnd = 0.6, segs = 40;
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
    pos.push(L.x, L.y - 0.3, L.z); pos.push(R.x, R.y - 0.3, R.z);
    uv.push(0, (t - bridgeStart) * 200); uv.push(1, (t - bridgeStart) * 200);
    posTop.push(L.x, L.y + 0.1, L.z); posTop.push(R.x, R.y + 0.1, R.z);
    uvTop.push(0, (t - bridgeStart) * 200); uvTop.push(1, (t - bridgeStart) * 200);
    if (i < segs) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push(a, c, b, b, c, d); idxTop.push(a, c, b, b, c, d);
    }
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  roadGeo.setIndex(idx); roadGeo.computeVertexNormals();
  const road = new THREE.Mesh(roadGeo, bridgeMat); road.receiveShadow = true; road.castShadow = true; scene.add(road);
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(posTop, 3));
  roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvTop, 2));
  roofGeo.setIndex(idxTop); roofGeo.computeVertexNormals();
  const roof = new THREE.Mesh(roofGeo, bridgeMat); roof.receiveShadow = true; scene.add(roof);
  const sideGeo = new THREE.BufferGeometry();
  const sidePos = [], sideIdx = [], sideUv = [];
  for (let i = 0; i <= segs; i++) {
    const t = bridgeStart + (i / segs) * (bridgeEnd - bridgeStart);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? (trackWidth / 2 + 0.5) * wFn(t) : trackWidth / 2 + 0.5;
    for (let side = -1; side <= 1; side += 2) {
      const bx = p.x + n.x * side * w, bz = p.z + n.z * side * w;
      sidePos.push(bx, p.y - 0.3, bz); sidePos.push(bx, p.y + 0.6, bz);
      sideUv.push(0, (t - bridgeStart) * 200); sideUv.push(1, (t - bridgeStart) * 200);
    }
    if (i < segs) {
      const base = i * 4;
      sideIdx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      sideIdx.push(base + 1, base + 3, base + 5, base + 5, base + 3, base + 7);
    }
  }
  sideGeo.setAttribute('position', new THREE.Float32BufferAttribute(sidePos, 3));
  sideGeo.setAttribute('uv', new THREE.Float32BufferAttribute(sideUv, 2));
  sideGeo.setIndex(sideIdx); sideGeo.computeVertexNormals();
  const sideMesh = new THREE.Mesh(sideGeo, railMat); sideMesh.castShadow = true; scene.add(sideMesh);
  const pillarCount = 6;
  for (let i = 0; i <= pillarCount; i++) {
    const t = bridgeStart + (i / pillarCount) * (bridgeEnd - bridgeStart);
    const p = curve.getPointAt(t);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 12, 8), pillarMat);
    pillar.position.set(p.x, p.y - 6, p.z); pillar.castShadow = true; scene.add(pillar);
  }
}

function addFrozenLakes(curve, bound) {
  const lakeMat = new THREE.MeshStandardMaterial({ color: 0x8abed6, roughness: 0.1, metalness: 0.4, transparent: true, opacity: 0.75 });
  for (let i = 0; i < 3; i++) {
    const x = bound.minX + Math.random() * (bound.maxX - bound.minX);
    const z = bound.minZ + Math.random() * (bound.maxZ - bound.minZ);
    const nr = nearestOnCurve(curve, new THREE.Vector3(x, 0, z));
    if (nr.dist < 40) continue;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(15 + Math.random() * 20, 24), lakeMat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(x, 0.02, z); lake.receiveShadow = true; scene.add(lake);
  }
}

function createSnowParticles() {
  if (snowParticles) return;
  const count = 3000;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 400;
    pos[i * 3 + 1] = Math.random() * 50;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 400;
    vel.push(0.5 + Math.random() * 1.5);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4, transparent: true, opacity: 0.7, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.userData.vel = vel;
  scene.add(pts);
  setSnowParticles(pts);
}
