import {
  getRaceState,
  setRaceState,
  getCountdownValue,
  setCountdownValue,
  getCountdownTimer,
  setCountdownTimer,
  setControlsEnabled,
  setLap,
  setBestLapMs,
  setRaceAccumMs,
  setLapStartTime,
  setNitro,
  getVehicles,
} from './state.js';
import { CFG } from './config.js';
import { resetVehicle } from './car.js';
import { beep } from './audio.js';

export function startCountdown() {
  setRaceState('countdown');
  setControlsEnabled(false);
  setCountdownValue(3);
  setCountdownTimer(1);
  setLap(0);
  setBestLapMs(null);
  setRaceAccumMs(0);
  setNitro(CFG.maxNitro);

  const vehicles = getVehicles();
  for (const v of vehicles) {
    resetVehicle(v, true);
  }

  showCountdown('3');
  beep(440, 0.2, 0.2);
}

export function updateCountdown(dt) {
  if (getRaceState() !== 'countdown') return;

  let timer = getCountdownTimer() - dt;
  setCountdownTimer(timer);
  if (timer > 0) return;

  let val = getCountdownValue() - 1;
  setCountdownValue(val);

  if (val > 0) {
    showCountdown(String(val));
    setCountdownTimer(1);
    beep(440, 0.2, 0.2);
  } else if (val === 0) {
    showCountdown('GO!', true);
    setRaceState('racing');
    setControlsEnabled(true);
    setLapStartTime(performance.now());
    setCountdownTimer(0.5);
    beep(880, 0.3, 0.25);
    setTimeout(() => hideCountdown(), 700);
  } else {
    hideCountdown();
  }
}

function showCountdown(text, isGo = false) {
  const el = document.getElementById('countdown');
  if (!el) return;
  el.hidden = false;
  el.textContent = text;
  el.classList.toggle('go', !!isGo);
  // restart animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
}

function hideCountdown() {
  const el = document.getElementById('countdown');
  if (el) el.hidden = true;
}
