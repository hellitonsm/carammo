// ============================================================================
//  HUD — heads-up display updates (speed, lap, position, minimap, nitro)
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { raceState, playerVehicle, vehicles, lap, lapStartTime, bestLapMs,
         minimapPath, minimapBounds, paused, nitroEnabled, nitro, nitroActive,
         rlAgent, useNeuralAI, setMinimapBounds } from './state.js';
import { standings, formatTime } from './lap-race.js';

export function updateHUD() {
  if (raceState === 'menu') return;
  const v = playerVehicle;
  const vel = v.body.getLinearVelocity();
  const skm = Math.round(Math.hypot(vel.x(), vel.y(), vel.z()) * 3.6);
  document.getElementById('speed').innerHTML = `${skm}<span>km/h</span>`;
  document.getElementById('lap').textContent = `Volta ${Math.min(lap + 1, CFG.raceLaps)} / ${CFG.raceLaps}`;
  if (raceState === 'racing') document.getElementById('lap-time').textContent = formatTime(performance.now() - lapStartTime);
  document.getElementById('best-time').textContent = bestLapMs != null ? `Melhor ${formatTime(bestLapMs)}` : 'Melhor \u2014';
  const st = standings();
  const p = st.indexOf(playerVehicle) + 1;
  document.getElementById('position-info').textContent = `Posi\u00e7\u00e3o: ${p}/${vehicles.length}`;
  if (rlAgent && useNeuralAI) {
    const stats = rlAgent.getStats();
    const hudEl = document.getElementById('position-info');
    if (hudEl) hudEl.textContent += ` | \u03b5:${stats.epsilon.toFixed(2)} buf:${stats.bufferSize}`;
  }
  document.getElementById('pause-overlay') && (document.getElementById('pause-overlay').hidden = !paused);
}

export function updateNitroBar() {
  const bar = document.getElementById('nitro-bar');
  if (!nitroEnabled) { bar.style.width = '0%'; bar.parentElement.style.display = 'none'; return; }
  bar.parentElement.style.display = '';
  bar.style.width = `${nitro}%`;
  bar.classList.toggle('active', nitroActive);
}

export function updateMinimap() {
  if (!minimapPath || !playerVehicle) return;
  const cv = document.getElementById('minimap'), ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height, pad = 18;
  if (!minimapBounds) {
    const mnx = Math.min(...minimapPath.map(p => p.x));
    const mxx = Math.max(...minimapPath.map(p => p.x));
    const mnz = Math.min(...minimapPath.map(p => p.z));
    const mxz = Math.max(...minimapPath.map(p => p.z));
    const sc = Math.min((w - pad * 2) / (mxx - mnx || 1), (h - pad * 2) / (mxz - mnz || 1));
    setMinimapBounds({ minX: mnx, minZ: mnz, scale: sc, offsetX: (w - (mxx - mnx) * sc) / 2, offsetZ: (h - (mxz - mnz) * sc) / 2 });
  }
  const b = minimapBounds;
  ctx.fillStyle = 'rgba(6,12,9,0.88)'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath();
  minimapPath.forEach((p, i) => {
    const x = (p.x - b.minX) * b.scale + b.offsetX, y = (p.z - b.minZ) * b.scale + b.offsetZ;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(232,93,4,0.5)'; ctx.lineWidth = 6; ctx.beginPath();
  let started = false;
  minimapPath.forEach((p, i) => {
    if (i / (minimapPath.length - 1) > playerVehicle.progress) return;
    const x = (p.x - b.minX) * b.scale + b.offsetX, y = (p.z - b.minZ) * b.scale + b.offsetZ;
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  });
  ctx.stroke();
  for (const v of vehicles) {
    const x = (v.mesh.position.x - b.minX) * b.scale + b.offsetX;
    const y = (v.mesh.position.z - b.minZ) * b.scale + b.offsetZ;
    ctx.fillStyle = v.isPlayer ? '#e85d04' : '#' + new THREE.Color(v.color).getHexString();
    ctx.beginPath(); ctx.arc(x, y, v.isPlayer ? 5 : 4, 0, Math.PI * 2); ctx.fill();
    if (v.isPlayer) {
      const d = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
      const a = Math.atan2(d.x, d.z);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(a) * 10, y + Math.cos(a) * 10); ctx.stroke();
    }
  }
}
