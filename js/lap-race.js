import {
  getTrackCurve,
  getVehicles,
  getPlayerVehicle,
  getRaceState,
  setRaceState,
  getLap,
  setLap,
  getLapStartTime,
  setLapStartTime,
  getBestLapMs,
  setBestLapMs,
  getRaceAccumMs,
  setRaceAccumMs,
  setTotalRaceMs,
  setControlsEnabled,
  getRlAgent,
} from './state.js';
import { CFG } from './config.js';
import { nearestOnCurve } from './track-helpers.js';
import { beep } from './audio.js';

export function updateProgress(v) {
  const curve = getTrackCurve();
  if (!curve || !v.mesh) return;
  const r = nearestOnCurve(curve, v.mesh.position);
  v.lastT = v.progress;
  v.progress = r.t;
}

export function checkLaps() {
  if (getRaceState() !== 'racing') return;

  const vehicles = getVehicles();
  const raceLaps = CFG.raceLaps;

  for (const v of vehicles) {
    if (v.finished) continue;

    // Detect lap crossing: wrap around 0.88 → 0.12
    if (v.lastT > 0.88 && v.progress < 0.12) {
      v.lap++;

      if (v.isPlayer) {
        const now = performance.now();
        const lapStart = getLapStartTime();
        const lapMs = now - lapStart;
        setRaceAccumMs(getRaceAccumMs() + lapMs);

        const best = getBestLapMs();
        if (best === null || lapMs < best) {
          setBestLapMs(lapMs);
        }
        setLap(v.lap);
        setLapStartTime(now);
        beep(880, 0.15, 0.2);

        if (v.lap >= raceLaps) {
          finishRace();
        }
      } else {
        if (v.lap >= raceLaps) {
          v.finished = true;
          v.finishTime = getRaceAccumMs() + (performance.now() - getLapStartTime());
        }
      }
    }
  }
}

export function finishRace() {
  setRaceState('finished');
  setControlsEnabled(false);

  const agent = getRlAgent();
  if (agent) agent.save('car-ai-agent');

  const player = getPlayerVehicle();
  if (player) {
    player.finished = true;
    const total = getRaceAccumMs() + (performance.now() - getLapStartTime());
    player.finishTime = total;
    setTotalRaceMs(total);
  }

  // Mark unfinished AI with estimated time
  const vehicles = getVehicles();
  for (const v of vehicles) {
    if (!v.finished) {
      v.finishTime = Infinity;
    }
  }

  renderResults();
}

export function standings() {
  const vehicles = getVehicles().slice();
  vehicles.sort((a, b) => {
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  return vehicles;
}

export function formatTime(ms) {
  if (!isFinite(ms) || ms === null || ms === undefined) return '--:--.---';
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const milli = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

function renderResults() {
  const el = document.getElementById('race-results');
  if (!el) return;

  const ranks = standings();
  const medals = ['🥇', '🥈', '🥉', '4️⃣'];

  let html = '<div class="finish-card">';
  html += '<h2>Corrida Finalizada!</h2>';
  html += '<ol class="podium">';
  ranks.forEach((v, i) => {
    const cls = [
      i === 0 ? 'pos1' : '',
      v.isPlayer ? 'you' : '',
    ].filter(Boolean).join(' ');
    const timeStr = v.finished && isFinite(v.finishTime)
      ? formatTime(v.finishTime)
        : `Volta ${Math.min(v.lap, 3)}/3`;
    html += `<li class="${cls}">
      <span class="medal">${medals[i] || (i + 1)}</span>
      <span class="racer-name">${v.name}${v.isPlayer ? ' (Você)' : ''}</span>
      <span class="racer-time">${timeStr}</span>
    </li>`;
  });
  html += '</ol>';
  html += '<div class="finish-actions">';
  html += '<button id="restart-btn" class="btn primary">Reiniciar</button>';
  html += '<button id="menu-btn" class="btn">Menu</button>';
  html += '</div></div>';

  el.innerHTML = html;
  el.hidden = false;

  // Wire buttons — main.js also binds, but re-bind here for safety
  const restartBtn = document.getElementById('restart-btn');
  const menuBtn = document.getElementById('menu-btn');
  if (restartBtn) {
    restartBtn.onclick = () => {
      el.hidden = true;
      window.dispatchEvent(new CustomEvent('carammo-restart'));
    };
  }
  if (menuBtn) {
    menuBtn.onclick = () => {
      el.hidden = true;
      window.dispatchEvent(new CustomEvent('carammo-menu'));
    };
  }
}
