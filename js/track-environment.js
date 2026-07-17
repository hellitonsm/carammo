import * as THREE from 'three';
import {
  getScene,
  setSnowParticles,
  getSnowParticles as getSnowParticlesRef,
  getPlayerVehicle,
} from './state.js';
import { nearestOnCurve, clearanceFromTrack } from './track-helpers.js';

/**
 * Shared placement helper: sample along the track, offset outward by a
 * distance that clears the asphalt + margin. Rejects if still too close
 * (e.g. near hairpins where both sides of the ribbon approach).
 */
function sampleOutside(curve, scn, wFn, minClear, maxClear, opts = {}) {
  const startP = curve.getPointAt(0);
  const avoidStart = opts.avoidStart ?? 35;
  const maxAttempts = opts.maxAttempts ?? 40;
  for (let a = 0; a < maxAttempts; a++) {
    const t = opts.t != null ? opts.t : Math.random();
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    let nx = -tan.z, nz = tan.x;
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen; nz /= nlen;
    const side = opts.side != null ? opts.side : (Math.random() < 0.5 ? 1 : -1);
    const half = (scn.trackWidth / 2) * (wFn ? wFn(t) : 1);
    const dist = half + minClear + Math.random() * Math.max(0.1, maxClear - minClear);
    const x = p.x + nx * side * dist;
    const z = p.z + nz * side * dist;
    if (Math.hypot(x - startP.x, z - startP.z) < avoidStart) continue;
    // Verify global clearance (handles pinch points / elevated overpasses in XZ)
    const clear = clearanceFromTrack(curve, x, z, scn.trackWidth, wFn);
    if (clear < minClear * 0.85) continue;
    return { x, y: p.y, z, t, side, nx, nz, tan, clear };
  }
  return null;
}

export function buildEnvironment(scn, curve, bound, wFn) {
  placeTrees(scn, curve, wFn);
  if (scn.hasLamps) placeLamps(scn, curve, wFn);
  if (scn.hasCones) placeCones(scn, curve, wFn);
  if (scn.hasRocks) placeRocks(scn, curve, wFn);

  if (scn.id === 'forest') {
    addFlowers(curve, scn, wFn);
    addSheds(curve, scn, wFn);
    addSigns(curve, scn, wFn);
    addBroadleafTrees(curve, scn, wFn);
  } else if (scn.id === 'desert') {
    addDunes(curve, scn, wFn);
    addCanyon(curve, scn, wFn);
    addBarrels(curve, scn, wFn);
    addTumbleweeds(curve, scn, wFn);
  } else if (scn.id === 'snow') {
    addSnowPiles(curve, scn, wFn);
    addSnowmen(curve, scn, wFn);
    addSnowTracks(curve, wFn, scn);
    addBridge(curve, scn, wFn);
    addFrozenLakes(curve, scn, wFn);
    if (scn.snowParticles) createSnowParticles();
  } else if (scn.id === 'coast') {
    addDunes(curve, scn, wFn);
    addSigns(curve, scn, wFn);
    addPier(curve, scn, wFn);
    addBoats(curve, scn, wFn);
  } else if (scn.id === 'city') {
    addBuildings(curve, scn, wFn);
    addBillboards(curve, scn, wFn);
    addSigns(curve, scn, wFn);
  }
}

