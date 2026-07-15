// ============================================================================
//  Audio — engine sound, countdown beeps, general-purpose beep
// ============================================================================

import { audioCtx, engineOsc, engineGain, setAudioCtx, setEngineOsc, setEngineGain } from './state.js';

export function initAudio() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 60;
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setAudioCtx(ctx);
    setEngineOsc(osc);
    setEngineGain(gain);
  } catch(e) {
    setAudioCtx(null);
  }
}

export function updateEngineSound(speedKmh, accel, braking) {
  if (!audioCtx) return;
  const base = 50 + speedKmh * 1.4 + (accel ? 40 : 0);
  const target = Math.min(380, Math.max(55, base));
  engineOsc.frequency.setTargetAtTime(target, audioCtx.currentTime, 0.08);
  const vol = Math.min(0.05, 0.015 + speedKmh/3500 + (accel?0.015:0) - (braking?0.005:0));
  engineGain.gain.setTargetAtTime(vol, audioCtx.currentTime, 0.1);
}

export function beep(freq = 440, dur = 0.15, vol = 0.2) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  g.gain.value = vol;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
