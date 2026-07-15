import {
  getAudioCtx,
  setAudioCtx,
  getEngineOsc,
  setEngineOsc,
  getEngineGain,
  setEngineGain,
} from './state.js';

export function initAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setAudioCtx(ctx);
    setEngineOsc(osc);
    setEngineGain(gain);
  } catch (e) {
    console.warn('Audio init failed', e);
  }
}

export function updateEngineSound(speedKmh, accel, braking) {
  const ctx = getAudioCtx();
  const osc = getEngineOsc();
  const gain = getEngineGain();
  if (!ctx || !osc || !gain) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const freq = Math.max(55, Math.min(380, 50 + speedKmh * 1.4 + (accel ? 40 : 0)));
  const vol = Math.min(
    0.05,
    0.015 + speedKmh / 3500 + (accel ? 0.015 : 0) - (braking ? 0.005 : 0)
  );

  const t = ctx.currentTime;
  osc.frequency.setTargetAtTime(freq, t, 0.08);
  gain.gain.setTargetAtTime(Math.max(0, vol), t, 0.1);
}

export function beep(freq = 440, dur = 0.15, vol = 0.2) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.stop(ctx.currentTime + dur + 0.05);
}

export function pauseAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'running') ctx.suspend();
}

export function resumeAudio() {
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}