function placeTrees(scn, curve, wFn) {
  const scene = getScene();
  if (!scn.treeType || !scn.treeCount) return;
  const count = scn.treeCount || 50;
  // Keep foliage well clear of the racing line
  const minClear = Math.max(scn.treeDensity || 14, scn.trackWidth / 2 + 6);

  if (scn.treeType === 'pine' || scn.treeType === 'pine-snow') {
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 1.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 });
    const leafGeo = new THREE.ConeGeometry(1.2, 3.5, 7);
    const leafMat = new THREE.MeshStandardMaterial({
      color: scn.treeType === 'pine-snow' ? 0x1a3a1a : 0x2d6a2d,
      roughness: 0.85,
    });
    const snowCapGeo = new THREE.ConeGeometry(1.0, 1.2, 7);
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.9 });

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count);
    let snowMesh = null;
    let snowMesh2 = null;
    if (scn.treeType === 'pine-snow') {
      snowMesh = new THREE.InstancedMesh(snowCapGeo, snowCapMat, count);
      snowMesh2 = new THREE.InstancedMesh(new THREE.ConeGeometry(0.6, 0.7, 7), snowCapMat, count);
    }

    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 25) {
      attempts++;
      const s = sampleOutside(curve, scn, wFn, minClear, minClear + 55);
      if (!s) continue;
      const scale = 0.7 + Math.random() * 1.6;
      dummy.position.set(s.x, s.y, s.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(s.x, s.y + 2.0 * scale, s.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      leafMesh.setMatrixAt(placed, dummy.matrix);

      if (snowMesh) {
        dummy.position.set(s.x, s.y + 3.2 * scale, s.z);
        dummy.scale.set(scale * 0.9, scale * 0.5, scale * 0.9);
        dummy.updateMatrix();
        snowMesh.setMatrixAt(placed, dummy.matrix);
        dummy.position.set(s.x, s.y + 3.8 * scale, s.z);
        dummy.scale.set(scale * 0.5, scale * 0.35, scale * 0.5);
        dummy.updateMatrix();
        snowMesh2.setMatrixAt(placed, dummy.matrix);
      }
      placed++;
    }
    trunkMesh.count = placed;
    leafMesh.count = placed;
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = leafMesh.castShadow = true;
    scene.add(trunkMesh, leafMesh);
    if (snowMesh) {
      snowMesh.count = placed;
      snowMesh2.count = placed;
      snowMesh.instanceMatrix.needsUpdate = true;
      snowMesh2.instanceMatrix.needsUpdate = true;
      scene.add(snowMesh, snowMesh2);
    }
  } else if (scn.treeType === 'palm') {
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 4.5, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
    const leafGeo = new THREE.ConeGeometry(0.15, 2.2, 5);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d8a3a, roughness: 0.8 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, count * 6);
    const dummy = new THREE.Object3D();
    let placed = 0;
    let leafIdx = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 20) {
      attempts++;
      const s = sampleOutside(curve, scn, wFn, minClear, minClear + 50);
      if (!s) continue;
      const scale = 0.8 + Math.random() * 1.4;
      dummy.position.set(s.x, s.y + 2.25 * scale, s.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(placed, dummy.matrix);
      for (let L = 0; L < 6 && leafIdx < count * 6; L++) {
        const ang = (L / 6) * Math.PI * 2;
        dummy.position.set(
          s.x + Math.cos(ang) * 0.4 * scale,
          s.y + 4.3 * scale,
          s.z + Math.sin(ang) * 0.4 * scale
        );
        dummy.scale.set(scale * 0.9, scale * 0.7, scale * 0.9);
        dummy.rotation.set(0.9, ang, 0);
        dummy.updateMatrix();
        leafMesh.setMatrixAt(leafIdx++, dummy.matrix);
      }
      placed++;
    }
    trunkMesh.count = placed;
    leafMesh.count = leafIdx;
    trunkMesh.instanceMatrix.needsUpdate = true;
    leafMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true;
    scene.add(trunkMesh, leafMesh);
  } else if (scn.treeType === 'cactus') {
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.5, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2d7a3a, roughness: 0.8 });
    const bodyMesh = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    const armGeo = new THREE.CylinderGeometry(0.12, 0.14, 1.0, 6);
    const armMesh = new THREE.InstancedMesh(armGeo, bodyMat, count * 2);
    const dummy = new THREE.Object3D();
    let placed = 0;
    let armIdx = 0;
    let attempts = 0;
    while (placed < count && attempts < count * 20) {
      attempts++;
      const s = sampleOutside(curve, scn, wFn, minClear, minClear + 60);
      if (!s) continue;
      const scale = 0.7 + Math.random() * 1.5;
      dummy.position.set(s.x, s.y + 1.25 * scale, s.z);
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.updateMatrix();
      bodyMesh.setMatrixAt(placed, dummy.matrix);

      const arms = Math.floor(Math.random() * 3);
      for (let a = 0; a < arms && armIdx < count * 2; a++) {
        dummy.position.set(
          s.x + (a === 0 ? 0.4 : -0.4) * scale,
          s.y + (1.5 + a * 0.3) * scale,
          s.z
        );
        dummy.scale.set(scale * 0.8, scale * 0.6, scale * 0.8);
        dummy.rotation.z = (a === 0 ? 1 : -1) * 0.6;
        dummy.updateMatrix();
        armMesh.setMatrixAt(armIdx++, dummy.matrix);
      }
      placed++;
    }
    bodyMesh.count = placed;
    bodyMesh.instanceMatrix.needsUpdate = true;
    armMesh.count = armIdx;
    armMesh.instanceMatrix.needsUpdate = true;
    bodyMesh.castShadow = true;
    scene.add(bodyMesh, armMesh);
  }
}

