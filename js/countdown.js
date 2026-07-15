// ============================================================================
//  Countdown — race start countdown (3... 2... 1... GO!)
// ============================================================================

import { CFG } from './config.js';
import { raceState, controlsEnabled, countdownValue, countdownTimer, vehicles,
         lap, bestLapMs, raceAccumMs, nitro, currentSceneDef, audioCtx,
         setRaceState, setControlsEnabled, setCountdownValue, setCountdownTimer,
         setLap, setBestLapMs, setRaceAccumMs, setNitro, setLapStartTime } from './state.js';
import { resetVehicle } from './player-control.js';
import { beep } from './audio.js';

function showCountdown(txt, go) {
  const el = document.getElementById('countdown');
  el.hidden = false; el.textContent = txt;
  el.classList.toggle('go', !!go);
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
}

function hideCountdown() { document.getElementById('countdown').hidden = true; }

export function startCountdown() {
  setRaceState('countdown');
  setControlsEnabled(false);
  setCountdownValue(3);
  setCountdownTimer(1);
  showCountdown('3');
  for (const v of vehicles) resetVehicle(v, true);
  setLap(0);
  setBestLapMs(null);
  setRaceAccumMs(0);
  setNitro(CFG.maxNitro);
  document.getElementById('scene-name-hud').textContent = currentSceneDef.name;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  beep(440, 0.2, 0.2);
}

export function updateCountdown(dt) {
  if (raceState !== 'countdown') return;
  setCountdownTimer(countdownTimer - dt);
  if (countdownTimer > 0) return;
  setCountdownValue(countdownValue - 1);
  if (countdownValue > 0) {
    showCountdown(String(countdownValue));
    setCountdownTimer(1);
    beep(440, 0.15, 0.15);
  } else if (countdownValue === 0) {
    showCountdown('GO!', true);
    setRaceState('racing');
    setControlsEnabled(true);
    setLapStartTime(performance.now());
    setCountdownTimer(0.5);
    beep(880, 0.3, 0.25);
    setTimeout(hideCountdown, 700);
  } else hideCountdown();
}
