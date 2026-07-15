import * as THREE from 'three';
import {
  getKeys,
  getPlayerVehicle,
  getRaceState,
  getControlsEnabled,
  getPaused,
  togglePause,
  getNitroEnabled,
  getNitro,
  setNitro,
  getNitroActive,
  setNitroActive,
  getCamMode,
  setCamMode,
  getCurrentSteer,
  setCurrentSteer,
  getCameraToggleCooldown,
  setCameraToggleCooldown,
  getEscapeCooldown,
  setEscapeCooldown,
} from './state.js';
import { CFG } from './config.js';
import { resetVehicle } from './car.js';
import { emitExhaustFx, emitWheelDust, emitNitroFlames, updateSpeedLines } from './fx.js';
import { spawnSkid } from './skid-marks.js';
import { updateEngineSound } from './audio.js';
import { updateNitroBar } from './hud.js';

export function initInput() {
  const keys = getKeys();

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = true;
    if (k === 's' || e.key === 'ArrowDown') keys.s = true;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = true;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = true;
    if (k === ' ' || e.code === 'Space') {
      keys.space = true;
      e.preventDefault();
    }
    if (k === 'shift' || e.key === 'Shift') keys.shift = true;
    if (k === 'r') keys.r = true;
    if (k === 'c') keys.c = true;
    if (k === 'escape') keys.escape = true;
  });

  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'w' || e.key === 'ArrowUp') keys.w = false;
    if (k === 's' || e.key === 'ArrowDown') keys.s = false;
    if (k === 'a' || e.key === 'ArrowLeft') keys.a = false;
    if (k === 'd' || e.key === 'ArrowRight') keys.d = false;
    if (k === ' ' || e.code === 'Space') keys.space = false;
    if (k === 'shift' || e.key === 'Shift') keys.shift = false;
    if (k === 'r') keys.r = false;
    if (k === 'c') keys.c = false;
    if (k === 'escape') keys.escape = false;
  });
}

export function getLocalVelocity(v) {
  if (!v || !v.body) return new THREE.Vector3();
  const lv = v.body.getLinearVelocity();
  const vel = new THREE.Vector3(lv.x(), lv.y(), lv.z());
  const invQ = v.mesh.quaternion.clone().invert();
  vel.applyQuaternion(invQ);
  return vel;
}