function placeLamps(scn, curve, wFn) {
  const scene = getScene();
  const spacing = scn.lampSpacing || 32;
  const length = curve.getLength();
  const count = Math.floor(length / spacing);
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 3.5, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333340, metalness: 0.7 });
  const armGeo = new THREE.BoxGeometry(1.2, 0.08, 0.08);
  const bulbGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffeeaa,
    emissive: 0xffdd88,
    emissiveIntensity: 1.5,
  });

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const side = i % 2 === 0 ? 1 : -1;
    // Lamps sit just outside the ribbon edge
    const s = sampleOutside(curve, scn, wFn, 1.5, 2.5, { t, side, maxAttempts: 8, avoidStart: 20 });
    if (!s) continue;

    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(s.x, s.y + 1.75, s.z);
    pole.castShadow = true;
    scene.add(pole);

    // Arm points toward the track (inward = -side * normal)
    const inwardX = -s.nx * s.side;
    const inwardZ = -s.nz * s.side;
    const arm = new THREE.Mesh(armGeo, poleMat);
    arm.position.set(s.x + inwardX * 0.7, s.y + 3.4, s.z + inwardZ * 0.7);
    scene.add(arm);

    const bulb = new THREE.Mesh(bulbGeo, bulbMat);
    bulb.position.set(s.x + inwardX * 1.3, s.y + 3.2, s.z + inwardZ * 1.3);
    scene.add(bulb);

    if (i % 3 === 0) {
      const light = new THREE.PointLight(0xffeeaa, 0.5, 18, 2);
      light.position.copy(bulb.position);
      scene.add(light);
    }
  }
}

function placeCones(scn, curve, wFn) {
  const scene = getScene();
  const every = scn.conesEvery || 16;
  const length = curve.getLength();
  const count = Math.floor(length / every);
  const coneGeo = new THREE.ConeGeometry(0.25, 0.7, 8);
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.6 });
  const stripeGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.1, 8);
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

  for (let i = 0; i < count; i++) {
    const t = i / count;
    const side = i % 2 === 0 ? 1 : -1;
    // On the shoulder, just outside asphalt
    const s = sampleOutside(curve, scn, wFn, 0.6, 1.2, { t, side, maxAttempts: 6, avoidStart: 12 });
    if (!s) continue;
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.set(s.x, s.y + 0.35, s.z);
    cone.castShadow = true;
    scene.add(cone);
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(s.x, s.y + 0.35, s.z);
    scene.add(stripe);
  }
}

function placeRocks(scn, curve, wFn) {
  const scene = getScene();
  const count = scn.rockCount || 100;
  const geo = new THREE.DodecahedronGeometry(1, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: scn.rockColor || 0x6a6a6a,
    roughness: 0.95,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const dummy = new THREE.Object3D();
  const minClear = scn.trackWidth / 2 + 5;
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 20) {
    attempts++;
    const s = sampleOutside(curve, scn, wFn, minClear, minClear + 45);
    if (!s) continue;
    const scale = 0.4 + Math.random() * 2.0;
    // Extra reject if rock radius would reach asphalt
    if (s.clear < scale + 1.5) continue;
    dummy.position.set(s.x, s.y - 0.1, s.z);
    dummy.scale.set(scale, scale * 0.7, scale);
    dummy.rotation.set(Math.random(), Math.random(), Math.random());
    dummy.updateMatrix();
    mesh.setMatrixAt(placed++, dummy.matrix);
  }
  mesh.count = placed;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function addFlowers(curve, scn, wFn) {
  const scene = getScene();
  const colors = [0xff4488, 0xffee44, 0xff8844, 0x4488ff, 0xee44ff];
  const minClear = scn.trackWidth / 2 + 4;
  for (const col of colors) {
    const geo = new THREE.IcosahedronGeometry(0.15, 0);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 });
    const mesh = new THREE.InstancedMesh(geo, mat, 60);
    const dummy = new THREE.Object3D();
    let placed = 0;
    for (let i = 0; i < 120 && placed < 60; i++) {
      const s = sampleOutside(curve, scn, wFn, minClear, minClear + 30, { maxAttempts: 6 });
      if (!s) continue;
      dummy.position.set(s.x, s.y + 0.15, s.z);
      dummy.scale.setScalar(0.5 + Math.random());
      dummy.updateMatrix();
      mesh.setMatrixAt(placed++, dummy.matrix);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
  }
}

