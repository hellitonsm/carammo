// ============================================================================
//  Player control — keyboard → vehicle physics forces + FX emission
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { keys, playerVehicle, vehicles, physicsWorld, controlsEnabled, nitro, nitroActive,
         nitroEnabled, raceState, paused, currentSteer, skidCooldown, camMode,
         cameraToggleCooldown, escapeCooldown, currentSceneDef, trackStartDir,
         setNitro, setNitroActive, setCurrentSteer, setSkidCooldown,
         setCameraToggleCooldown, setEscapeCooldown, setPaused, setRaceState,
         setControlsEnabled, setCamMode } from './state.js';
import { updateEngineSound } from './audio.js';
import { emitExhaustFx, emitWheelDust, emitNitroFlames, updateSpeedLines } from './fx.js';
import { updateNitroBar } from './hud.js';
import { spawnSkid } from './skid-marks.js';



export function initInput() {
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') keys.w = true;
    if (k === 's' || k === 'arrowdown') keys.s = true;
    if (k === 'a' || k === 'arrowleft') keys.a = true;
    if (k === 'd' || k === 'arrowright') keys.d = true;
    if (e.code === 'Space') { keys.space = true; e.preventDefault(); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = true;
    if (k === 'r') keys.r = true;
    if (k === 'c') keys.c = true;
    if (k === 'escape') keys.escape = true;
  });
  window.addEventListener('keyup', e => {
    const k = e.key.toLowerCase();
    if (k === 'w' || k === 'arrowup') keys.w = false;
    if (k === 's' || k === 'arrowdown') keys.s = false;
    if (k === 'a' || k === 'arrowleft') keys.a = false;
    if (k === 'd' || k === 'arrowright') keys.d = false;
    if (e.code === 'Space') keys.space = false;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.shift = false;
    if (k === 'r') keys.r = false;
    if (k === 'c') keys.c = false;
    if (k === 'escape') keys.escape = false;
  });
}

export function updatePlayerVehicle(dt) {
  const Ammo = window.Ammo;
  if (keys.r && raceState === 'racing') resetVehicle(playerVehicle, false);
  setCameraToggleCooldown(Math.max(0, cameraToggleCooldown - dt));
  setEscapeCooldown(Math.max(0, escapeCooldown - dt));
  if (keys.c && cameraToggleCooldown <= 0) { setCamMode((camMode + 1) % 3); setCameraToggleCooldown(0.3); }
  if (keys.escape && escapeCooldown <= 0 && raceState === 'racing') { togglePause(); setEscapeCooldown(0.3); }

  if (paused) {
    applyBrakes(playerVehicle, 0);
    playerVehicle.vehicle.applyEngineForce(0, 2);
    playerVehicle.vehicle.applyEngineForce(0, 3);
    return;
  }
  if (!controlsEnabled || raceState !== 'racing') {
    applyBrakes(playerVehicle, CFG.brakingForce * 0.5);
    playerVehicle.ramp = 0;
    return;
  }
  const v = playerVehicle;
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;

  const newNitroActive = nitroEnabled && keys.shift && nitro > 0 && keys.w;
  setNitroActive(newNitroActive);
  if (nitroActive) setNitro(Math.max(0, nitro - CFG.nitroDrainRate * dt));
  else setNitro(Math.min(CFG.maxNitro, nitro + CFG.nitroRegenRate * dt));
  updateNitroBar();

  let engine = 0, brake = 0;
  const maxE = nitroActive ? CFG.nitroForce : CFG.engineForce;
  if (keys.w) {
    const ramp = speedKmh < 30 ? 1 : speedKmh < 80 ? 1.5 : speedKmh < 130 ? 2 : 2.4;
    v.ramp += (ramp - v.ramp) * (nitroActive ? 0.04 : 0.018);
    engine = maxE * v.ramp;
    if (speedMs < 0.3) {
      v.body.activate();
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
      const im = new Ammo.btVector3(fwd.x * 25, 0, fwd.z * 25);
      v.body.applyCentralImpulse(im); Ammo.destroy(im);
    }
  } else v.ramp = Math.max(0, v.ramp - 0.04);

  if (keys.s) {
    if (speedKmh > 5) brake = CFG.brakingForce * 0.6;
    else engine = -CFG.engineForce * 0.55;
  }
  v.vehicle.applyEngineForce(engine, 2); v.vehicle.applyEngineForce(engine, 3);

  if (speedMs > 1) {
    const df = speedMs * speedMs * 8 + (nitroActive ? 1800 : 0);
    const f = new Ammo.btVector3(0, -df, 0); v.body.applyCentralForce(f); Ammo.destroy(f);
  }
  let target = 0;
  if (keys.a) target = CFG.maxSteer;
  if (keys.d) target = -CFG.maxSteer;
  setCurrentSteer(currentSteer + (target - currentSteer) * CFG.steerSpeed);
  v.vehicle.setSteeringValue(currentSteer, 0); v.vehicle.setSteeringValue(currentSteer, 1);

  if (keys.space) { brake = CFG.brakingForce; if (speedKmh > 20) spawnSkid(v); }
  v.vehicle.setBrake(brake, 0); v.vehicle.setBrake(brake, 1);
  v.vehicle.setBrake(brake * 0.35, 2); v.vehicle.setBrake(brake * 0.35, 3);

  const tl = v.mesh.userData.tlMat; if (tl) tl.emissiveIntensity = keys.space ? 2.2 : 0.5;

  const lv = getLocalVelocity(v);
  const drifting = Math.abs(lv.x) > 4 && speedKmh > 25;
  if (drifting) spawnSkid(v);

  updateEngineSound(speedKmh, keys.w && !keys.s, keys.space);
  emitExhaustFx(v, speedKmh, drifting);
  emitWheelDust(v, speedKmh, drifting || keys.space);
  if (nitroActive) emitNitroFlames(v);
  updateSpeedLines(speedKmh);
}

export function applyBrakes(v, f) {
  for (let i = 0; i < 4; i++) v.vehicle.setBrake(f, i);
  v.vehicle.applyEngineForce(0, 2); v.vehicle.applyEngineForce(0, 3);
}

export function getLocalVelocity(v) {
  const vel = v.body.getLinearVelocity();
  const wv = new THREE.Vector3(vel.x(), vel.y(), vel.z());
  return wv.applyQuaternion(v.mesh.quaternion.clone().invert());
}

export function resetVehicle(v, full) {
  const Ammo = window.Ammo;
  const sp = v.startP;
  const t = new Ammo.btTransform(); t.setIdentity();
  t.setOrigin(new Ammo.btVector3(sp.x, sp.y, sp.z));
  const yaw = Math.atan2(trackStartDir.x, trackStartDir.z);
  t.setRotation(new Ammo.btQuaternion(0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)));
  v.body.setWorldTransform(t);
  v.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
  v.body.setAngularVelocity(new Ammo.btVector3(0, 0, 0));
  v.body.activate();
  v.progress = 0; v.lastT = 0; v.lap = 0; v.ramp = 0;
  if (full) { v.finished = false; v.finishTime = 0; }
}

export function togglePause() {
  setPaused(!paused);
}
