import {
  getPlayerVehicle,
  getVehicles,
  getLap,
  getBestLapMs,
  getLapStartTime,
  getRaceState,
  getPaused,
  getNitro,
  getNitroActive,
  getNitroEnabled,
  getMinimapPath,
  getMinimapBounds,
  getUseNeuralAI,
  getRlAgent,
  getTrackCurve,
} from './state.js';
import { CFG } from './config.js';
import { formatTime, standings } from './lap-race.js';
import { getState, getEffectiveStats } from './manager.js';

export function updateHUD() {
  const player = getPlayerVehicle();
  if (!player) return;

  const lv = player.body.getLinearVelocity();
  const speedKmh = Math.hypot(lv.x(), lv.y(), lv.z()) * 3.6;

  const speedEl = document.getElementById('speed');
  if (speedEl) {
    speedEl.innerHTML = `${Math.round(speedKmh)}<span>km/h</span>`;
  }

  const lapEl = document.getElementById('lap');
  if (lapEl) {
    const lap = getLap();
    lapEl.textContent = `Volta ${Math.min(lap, 3)} / 3`;
  }

  const lapTimeEl = document.getElementById('lap-time');
  if (lapTimeEl && getRaceState() === 'racing') {
    const elapsed = performance.now() - getLapStartTime();
    lapTimeEl.textContent = formatTime(elapsed);
  }

  const bestEl = document.getElementById('best-time');
  if (bestEl) {
    const best = getBestLapMs();
    bestEl.textContent = best !== null ? formatTime(best) : '--:--.---';
  }

  const posEl = document.getElementById('position-info');
  if (posEl) {
    const ranks = standings();
    const idx = ranks.findIndex((v) => v.isPlayer);
    let text = `Posição: ${idx + 1}/${ranks.length}`;
    if (getUseNeuralAI()) {
      const agent = getRlAgent();
      if (agent) {
        text += ` | ε:${agent.epsilon.toFixed(2)} buf:${agent.bufferSize}`;
      }
    }
    posEl.textContent = text;
  }

  const pauseOverlay = document.getElementById('pause-overlay');
  if (pauseOverlay) {
    pauseOverlay.hidden = !getPaused();
  }

  const dmgEl = document.getElementById('hud-damage');
  if (dmgEl) {
    const s = getState();
    const dmg = s.damage[s.activeCar] || { motor: 0, aero: 0, pneus: 0 };
    const totalDmg = dmg.motor + dmg.aero + dmg.pneus;
    if (totalDmg > 30) {
      dmgEl.textContent = `⚠ Dano: M${dmg.motor}% A${dmg.aero}% P${dmg.pneus}%`;
    } else {
      dmgEl.textContent = '';
    }
  }
}

export function updateNitroBar() {
  const wrap = document.getElementById('nitro-bar-wrap');
  const bar = document.getElementById('nitro-bar');
  if (!wrap || !bar) return;

  if (!getNitroEnabled()) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const pct = getNitro();
  bar.style.width = `${pct}%`;
  if (getNitroActive()) bar.classList.add('active');
  else bar.classList.remove('active');
}

let _miniReady = false;
let _miniScale = 1;
let _miniOx = 0;
let _miniOz = 0;

export function updateMinimap() {
  const canvas = document.getElementById('minimap');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  const path = getMinimapPath();
  const bounds = getMinimapBounds();
  if (!path || !bounds) return;

  if (!_miniReady) {
    const scaleX = (w - 20) / bounds.sizeX;
    const scaleZ = (h - 20) / bounds.sizeZ;
    _miniScale = Math.min(scaleX, scaleZ);
    _miniOx = w / 2 - bounds.cx * _miniScale;
    _miniOz = h / 2 - bounds.cz * _miniScale;
    _miniReady = true;
  }

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);

  // Track path
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    const x = path[i].x * _miniScale + _miniOx;
    const z = path[i].z * _miniScale + _miniOz;
    if (i === 0) ctx.moveTo(x, z);
    else ctx.lineTo(x, z);
  }
  ctx.closePath();
  ctx.stroke();

  // Player progress arc (orange)
  const player = getPlayerVehicle();
  if (player && path.length > 1) {
    const n = Math.floor(player.progress * (path.length - 1));
    ctx.strokeStyle = 'rgba(255,140,0,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const x = path[i].x * _miniScale + _miniOx;
      const z = path[i].z * _miniScale + _miniOz;
      if (i === 0) ctx.moveTo(x, z);
      else ctx.lineTo(x, z);
    }
    ctx.stroke();
  }

  // Vehicles
  const vehicles = getVehicles();
  for (const v of vehicles) {
    if (!v.mesh) continue;
    const x = v.mesh.position.x * _miniScale + _miniOx;
    const z = v.mesh.position.z * _miniScale + _miniOz;
    const r = v.isPlayer ? 5 : 4;
    const col = v.isPlayer
      ? '#ff8c00'
      : '#' + (v.color >>> 0).toString(16).padStart(6, '0');
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, z, r, 0, Math.PI * 2);
    ctx.fill();

    if (v.isPlayer) {
      // direction arrow
      const e = new THREE_Euler_Y(v.mesh.quaternion);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, z);
      ctx.lineTo(x + Math.sin(e) * 8, z + Math.cos(e) * 8);
      ctx.stroke();
    }
  }
}

function THREE_Euler_Y(quat) {
  // extract yaw from quaternion
  const siny = 2 * (quat.w * quat.y + quat.x * quat.z);
  const cosy = 1 - 2 * (quat.y * quat.y + quat.x * quat.x);
  return Math.atan2(siny, cosy);
}

export function resetMinimap() {
  _miniReady = false;
}