function addSheds(curve, scn, wFn) {
  const scene = getScene();
  const minClear = scn.trackWidth / 2 + 14;
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5;
    const side = i % 2 === 0 ? 1 : -1;
    const s = sampleOutside(curve, scn, wFn, minClear, minClear + 18, {
      t, side, maxAttempts: 20, avoidStart: 40,
    });
    if (!s) continue;
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.5, 5),
      new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 })
    );
    body.position.y = 1.25;
    g.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 1.5, 4),
      new THREE.MeshStandardMaterial({ color: 0x6b3410, roughness: 0.85 })
    );
    roof.position.y = 3.2;
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1.8, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x3a2010 })
    );
    door.position.set(0, 0.9, 2.55);
    g.add(door);
    g.position.set(s.x, s.y, s.z);
    g.rotation.y = Math.atan2(s.tan.x, s.tan.z);
    scene.add(g);
  }
}

function addSigns(curve, scn, wFn) {
  const scene = getScene();
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.3) / 8;
    const tan = curve.getTangentAt(t);
    const t2 = (t + 0.05) % 1;
    const tan2 = curve.getTangentAt(t2);
    const cross = tan.x * tan2.z - tan.z * tan2.x;
    const isRight = cross < 0;
    const side = 1;
    const s = sampleOutside(curve, scn, wFn, 2.5, 4, { t, side, maxAttempts: 10, avoidStart: 15 });
    if (!s) continue;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5 })
    );
    post.position.set(s.x, s.y + 0.75, s.z);
    scene.add(post);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.8, 0.08),
      new THREE.MeshStandardMaterial({
        color: isRight ? 0x2266cc : 0xcc2222,
        roughness: 0.5,
      })
    );
    board.position.set(s.x, s.y + 1.3, s.z);
    const p = curve.getPointAt(t);
    board.lookAt(p.x, s.y + 1.3, p.z);
    scene.add(board);
  }
}

function addBroadleafTrees(curve, scn, wFn) {
  const scene = getScene();
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 3, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a20, roughness: 0.9 });
  const leafGeo = new THREE.IcosahedronGeometry(1.8, 1);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a8a3a, roughness: 0.85 });
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, 60);
  const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, 120);
  const dummy = new THREE.Object3D();
  const minClear = scn.trackWidth / 2 + 10;
  let placed = 0;
  for (let i = 0; i < 150 && placed < 60; i++) {
    const s = sampleOutside(curve, scn, wFn, minClear, minClear + 40, { maxAttempts: 6 });
    if (!s) continue;
    const scale = 0.8 + Math.random() * 1.2;
    dummy.position.set(s.x, s.y + 1.5 * scale, s.z);
    dummy.scale.set(scale, scale, scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(placed, dummy.matrix);
    for (let j = 0; j < 2; j++) {
      dummy.position.set(s.x + (j - 0.5) * 0.5, s.y + (3.5 + j * 0.8) * scale, s.z);
      dummy.scale.setScalar(scale * (1.0 - j * 0.2));
      dummy.updateMatrix();
      leafMesh.setMatrixAt(placed * 2 + j, dummy.matrix);
    }
    placed++;
  }
  trunkMesh.count = placed;
  leafMesh.count = placed * 2;
  trunkMesh.instanceMatrix.needsUpdate = true;
  leafMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = leafMesh.castShadow = true;
  scene.add(trunkMesh, leafMesh);
}

