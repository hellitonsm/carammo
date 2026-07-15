import * as THREE from 'three';
import {
  getAiEnabled,
  getVehicles,
  getTrackCurve,
  getTrackLength,
  getTrackWidth,
  getRaceState,
  getControlsEnabled,
  getPaused,
  getUseNeuralAI,
  getRlAgent,
  getFrameCount,
  setFrameCount,
  getCurrentSceneDef,
} from './state.js';
import { CFG } from './config.js';
import { nearestOnCurve } from './track-helpers.js';
import { resetVehicle } from './car.js';
import { emitExhaustFx, emitWheelDust } from './fx.js';
import { spawnSkid } from './skid-marks.js';
import { getLocalVelocity } from './player-control.js';

let _nearestCache = new Map();
let _trainedThisFrame = false;

export function beginAIFrame() {
  _trainedThisFrame = false;
  _nearestCache.clear();
}

function cachedNearest(curve, pos, id) {
  if (_nearestCache.has(id)) return _nearestCache.get(id);
  const r = nearestOnCurve(curve, pos);
  _nearestCache.set(id, r);
  return r;
}

export function updateAI(dt) {
  if (!getAiEnabled()) return;
  _nearestCache.clear();

  const vehicles = getVehicles();
  const raceState = getRaceState();
  const useNeural = getUseNeuralAI();
  const agent = getRlAgent();
  let frame = getFrameCount();

  for (const v of vehicles) {
    if (v.isPlayer || v.finished) continue;
    if (
      useNeural &&
      agent &&
      raceState === 'racing' &&
      getControlsEnabled() &&
      !getPaused()
    ) {
      updateNeuralAI(v, dt, frame);
    } else {
      updateRuleBasedAI(v, dt);
    }
  }
}

function updateRuleBasedAI(v, dt) {
  const vehicle = v.vehicle;
  if (!vehicle) return;

  if (getPaused() || !getControlsEnabled() || getRaceState() !== 'racing') {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(10, 0);
    vehicle.setBrake(10, 1);
    vehicle.setBrake(10, 2);
    vehicle.setBrake(10, 3);
    return;
  }

  const curve = getTrackCurve();
  const trackLen = getTrackLength();
  const trackW = getTrackWidth();
  if (!curve) return;

  const lv = v.body.getLinearVelocity();
  const speedMs = Math.hypot(lv.x(), lv.y(), lv.z());
  const speedKmh = speedMs * 3.6;

  // Human error
  v.aiState.errorTimer -= dt;
  if (v.aiState.errorTimer <= 0) {
    v.aiState.error = (Math.random() - 0.5) * (1 - v.aiSkill) * 1.2;
    v.aiState.errorTimer = 0.4 + Math.random() * 0.7;
  }

  // Lookahead
  const lookahead = v.aiState.lookahead * (1 + speedKmh / 200);
  const aheadT =
    (v.progress +
      lookahead / trackLen +
      (Math.random() * 2.5) / trackLen) %
    1;
  const target = curve.getPointAt(aheadT);
  const pos = v.mesh.position;

  // Angle to target
  const to = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  fwd.y = 0;
  fwd.normalize();
  let ang = Math.atan2(to.x, to.z) - Math.atan2(fwd.x, fwd.z);
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  ang += v.aiState.error;

  // Steer
  const steerMult = Math.abs(ang) > 0.4 ? 3.4 : 2.8;
  let steer = Math.max(-CFG.maxSteer, Math.min(CFG.maxSteer, ang * steerMult));
  // invert for bullet convention (positive = left in our player control)
  // Player: a = +maxSteer. AI ang positive means target is to the left → +steer
  v.aiState.steer = steer;
  vehicle.setSteeringValue(steer, 0);
  vehicle.setSteeringValue(steer, 1);

  // Target speed based on curvature
  const t1 = (v.progress + 0.02) % 1;
  const t2 = (v.progress + 0.05) % 1;
  const p1 = curve.getPointAt(t1);
  const p2 = curve.getPointAt(t2);
  const tan0 = curve.getTangentAt(v.progress);
  const tan1 = curve.getTangentAt(t2);
  const sharp = 1 - Math.max(-1, Math.min(1, tan0.dot(tan1)));
  const targetSpeed = Math.max(40, 160 - sharp * 120) * v.aiSkill;

  let accel = 0;
  if (speedKmh < targetSpeed - 5) {
    accel = Math.min(1, 0.5 + (targetSpeed - speedKmh) / 80);
    vehicle.applyEngineForce(CFG.engineForce * accel * v.aiSkill, 2);
    vehicle.applyEngineForce(CFG.engineForce * accel * v.aiSkill, 3);
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
  } else if (speedKmh > targetSpeed + 10) {
    accel = 0;
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(CFG.brakingForce * 0.4, 0);
    vehicle.setBrake(CFG.brakingForce * 0.4, 1);
    vehicle.setBrake(CFG.brakingForce * 0.4, 2);
    vehicle.setBrake(CFG.brakingForce * 0.4, 3);
  } else {
    accel = 0.28;
    vehicle.applyEngineForce(CFG.engineForce * 0.28 * v.aiSkill, 2);
    vehicle.applyEngineForce(CFG.engineForce * 0.28 * v.aiSkill, 3);
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
  }
  v.aiState.accel = accel;

  // Downforce
  if (speedMs > 1) {
    v.body.applyCentralForce(new Ammo.btVector3(0, -(speedMs * speedMs * 8), 0));
  }

  // Anti-roll
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  if (up.y > 0.88) {
    v.body.applyCentralForce(new Ammo.btVector3(0, -220, 0));
  }

  // FX
  const localVel = getLocalVelocity(v);
  const drifting = Math.abs(localVel.x) > 4;
  emitExhaustFx(v, speedKmh, drifting);
  emitWheelDust(v, speedKmh, drifting);
  if (drifting && speedKmh > 25) spawnSkid(v);

  // Stuck detection
  const nearest = cachedNearest(curve, pos, v.name);
  const distFromTrack = nearest.dist;

  if (up.y < 0.3 || pos.y < -10 || distFromTrack > trackW * 3) {
    resetVehicle(v, false);
    v.aiState.stuckTimer = 0;
    return;
  }

  if (speedMs < 1.5) {
    v.aiState.stuckTimer += dt;
  } else {
    v.aiState.stuckTimer = 0;
  }
  if (v.aiState.stuckTimer > 2.5 && v.prevSpeed > 5) {
    resetVehicle(v, false);
    v.aiState.stuckTimer = 0;
  }
  v.prevSpeed = speedMs;
}

