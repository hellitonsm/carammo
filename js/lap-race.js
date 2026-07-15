// ============================================================================
//  Lap & Race — progress tracking, lap detection, race finish, standings
// ============================================================================

import { CFG } from './config.js';
import { vehicles, playerVehicle, trackCurve, raceState, lap, lapStartTime,
         bestLapMs, raceAccumMs, totalRaceMs, controlsEnabled, nitro,
         rlAgent, setRaceState, setControlsEnabled, setLap, setLapStartTime,
         setBestLapMs, setRaceAccumMs, setTotalRaceMs, setNitro } from './state.js';
import { nearestOnCurve } from './track-helpers.js';
import { beep } from './audio.js';

export function updateProgress(v) {
  const nr = nearestOnCurve(trackCurve, v.mesh.position);
  v.progress = nr.t;
}

export function checkLaps() {
  if (raceState !== 'racing') return;
  checkVehicleLap(playerVehicle);
  for (const v of vehicles) if (!v.isPlayer) checkVehicleLap(v);
}

function checkVehicleLap(v) {
  if (v.finished) return;
  const t = v.progress;
  if (v.lastT > 0.88 && t < 0.12) {
    v.lap++;
    if (v.isPlayer) {
      const lm = performance.now() - lapStartTime;
      if (bestLapMs == null || lm < bestLapMs) setBestLapMs(lm);
      setRaceAccumMs(raceAccumMs + lm);
      setLap(lap + 1);
      setLapStartTime(performance.now());
      beep(880, 0.15, 0.15);
      if (lap >= CFG.raceLaps) finishRace();
    } else if (v.lap >= CFG.raceLaps) {
      v.finished = true;
      v.finishTime = raceAccumMs + (performance.now() - lapStartTime);
    }
  }
  v.lastT = t;
}

function finishRace() {
  setRaceState('finished');
  setControlsEnabled(false);
  setTotalRaceMs(raceAccumMs);
  if (rlAgent) rlAgent.save('car-ai-agent');
  playerVehicle.finished = true;
  playerVehicle.finishTime = totalRaceMs;
  const sorted = standings();
  const el = document.getElementById('race-results');
  let html = '';
  sorted.forEach((v, i) => {
    const cls = v.isPlayer ? 'you' : (i === 0 ? 'pos1' : '');
    const medal = i === 0 ? '\u{1F947}' : i === 1 ? '\u{1F948}' : i === 2 ? '\u{1F949}' : `${i + 1}.`;
    const time = v.finishTime > 0 ? formatTime(v.finishTime) : 'na pista';
    html += `<div class="${cls}">${medal} ${v.name} \u00b7 ${time}</div>`;
  });
  html += `<hr style="margin:0.8rem 0;border:0;border-top:1px solid var(--line);">`;
  html += `<div>Melhor volta: <b>${formatTime(bestLapMs)}</b></div>`;
  html += `<div>Tempo total: <b>${formatTime(totalRaceMs)}</b></div>`;
  el.innerHTML = html;
  document.getElementById('finish').hidden = false;
}

export function standings() {
  return vehicles.slice().sort((a, b) => {
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

export function formatTime(ms) {
  if (ms == null || !Number.isFinite(ms)) return '\u2014';
  const t = Math.max(0, ms);
  const m = Math.floor(t / 60000), s = Math.floor((t % 60000) / 1000), mp = Math.floor(t % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(mp).padStart(3, '0')}`;
}