function addDunes(curve, scn, wFn) {
  const scene = getScene();
  const count = 38;
  const geo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd8a865, roughness: 0.95 });
  let placed = 0;
  for (let i = 0; i < count * 4 && placed < count; i++) {
    const s = sampleOutside(curve, scn, wFn, 22, 80, { maxAttempts: 8 });
    if (!s) continue;
    const scale = 6 + Math.random() * 14;
    // Dune radius (xz) must stay off track
    if (s.clear < scale * 0.7) continue;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, s.y - 0.5, s.z);
    m.scale.set(scale, scale * (0.28 + Math.random() * 0.22), scale);
    m.receiveShadow = true;
    scene.add(m);
    placed++;
  }
}

function addCanyon(curve, scn, wFn) {
  const scene = getScene();
  const rockMat = new THREE.MeshStandardMaterial({ color: 0xa06838, roughness: 0.9 });

  // Two canyon walls well outside the track at t≈0.35
  for (let side = -1; side <= 1; side += 2) {
    const s = sampleOutside(curve, scn, wFn, 28, 36, {
      t: 0.35, side, maxAttempts: 12, avoidStart: 20,
    });
    if (!s) continue;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(18, 22, 28), rockMat);
    wall.position.set(s.x, s.y + 8, s.z);
    wall.castShadow = true;
    scene.add(wall);
    const top = new THREE.Mesh(new THREE.DodecahedronGeometry(6, 0), rockMat);
    top.position.set(s.x, s.y + 20, s.z);
    scene.add(top);
    for (let b = 0; b < 8; b++) {
      const boulder = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.5 + Math.random(), 0),
        rockMat
      );
      const bx = s.x + (Math.random() - 0.5) * 16;
      const bz = s.z + (Math.random() - 0.5) * 16;
      if (clearanceFromTrack(curve, bx, bz, scn.trackWidth, wFn) < 8) continue;
      boulder.position.set(bx, s.y + Math.random() * 5, bz);
      scene.add(boulder);
    }
  }

  // Decorative rock arch OFF the racing line (beside track, not over it)
  const archS = sampleOutside(curve, scn, wFn, 18, 26, {
    t: 0.55, side: 1, maxAttempts: 12, avoidStart: 25,
  });
  if (archS) {
    const arch = new THREE.Mesh(
      new THREE.TorusGeometry(8, 1.6, 8, 16, Math.PI),
      rockMat
    );
    arch.position.set(archS.x, archS.y + 1.5, archS.z);
    arch.rotation.x = Math.PI / 2;
    arch.rotation.z = Math.atan2(archS.tan.x, archS.tan.z);
    scene.add(arch);
  }

  // Cliffs far from asphalt
  let cliffs = 0;
  for (let i = 0; i < 40 && cliffs < 12; i++) {
    const s = sampleOutside(curve, scn, wFn, 24, 50, { maxAttempts: 6 });
    if (!s) continue;
    const sx = 8 + Math.random() * 10;
    const sz = 6 + Math.random() * 8;
    if (s.clear < Math.max(sx, sz) * 0.6) continue;
    const cliff = new THREE.Mesh(
      new THREE.BoxGeometry(sx, 10 + Math.random() * 15, sz),
      rockMat
    );
    cliff.position.set(s.x, s.y + 5, s.z);
    cliff.rotation.y = Math.random() * Math.PI;
    scene.add(cliff);
    cliffs++;
  }
}

function addBarrels(curve, scn, wFn) {
  const scene = getScene();
  const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.0, 12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, metalness: 0.4, roughness: 0.5 });
  const ringGeo = new THREE.TorusGeometry(0.42, 0.04, 6, 12);
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7 });
  let placed = 0;
  for (let i = 0; i < 80 && placed < 25; i++) {
    const s = sampleOutside(curve, scn, wFn, 3, 14, { maxAttempts: 6, avoidStart: 18 });
    if (!s) continue;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(bodyGeo, bodyMat));
    const r1 = new THREE.Mesh(ringGeo, ringMat);
    r1.rotation.x = Math.PI / 2;
    r1.position.y = 0.3;
    g.add(r1);
    const r2 = r1.clone();
    r2.position.y = -0.3;
    g.add(r2);
    g.position.set(s.x, s.y + 0.5, s.z);
    g.rotation.y = Math.random() * Math.PI;
    scene.add(g);
    placed++;
  }
}