function collectCarState(v, frame) {
  const curve = getTrackCurve();
  const trackLen = getTrackLength();
  const trackW = getTrackWidth();
  const state = new Array(12).fill(0);
  if (!curve) return state;

  const lv = v.body.getLinearVelocity();
  const speedMs = Math.hypot(lv.x(), lv.y(), lv.z());
  const speedKmh = speedMs * 3.6;
  state[0] = speedKmh / 200;

  // Track angle
  const aheadT = (v.progress + 0.03) % 1;
  const target = curve.getPointAt(aheadT);
  const pos = v.mesh.position;
  const to = new THREE.Vector3(target.x - pos.x, 0, target.z - pos.z);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  fwd.y = 0;
  fwd.normalize();
  let ang = Math.atan2(to.x, to.z) - Math.atan2(fwd.x, fwd.z);
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  state[1] = ang / Math.PI;

  // Dist to center
  const nearest = cachedNearest(curve, pos, v.name + '_st');
  state[2] = nearest.dist / (trackW / 2);

  // Curvatures at 10/20/30/50%
  const lookDists = [0.1, 0.2, 0.3, 0.5];
  for (let i = 0; i < 4; i++) {
    const d = trackLen * 0.05 * lookDists[i] * 10;
    const tA = (v.progress + (d * 0.5) / trackLen) % 1;
    const tB = (v.progress + d / trackLen) % 1;
    const pA = curve.getPointAt(tA);
    const pB = curve.getPointAt(tB);
    const tanA = curve.getTangentAt(tA);
    const tanB = curve.getTangentAt(tB);
    state[3 + i] = 1 - Math.max(-1, Math.min(1, tanA.dot(tanB)));
  }

  // Terrain slope
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  state[7] = (up.y - 1) * 10;

  // Distances to other cars
  const vehicles = getVehicles();
  const dists = [];
  for (const other of vehicles) {
    if (other === v) continue;
    const d = pos.distanceTo(other.mesh.position);
    dists.push(d);
  }
  dists.sort((a, b) => a - b);
  state[8] = (dists[0] || 100) / 100;
  state[9] = (dists[1] || 100) / 100;
  state[10] = (dists[2] || 100) / 100;
  state[11] = 0;

  return state;
}

