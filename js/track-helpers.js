import * as THREE from 'three';

/**
 * Build a ribbon mesh along a curve.
 * halfW: half width, segs: number of segments, wFn: optional width multiplier fn(t)
 */
export function buildRibbon(curve, halfW, segs, wFn) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const normals = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    // perpendicular in XZ plane
    const nx = -tan.z;
    const nz = tan.x;
    const len = Math.hypot(nx, nz) || 1;
    const nnx = nx / len;
    const nnz = nz / len;
    const w = halfW * (wFn ? wFn(t) : 1);

    positions.push(p.x - nnx * w, p.y + 0.02, p.z - nnz * w);
    positions.push(p.x + nnx * w, p.y + 0.02, p.z + nnz * w);
    uvs.push(0, t * 50, 1, t * 50);
    normals.push(0, 1, 0, 0, 1, 0);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    // (a,c,b, b,c,d)
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Offset a curve by dist along its normal (XZ).
 */
export function offsetCurve(curve, dist, outward, wFn) {
  const pts = [];
  const segs = 400;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    let nx = -tan.z;
    let nz = tan.x;
    const len = Math.hypot(nx, nz) || 1;
    nx /= len;
    nz /= len;
    if (!outward) {
      nx = -nx;
      nz = -nz;
    }
    const w = dist * (wFn ? wFn(t) : 1);
    pts.push(new THREE.Vector3(p.x + nx * w, p.y, p.z + nz * w));
  }
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
}

/**
 * Vertical segmented barrier ribbon.
 */
export function buildSegmentedBarrier(curve, off, side, height, wFn, segs = 500) {
  const positions = [];
  const indices = [];
  const sign = side >= 0 ? 1 : -1;

  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    let nx = -tan.z;
    let nz = tan.x;
    const len = Math.hypot(nx, nz) || 1;
    nx = (nx / len) * sign;
    nz = (nz / len) * sign;
    const w = off * (wFn ? wFn(t) : 1);
    const x = p.x + nx * w;
    const z = p.z + nz * w;
    positions.push(x, p.y, z);
    positions.push(x, p.y + height, z);
  }

  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Brute-force nearest point on curve (samples).
 * Distance is measured in XZ (horizontal) so elevated sections don't
 * falsely report props as "far" from the track below.
 * Returns { dist, t, point, dist3d }
 */
export function nearestOnCurve(curve, p, samples = 320) {
  let bestDist = Infinity;
  let bestDist3 = Infinity;
  let bestT = 0;
  let bestPoint = null;
  const px = p.x;
  const py = p.y;
  const pz = p.z;

  for (let i = 0; i < samples; i++) {
    const t = i / (samples - 1);
    const pt = curve.getPointAt(t);
    const dx = pt.x - px;
    const dy = pt.y - py;
    const dz = pt.z - pz;
    const dXZ = dx * dx + dz * dz;
    if (dXZ < bestDist) {
      bestDist = dXZ;
      bestT = t;
      bestPoint = pt;
      bestDist3 = dXZ + dy * dy;
    }
  }
  return {
    dist: Math.sqrt(bestDist),
    dist3d: Math.sqrt(bestDist3),
    t: bestT,
    point: bestPoint,
  };
}

/**
 * Minimum horizontal distance from (x,z) to the track ribbon edge.
 * Returns centerlineDist - halfWidth (negative = on the asphalt).
 */
export function clearanceFromTrack(curve, x, z, trackWidth, wFn) {
  const r = nearestOnCurve(curve, { x, y: 0, z });
  const half = (trackWidth / 2) * (wFn ? wFn(r.t) : 1);
  return r.dist - half;
}

/**
 * Bounding box of curve with margin.
 */
export function computeTrackBounds(curve, extra = 220) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i <= 200; i++) {
    const p = curve.getPointAt(i / 200);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  return {
    minX: minX - extra,
    maxX: maxX + extra,
    minZ: minZ - extra,
    maxZ: maxZ + extra,
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    sizeX: maxX - minX + extra * 2,
    sizeZ: maxZ - minZ + extra * 2,
  };
}