function addTumbleweeds(curve, scn, wFn) {
  const scene = getScene();
  const geo = new THREE.IcosahedronGeometry(0.8, 1);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8b6914,
    wireframe: true,
    roughness: 0.9,
  });
  let placed = 0;
  for (let i = 0; i < 50 && placed < 20; i++) {
    const s = sampleOutside(curve, scn, wFn, 4, 22, { maxAttempts: 6 });
    if (!s) continue;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, s.y + 0.8, s.z);
    m.scale.setScalar(0.6 + Math.random() * 0.8);
    scene.add(m);
    placed++;
  }
}

function addSnowPiles(curve, scn, wFn) {
  const scene = getScene();
  const geo = new THREE.SphereGeometry(1, 10, 8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.9 });
  let placed = 0;
  for (let i = 0; i < 120 && placed < 50; i++) {
    const s = sampleOutside(curve, scn, wFn, 3, 16, { maxAttempts: 6 });
    if (!s) continue;
    const scale = 1 + Math.random() * 3;
    if (s.clear < scale * 0.6) continue;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(s.x, s.y + 0.1, s.z);
    m.scale.set(scale, scale * 0.4, scale);
    scene.add(m);
    placed++;
  }
}

function addSnowmen(curve, scn, wFn) {
  const scene = getScene();
  for (let i = 0; i < 6; i++) {
    const t = (i + 0.5) / 6;
    const side = i % 2 === 0 ? 1 : -1;
    const s = sampleOutside(curve, scn, wFn, 6, 12, {
      t, side, maxAttempts: 15, avoidStart: 25,
    });
    if (!s) continue;
    const g = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf0f4f8, roughness: 0.9 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), white);
    b1.position.y = 0.7;
    g.add(b1);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), white);
    b2.position.y = 1.6;
    g.add(b2);
    const b3 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), white);
    b3.position.y = 2.25;
    g.add(b3);
    const btnMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    for (let b = 0; b < 3; b++) {
      const btn = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), btnMat);
      btn.position.set(0, 1.4 + b * 0.2, 0.45);
      g.add(btn);
    }
    for (let e = -1; e <= 1; e += 2) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), btnMat);
      eye.position.set(e * 0.12, 2.35, 0.3);
      g.add(eye);
    }
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.3, 6),
      new THREE.MeshStandardMaterial({ color: 0xff6600 })
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 2.25, 0.4);
    g.add(nose);
    const hat = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.28, 0.35, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    hat.position.y = 2.7;
    g.add(hat);
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    brim.position.y = 2.52;
    g.add(brim);
    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.08, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0xcc2222 })
    );
    scarf.position.y = 1.95;
    scarf.rotation.x = Math.PI / 2;
    g.add(scarf);

    g.position.set(s.x, s.y, s.z);
    scene.add(g);
  }
}

function addSnowTracks(curve, wFn, scn) {
  const scene = getScene();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc0c8d0,
    side: THREE.DoubleSide,
    roughness: 0.95,
  });
  for (let side = -1; side <= 1; side += 2) {
    const positions = [];
    const indices = [];
    const segs = 400;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      let nx = -tan.z, nz = tan.x;
      const nlen = Math.hypot(nx, nz) || 1;
      nx /= nlen; nz /= nlen;
      const hw = (scn.trackWidth / 2) * (wFn ? wFn(t) : 1);
      // Just outside asphalt edge
      const cx = p.x + nx * side * (hw + 0.55);
      const cz = p.z + nz * side * (hw + 0.55);
      positions.push(cx - nx * 0.35, p.y + 0.03, cz - nz * 0.35);
      positions.push(cx + nx * 0.35, p.y + 0.03, cz + nz * 0.35);
    }
    for (let i = 0; i < segs; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, mat));
  }
}