function calculateReward(v, prevProgress, frame) {
  let reward = 0;
  const curve = getTrackCurve();
  const trackW = getTrackWidth();
  if (!curve) return 0;

  let progressGain = v.progress - prevProgress;
  if (progressGain > 0.5) progressGain -= 1;
  if (progressGain < -0.5) progressGain += 1;

  reward += progressGain * 5000;

  if (v.lap > v.lastLap) {
    reward += 2000;
    v.lastLap = v.lap;
  }

  const lv = v.body.getLinearVelocity();
  const speedKmh = Math.hypot(lv.x(), lv.y(), lv.z()) * 3.6;
  reward += speedKmh * 0.5;
  if (speedKmh < 3) reward -= 20;
  else if (speedKmh < 10) reward -= 5;

  // Alignment
  const tan = curve.getTangentAt(v.progress);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  fwd.y = 0;
  fwd.normalize();
  const tanXZ = new THREE.Vector3(tan.x, 0, tan.z).normalize();
  reward += fwd.dot(tanXZ) * 5;

  // On track
  const nearest = cachedNearest(curve, v.mesh.position, v.name + '_rw');
  if (nearest.dist < trackW / 2) reward += 2;
  else if (nearest.dist < trackW) reward -= 3;
  else reward -= 15;

  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  if (up.y < 0.5) reward -= 100;

  if (progressGain < -0.005) reward -= 30;

  return reward;
}

function updateNeuralAI(v, dt, frame) {
  const vehicle = v.vehicle;
  const agent = getRlAgent();
  if (!vehicle || !agent) return;

  const curve = getTrackCurve();
  const trackW = getTrackWidth();
  if (!curve) return;

  const prevProgress = v.progress;
  const state = collectCarState(v, frame);
  const action = agent.selectAction(state);

  // Apply action
  const steerVal = action.steering * CFG.maxSteer;
  vehicle.setSteeringValue(steerVal, 0);
  vehicle.setSteeringValue(steerVal, 1);

  if (action.throttle < 0.1) {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(CFG.brakingForce * 0.5, 0);
    vehicle.setBrake(CFG.brakingForce * 0.5, 1);
    vehicle.setBrake(CFG.brakingForce * 0.5, 2);
    vehicle.setBrake(CFG.brakingForce * 0.5, 3);
  } else {
    const force = CFG.engineForce * action.throttle;
    vehicle.applyEngineForce(force, 2);
    vehicle.applyEngineForce(force, 3);
    vehicle.setBrake(0, 0);
    vehicle.setBrake(0, 1);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
  }
  v.aiState.accel = action.throttle;
  v.aiState.steer = steerVal;

  const lv = v.body.getLinearVelocity();
  const speedMs = Math.hypot(lv.x(), lv.y(), lv.z());
  const speedKmh = speedMs * 3.6;

  // Downforce
  if (speedMs > 1) {
    v.body.applyCentralForce(new Ammo.btVector3(0, -(speedMs * speedMs * 8), 0));
  }

  // FX
  emitExhaustFx(v, speedKmh, false);
  emitWheelDust(v, speedKmh, false);

  // Reward (using previous action/state if available)
  let done = false;
  let reward = 0;

  if (v.lastState && v.lastAction) {
    reward = calculateReward(v, v.lastProgress, frame);
  }

  // Stuck
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  const nearest = cachedNearest(curve, v.mesh.position, v.name + '_nk');
  if (up.y < 0.3 || nearest.dist > trackW * 3 || v.mesh.position.y < -10) {
    reward = -500;
    done = true;
    if (v.lastState && v.lastAction) {
      agent.remember(v.lastState, v.lastAction, reward, state, true);
    }
    resetVehicle(v, false);
    v.lastState = null;
    v.lastAction = null;
    v.aiState.stuckTimer = 0;
    return;
  }

  if (speedMs < 2) {
    v.aiState.stuckTimer += dt;
  } else {
    v.aiState.stuckTimer = 0;
  }
  if (v.aiState.stuckTimer > 4) {
    reward = -200;
    done = true;
    if (v.lastState && v.lastAction) {
      agent.remember(v.lastState, v.lastAction, reward, state, true);
    }
    resetVehicle(v, false);
    v.lastState = null;
    v.lastAction = null;
    v.aiState.stuckTimer = 0;
    return;
  }

  if (v.lastState && v.lastAction) {
    agent.remember(v.lastState, v.lastAction, reward, state, done);
  }

  v.lastState = state;
  v.lastAction = action;
  v.lastProgress = prevProgress;
  v.prevSpeed = speedMs;

  // Train
  let fc = getFrameCount();
  fc++;
  setFrameCount(fc);
  if (fc % 10 === 0 && !_trainedThisFrame) {
    agent.train();
    _trainedThisFrame = true;
  }
  if (fc % 1000 === 0) {
    agent.save('car-ai-agent');
  }
}
