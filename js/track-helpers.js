// ============================================================================
//  Track helpers — pure geometry utilities for track positioning
// ============================================================================

import * as THREE from 'three';
import { trackCurve, trackLength } from './state.js';

export function buildRibbon(curve, halfW, segs, wFn) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= segs; i++) {
    const t = i === segs ? 0 : i / segs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    const w = wFn ? halfW * wFn(t) : halfW;
    const L = p.clone().addScaledVector(n, -w);
    const R = p.clone().addScaledVector(n, w);
    pos.push(L.x, L.y, L.z); pos.push(R.x, R.y, R.z);
    uv.push(0, t * 50); uv.push(1, t * 50);
    if (i < segs) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function offsetCurve(curve, dist, outward, wFn) {
  const pts = [];
  const samples = 400;
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const n = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
    if (!outward) n.negate();
    const w = wFn ? dist * wFn(t) : dist;
    pts.push(p.clone().addScaledVector(n, w));
  }
  pts.push(pts[0].clone());
  return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
}

export function buildSegmentedBarrier(curve, off, side, height, wFn, segs = 500) {
  const pos = [], idx = [], uv = [];
  const n = new THREE.Vector3(), tan = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPointAt(t);
    tan.copy(curve.getTangentAt(t)).normalize();
    n.set(-tan.z, 0, tan.x).normalize().multiplyScalar(side);
    const w = wFn ? off * wFn(t) : off;
    pos.push(p.x + n.x * w, p.y, p.z + n.z * w);
    pos.push(p.x + n.x * w, p.y + height, p.z + n.z * w);
    uv.push(0, t * 40); uv.push(1, t * 40);
    if (i < segs) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

export function widthFnFor(scn) {
  if (!scn.widthVariation) return null;
  return t => 1 + Math.sin(t * Math.PI * 4) * 0.08 * scn.widthVariation + Math.sin(t * Math.PI * 9 + 1.3) * 0.06 * scn.widthVariation;
}

export function nearestOnCurve(curve, p) {
  let best = Infinity, bestT = 0, bestP = null;
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const q = curve.getPointAt(t);
    const d = q.distanceTo(p);
    if (d < best) { best = d; bestT = t; bestP = q; }
  }
  return { dist: best, t: bestT, point: bestP };
}