function addBridge(curve, scn, wFn) {
  const scene = getScene();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b5030, roughness: 0.85 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x444450, metalness: 0.6, roughness: 0.4 });
  const segs = 40;
  // Elevated north section of the new snow oval
  const t0 = 0.35;
  const t1 = 0.55;

  for (let i = 0; i <= segs; i++) {
    const t = t0 + (t1 - t0) * (i / segs);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    let nx = -tan.z, nz = tan.x;
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen; nz /= nlen;
    const half = (scn.trackWidth / 2) * (wFn ? wFn(t) : 1);
    const w = half + 0.8;

    for (let side = -1; side <= 1; side += 2) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 1.2), metalMat);
      rail.position.set(p.x + nx * side * w, p.y + 0.5, p.z + nz * side * w);
      scene.add(rail);
    }
  }

  for (let i = 0; i < segs; i++) {
    const t = t0 + (t1 - t0) * (i / segs);
    const p = curve.getPointAt(t);
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(scn.trackWidth + 2.5, 0.15, 1.5),
      woodMat
    );
    const tan = curve.getTangentAt(t);
    roof.position.set(p.x, p.y + 2.8, p.z);
    roof.lookAt(p.x + tan.x, p.y + 2.8, p.z + tan.z);
    scene.add(roof);
  }

  // Pillars only on the OUTSIDE of the ribbon (never through asphalt)
  for (let i = 0; i < 7; i++) {
    const t = t0 + (t1 - t0) * (i / 6);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    let nx = -tan.z, nz = tan.x;
    const nlen = Math.hypot(nx, nz) || 1;
    nx /= nlen; nz /= nlen;
    const half = (scn.trackWidth / 2) * (wFn ? wFn(t) : 1);
    for (let side = -1; side <= 1; side += 2) {
      const px = p.x + nx * side * (half + 1.4);
      const pz = p.z + nz * side * (half + 1.4);
      if (clearanceFromTrack(curve, px, pz, scn.trackWidth, wFn) < 0.8) continue;
      const pillarH = Math.max(p.y + 0.6, 1.8);
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.4, pillarH, 8),
        woodMat
      );
      pillar.position.set(px, p.y - pillarH / 2 + 0.2, pz);
      scene.add(pillar);
    }
  }
}

function addFrozenLakes(curve, scn, wFn) {
  const scene = getScene();
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6ab0d0,
    transparent: true,
    opacity: 0.5,
    roughness: 0.1,
    metalness: 0.5,
  });
  let placed = 0;
  for (let i = 0; i < 20 && placed < 3; i++) {
    const t = (placed + 0.5) / 3;
    const side = placed % 2 === 0 ? 1 : -1;
    const s = sampleOutside(curve, scn, wFn, 35, 55, {
      t, side, maxAttempts: 12, avoidStart: 40,
    });
    if (!s) continue;
    const r = 12 + Math.random() * 16;
    if (s.clear < r + 4) continue;
    const lake = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(s.x, s.y - 0.3, s.z);
    scene.add(lake);
    placed++;
  }
}

function addPier(curve, scn, wFn) {
  const scene = getScene();
  const wood = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.9 });
  const s = sampleOutside(curve, scn, wFn, 30, 45, {
    t: 0.2, side: 1, maxAttempts: 15, avoidStart: 30,
  });
  if (!s) return;
  // Deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.25, 28), wood);
  deck.position.set(s.x, s.y + 0.6, s.z);
  deck.rotation.y = Math.atan2(s.tan.x, s.tan.z);
  scene.add(deck);
  // Pillars under pier
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 1.4, 6), wood);
      const along = (i - 2.5) * 4;
      post.position.set(
        s.x + s.tan.x * along + s.nx * side * 2.2,
        s.y + 0.1,
        s.z + s.tan.z * along + s.nz * side * 2.2
      );
      scene.add(post);
    }
  }
}

function addBoats(curve, scn, wFn) {
  const scene = getScene();
  const hullMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.2 });
  const sailMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.8, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const s = sampleOutside(curve, scn, wFn, 40, 70, {
      t: (i + 0.5) / 5, maxAttempts: 12, avoidStart: 40,
    });
    if (!s) continue;
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 3.5), hullMat);
    hull.position.y = 0.2;
    g.add(hull);
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 3.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x5a4030 })
    );
    mast.position.y = 1.8;
    g.add(mast);
    const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), sailMat);
    sail.position.set(0.4, 1.9, 0);
    g.add(sail);
    g.position.set(s.x, s.y - 0.4, s.z);
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);
  }
}