export function updatePlayerVehicle(dt) {
  const v = getPlayerVehicle();
  if (!v || !v.vehicle) return;

  const keys = getKeys();
  const raceState = getRaceState();

  // R reset
  if (keys.r && raceState === 'racing') {
    resetVehicle(v, false);
    keys.r = false;
  }

  // Cooldowns
  let camCd = getCameraToggleCooldown();
  if (camCd > 0) setCameraToggleCooldown(Math.max(0, camCd - dt));
  let escCd = getEscapeCooldown();
  if (escCd > 0) setEscapeCooldown(Math.max(0, escCd - dt));

  // Camera toggle
  if (keys.c && getCameraToggleCooldown() <= 0) {
    setCamMode((getCamMode() + 1) % 3);
    setCameraToggleCooldown(0.3);
    keys.c = false;
  }

  // Pause
  if (keys.escape && raceState === 'racing' && getEscapeCooldown() <= 0) {
    togglePause();
    setEscapeCooldown(0.3);
    keys.escape = false;
  }

  const vehicle = v.vehicle;

  if (getPaused()) {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(CFG.brakingForce, 0);
    vehicle.setBrake(CFG.brakingForce, 1);
    vehicle.setBrake(CFG.brakingForce, 2);
    vehicle.setBrake(CFG.brakingForce, 3);
    return;
  }

  if (!getControlsEnabled() || raceState !== 'racing') {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(10, 0);
    vehicle.setBrake(10, 1);
    vehicle.setBrake(10, 2);
    vehicle.setBrake(10, 3);
    v.ramp = 0;
    updateEngineSound(0, false, false);
    return;
  }

  const lv = v.body.getLinearVelocity();
  const speedMs = Math.hypot(lv.x(), lv.y(), lv.z());
  const speedKmh = speedMs * 3.6;

  // Nitro
  let nitro = getNitro();
  let nitroActive = getNitroEnabled() && keys.shift && nitro > 0 && keys.w;
  if (nitroActive) {
    nitro = Math.max(0, nitro - CFG.nitroDrainRate * dt);
  } else {
    nitro = Math.min(CFG.maxNitro, nitro + CFG.nitroRegenRate * dt);
  }
  setNitro(nitro);
  setNitroActive(nitroActive);
  updateNitroBar();

  // Engine force
  const maxE = nitroActive ? CFG.nitroForce : CFG.engineForce;
  const engineMult = v.engineMult || 1.0;
  if (keys.w) {
    v.ramp = Math.min(1, v.ramp + dt * 0.9);
    let force = maxE * (0.55 + 0.45 * v.ramp) * engineMult;
    if (speedMs < 0.3) force += 400;
    vehicle.applyEngineForce(force, 2);
    vehicle.applyEngineForce(force, 3);
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
  } else if (keys.s) {
    v.ramp = 0;
    if (speedKmh > 5) {
      vehicle.applyEngineForce(0, 2);
      vehicle.applyEngineForce(0, 3);
      vehicle.setBrake(CFG.brakingForce * 0.6, 0);
      vehicle.setBrake(CFG.brakingForce * 0.6, 1);
      vehicle.setBrake(CFG.brakingForce * 0.6, 2);
      vehicle.setBrake(CFG.brakingForce * 0.6, 3);
    } else {
      vehicle.setBrake(0, 0);
      vehicle.setBrake(0, 1);
      vehicle.setBrake(0, 2);
      vehicle.setBrake(0, 3);
      vehicle.applyEngineForce(-CFG.engineForce * 0.55 * engineMult, 2);
      vehicle.applyEngineForce(-CFG.engineForce * 0.55 * engineMult, 3);
    }
  } else {
    v.ramp = Math.max(0, v.ramp - dt * 2);
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
  }

  if (speedMs > 1) {
    const dfMult = v.downforceMult || 1.0;
    const df = (speedMs * speedMs * 8 + (nitroActive ? 1800 : 0)) * dfMult;
    v.body.applyCentralForce(new Ammo.btVector3(0, -df, 0));
  }

  // Steering
  let targetSteer = 0;
  if (keys.a) targetSteer = CFG.maxSteer;
  if (keys.d) targetSteer = -CFG.maxSteer;
  let steer = getCurrentSteer();
  if (steer < targetSteer) steer = Math.min(targetSteer, steer + CFG.steerSpeed);
  else if (steer > targetSteer) steer = Math.max(targetSteer, steer - CFG.steerSpeed);
  setCurrentSteer(steer);
  vehicle.setSteeringValue(steer, 0);
  vehicle.setSteeringValue(steer, 1);

  // Handbrake
  if (keys.space) {
    vehicle.setBrake(CFG.brakingForce, 0);
    vehicle.setBrake(CFG.brakingForce, 1);
    vehicle.setBrake(CFG.brakingForce * 0.35, 2);
    vehicle.setBrake(CFG.brakingForce * 0.35, 3);
    if (speedKmh > 20) spawnSkid(v);
    if (v.mesh.userData.tlMat) {
      v.mesh.userData.tlMat.emissiveIntensity = 2.2;
    }
  } else {
    if (v.mesh.userData.tlMat) {
      v.mesh.userData.tlMat.emissiveIntensity = 0.5;
    }
  }

  // Drift skid
  const localVel = getLocalVelocity(v);
  if (Math.abs(localVel.x) > 4 && speedKmh > 25) {
    spawnSkid(v);
  }

  // FX
  const drifting = Math.abs(localVel.x) > 4;
  emitExhaustFx(v, speedKmh, drifting);
  emitWheelDust(v, speedKmh, keys.space || drifting);
  if (nitroActive) emitNitroFlames(v);
  updateSpeedLines(speedKmh);
  updateEngineSound(speedKmh, keys.w && !keys.s, keys.space || keys.s);

  v.prevSpeed = speedMs;
}