function addBuildings(curve, scn, wFn) {
  const scene = getScene();
  const colors = [0x2a2a40, 0x1e2840, 0x303050, 0x252538, 0x3a3050];
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0xffee88,
    emissive: 0xffcc44,
    emissiveIntensity: 0.6,
  });
  let placed = 0;
  for (let i = 0; i < 120 && placed < 45; i++) {
    const s = sampleOutside(curve, scn, wFn, 16, 55, { maxAttempts: 6 });
    if (!s) continue;
    const w = 4 + Math.random() * 8;
    const d = 4 + Math.random() * 8;
    const h = 8 + Math.random() * 28;
    if (s.clear < Math.max(w, d) * 0.55) continue;
    const mat = new THREE.MeshStandardMaterial({
      color: colors[placed % colors.length],
      roughness: 0.85,
      metalness: 0.15,
    });
    const building = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    building.position.set(s.x, s.y + h / 2, s.z);
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
    // Windows strip
    if (Math.random() > 0.35) {
      const floors = Math.floor(h / 3);
      for (let f = 1; f < floors; f++) {
        if (Math.random() > 0.55) continue;
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 0.5, 0.08),
          windowMat
        );
        win.position.set(s.x, s.y + f * 3, s.z + d / 2 + 0.05);
        scene.add(win);
      }
    }
    placed++;
  }
}

function addBillboards(curve, scn, wFn) {
  const scene = getScene();
  const colors = [0xff3366, 0x33aaff, 0xffcc00, 0x66ff99, 0xff66ff];
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.2) / 8;
    const side = i % 2 === 0 ? 1 : -1;
    const s = sampleOutside(curve, scn, wFn, 8, 14, {
      t, side, maxAttempts: 10, avoidStart: 20,
    });
    if (!s) continue;
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 5, 6),
      new THREE.MeshStandardMaterial({ color: 0x444450, metalness: 0.6 })
    );
    post.position.set(s.x, s.y + 2.5, s.z);
    scene.add(post);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2.2, 0.15),
      new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        emissive: colors[i % colors.length],
        emissiveIntensity: 0.35,
        roughness: 0.4,
      })
    );
    board.position.set(s.x, s.y + 5.2, s.z);
    const p = curve.getPointAt(t);
    board.lookAt(p.x, s.y + 5.2, p.z);
    scene.add(board);
  }
}

export function createSnowParticles() {
  const scene = getScene();
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 200;
    positions[i * 3 + 1] = Math.random() * 60;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 200;
    velocities.push({
      vx: (Math.random() - 0.5) * 0.5,
      vy: -(0.5 + Math.random() * 1.5),
      vz: (Math.random() - 0.5) * 0.5,
    });
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.25,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.userData.velocities = velocities;
  points.userData.count = count;
  scene.add(points);
  setSnowParticles(points);
  return points;
}

export function updateSnow(dt) {
  const snowMod = getSnowParticlesRef();
  if (!snowMod) return;
  const pos = snowMod.geometry.attributes.position.array;
  const vels = snowMod.userData.velocities;
  const player = getPlayerVehicle();
  const px = player ? player.mesh.position.x : 0;
  const py = player ? player.mesh.position.y : 0;
  const pz = player ? player.mesh.position.z : 0;

  for (let i = 0; i < snowMod.userData.count; i++) {
    pos[i * 3] += vels[i].vx * dt * 10;
    pos[i * 3 + 1] += vels[i].vy * dt * 10;
    pos[i * 3 + 2] += vels[i].vz * dt * 10;
    if (pos[i * 3 + 1] < py - 5) {
      pos[i * 3] = px + (Math.random() - 0.5) * 100;
      pos[i * 3 + 1] = py + 30 + Math.random() * 30;
      pos[i * 3 + 2] = pz + (Math.random() - 0.5) * 100;
    }
  }
  snowMod.geometry.attributes.position.needsUpdate = true;
}
