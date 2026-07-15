// ============================================================================
//  AI — AI vehicle driving logic (rule-based + neural network)
//  OPTIMIZED: pre-allocated vectors, cached lookups, reduced training freq
// ============================================================================

import * as THREE from 'three';
import { CFG } from './config.js';
import { vehicles, playerVehicle, aiEnabled, trackCurve, trackLength, trackWidth,
         raceState, controlsEnabled, paused, frameCount, useNeuralAI, rlAgent,
         setFrameCount, setRlAgent, setUseNeuralAI } from './state.js';
import { nearestOnCurve } from './track-helpers.js';
import { applyBrakes, getLocalVelocity, resetVehicle } from './player-control.js';
import { emitExhaustFx, emitWheelDust } from './fx.js';
import { spawnSkid } from './skid-marks.js';

// ---- Pre-allocated temp vectors (avoid GC pressure) ----
const _fwd = new THREE.Vector3();
const _up = new THREE.Vector3();
const _toTrack = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _chassisUp = new THREE.Vector3();
const _ahead = new THREE.Vector3();
const _here = new THREE.Vector3();
const _to = new THREE.Vector3();
let _ammoVec = null; // lazy-init after Ammo loads
let _ammoVec2 = null;

function getAmmoVec(x, y, z) {
  const Ammo = window.Ammo;
  if (!_ammoVec) { _ammoVec = new Ammo.btVector3(0, 0, 0); _ammoVec2 = new Ammo.btVector3(0, 0, 0); }
  _ammoVec.setValue(x, y, z);
  return _ammoVec;
}

function getAmmoVec2(x, y, z) {
  if (!_ammoVec2) { _ammoVec2 = new window.Ammo.btVector3(0, 0, 0); }
  _ammoVec2.setValue(x, y, z);
  return _ammoVec2;
}

// ---- Cached nearestOnCurve per frame ----
const _nearestCache = new Map();
let _nearestCacheFrame = -1;

function getCachedNearest(v, frameNum) {
  if (_nearestCacheFrame !== frameNum) {
    _nearestCache.clear();
    _nearestCacheFrame = frameNum;
  }
  let cached = _nearestCache.get(v);
  if (!cached) {
    cached = nearestOnCurve(trackCurve, v.mesh.position);
    _nearestCache.set(v, cached);
  }
  return cached;
}

// ---- Track whether we already trained this frame ----
let _trainedThisFrame = false;

export function beginAIFrame() {
  _trainedThisFrame = false;
}

export function updateAI(dt) {
  const Ammo = window.Ammo;
  if (!aiEnabled) return;

  const currentFrame = frameCount;
  // Reset nearest cache each call (updateAI is called once per frame)
  _nearestCache.clear();
  _nearestCacheFrame = currentFrame;

  for (const v of vehicles) {
    if (v.isPlayer || v.finished) continue;

    if (useNeuralAI && rlAgent && raceState === 'racing' && controlsEnabled && !paused) {
      updateNeuralAI(v, dt, currentFrame);
      continue;
    }

    updateRuleBasedAI(v, dt);
  }
}

// ============================================================================
//  Neural AI path
// ============================================================================

function updateNeuralAI(v, dt, currentFrame) {
  const Ammo = window.Ammo;
  if (!v.aiState.prevProgress) v.aiState.prevProgress = v.progress;

  // Collect state once (reuses cached nearestOnCurve)
  const state = collectCarState(v, currentFrame);
  const action = rlAgent.selectAction(state);
  const steerVal = action.steering * CFG.maxSteer;
  const throttle = Math.max(0, Math.min(1, action.throttle));

  // Apply controls
  v.vehicle.setSteeringValue(steerVal, 0);
  v.vehicle.setSteeringValue(steerVal, 1);
  const engine = CFG.engineForce * throttle;
  const brake = throttle < 0.1 ? CFG.brakingForce * 0.3 : 0;
  v.vehicle.applyEngineForce(engine, 2);
  v.vehicle.applyEngineForce(engine, 3);
  v.vehicle.setBrake(brake, 0);
  v.vehicle.setBrake(brake, 1);
  v.vehicle.setBrake(brake * 0.3, 2);
  v.vehicle.setBrake(brake * 0.3, 3);

  v.aiState.accel = throttle;
  v.aiState.steer = steerVal;

  // Reward (uses data already computed in collectCarState via cache)
  const reward = calculateReward(v, v.aiState.prevProgress, currentFrame);

  // New state after action applied (next frame will have physics updated)
  const newState = collectCarState(v, currentFrame);
  const done = v.finished || v.mesh.position.y < -10;
  rlAgent.remember(state, action, reward, newState, done);
  v.aiState.prevProgress = v.progress;

  // Increment frame counter and train — only ONCE per frame across all cars
  setFrameCount(frameCount + 1);
  if (!_trainedThisFrame && frameCount % 10 === 0) {
    rlAgent.train();
    _trainedThisFrame = true;
  }
  if (frameCount % 1000 === 0) rlAgent.save('car-ai-agent');

  // Physics helpers (using pre-allocated Ammo vectors)
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());

  if (speedMs > 1) {
    const df = speedMs * speedMs * 8;
    v.body.applyCentralForce(getAmmoVec(0, -df, 0));
  }

  _chassisUp.set(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  if (_chassisUp.y > 0.88) {
    v.body.applyCentralForce(getAmmoVec2(0, -220, 0));
  }

  // FX
  const lv = getLocalVelocity(v);
  const speedKmh = speedMs * 3.6;
  emitExhaustFx(v, speedKmh, Math.abs(lv.x) > 3);
  if (Math.abs(lv.x) > 3 || v.aiState.accel > 0.7) emitWheelDust(v, speedKmh, Math.abs(lv.x) > 3);

  // Stuck detection
  v.aiState.stuckTimer = (v.aiState.stuckTimer || 0) + dt;
  _up.set(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  const nr = getCachedNearest(v, currentFrame);
  const distFromTrack = nr.dist;

  // Off-track timer: punish cars that leave the track for too long
  if (distFromTrack > trackWidth) {
    v.aiState.offTrackTimer += dt;
  } else {
    v.aiState.offTrackTimer = 0;
  }

  if (_up.y < 0.3 || v.mesh.position.y < -10 || distFromTrack > trackWidth * 3) {
    rlAgent.remember(state, action, -500, collectCarState(v, currentFrame), true);
    resetVehicle(v, false);
    v.aiState.stuckTimer = 0; v.aiState.prevProgress = 0; v.aiState.offTrackTimer = 0;
  } else if (v.aiState.offTrackTimer > 3.0) {
    rlAgent.remember(state, action, -300, collectCarState(v, currentFrame), true);
    resetVehicle(v, false);
    v.aiState.stuckTimer = 0; v.aiState.prevProgress = 0; v.aiState.offTrackTimer = 0;
  } else if (speedMs > 5) {
    v.aiState.stuckTimer = 0;
  } else if (v.aiState.stuckTimer > 4.0 && speedMs < 2.0) {
    rlAgent.remember(state, action, -200, collectCarState(v, currentFrame), true);
    resetVehicle(v, false);
    v.aiState.stuckTimer = 0; v.aiState.prevProgress = 0; v.aiState.offTrackTimer = 0;
  }
  v.aiState.prevSpeed = speedMs;
}

// ============================================================================
//  Rule-based AI path (unchanged logic, optimized vectors)
// ============================================================================

function updateRuleBasedAI(v, dt) {
  const Ammo = window.Ammo;
  if (paused || !controlsEnabled || raceState !== 'racing') {
    applyBrakes(v, CFG.brakingForce * 0.4); v.aiState.accel = 0; return;
  }
  const ai = v.aiState;
  ai.errorTimer -= dt;
  if (ai.errorTimer <= 0) { ai.error = (Math.random() - 0.5) * (1 - v.aiSkill) * 1.2; ai.errorTimer = 0.4 + Math.random() * 0.7; }

  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;

  const aheadT = (v.progress + (ai.lookahead * (1 + speedKmh / 200) + Math.random() * 2.5) / trackLength) % 1;
  _ahead.copy(trackCurve.getPointAt(aheadT));
  _here.copy(v.mesh.position);
  _to.subVectors(_ahead, _here); _to.y = 0; _to.normalize();
  _fwd.set(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  let ang = Math.atan2(_to.x, _to.z) - Math.atan2(_fwd.x, _fwd.z);
  while (ang > Math.PI) ang -= Math.PI * 2;
  while (ang < -Math.PI) ang += Math.PI * 2;
  ang += ai.error;
  let steer = 0;
  const steerMult = Math.abs(ang) > 0.4 ? 3.4 : 2.8;
  if (ang > 0.025) steer = Math.min(CFG.maxSteer, ang * steerMult);
  else if (ang < -0.025) steer = Math.max(-CFG.maxSteer, ang * steerMult);
  v.vehicle.setSteeringValue(steer, 0); v.vehicle.setSteeringValue(steer, 1);

  const sharp = Math.abs(ang);
  const target = Math.max(40, 160 - sharp * 120) * v.aiSkill;
  let engine = 0, brake = 0;
  if (speedKmh < target - 5) { engine = CFG.engineForce * (0.55 + (target - speedKmh) / 160); ai.accel = Math.min(1, (target - speedKmh) / 85); }
  else if (speedKmh > target + 10) { brake = CFG.brakingForce * 0.4; ai.accel = 0; }
  else { engine = CFG.engineForce * 0.28; ai.accel = 0.24; }
  v.vehicle.applyEngineForce(engine, 2); v.vehicle.applyEngineForce(engine, 3);
  v.vehicle.setBrake(brake, 0); v.vehicle.setBrake(brake, 1);
  v.vehicle.setBrake(brake * 0.3, 2); v.vehicle.setBrake(brake * 0.3, 3);

  const lv = getLocalVelocity(v);
  if (Math.abs(lv.x) > 4 && speedKmh > 28) spawnSkid(v);
  if (speedMs > 1) { const df = speedMs * speedMs * 8; v.body.applyCentralForce(getAmmoVec(0, -df, 0)); }
  _chassisUp.set(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  if (_chassisUp.y > 0.88) {
    v.body.applyCentralForce(getAmmoVec2(0, -220, 0));
  }
  emitExhaustFx(v, speedKmh, Math.abs(lv.x) > 3);
  if (Math.abs(lv.x) > 3 || ai.accel > 0.7) emitWheelDust(v, speedKmh, Math.abs(lv.x) > 3);

  ai.stuckTimer = (ai.stuckTimer || 0) + dt;
  _up.set(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  const distFromTrack = nearestOnCurve(trackCurve, v.mesh.position).dist;

  // Off-track timer: reset cars that leave the track for too long
  if (distFromTrack > trackWidth) {
    ai.offTrackTimer = (ai.offTrackTimer || 0) + dt;
  } else {
    ai.offTrackTimer = 0;
  }

  if (_up.y < 0.3 || v.mesh.position.y < -10 || distFromTrack > trackWidth * 3) {
    resetVehicle(v, false); ai.stuckTimer = 0; ai.offTrackTimer = 0;
  }
  else if (ai.offTrackTimer > 3.0) {
    resetVehicle(v, false); ai.stuckTimer = 0; ai.offTrackTimer = 0;
  }
  else if (speedMs > 5) {
    ai.stuckTimer = 0;
  }
  else if (ai.stuckTimer > 2.5 && speedMs < 1.5 && ai.prevSpeed > 5) {
    resetVehicle(v, false); ai.stuckTimer = 0;
  }
  ai.prevSpeed = speedMs;
}

// ============================================================================
//  State collection — optimized with cached lookups and pre-allocated vectors
// ============================================================================

function collectCarState(v, frameNum) {
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;

  // Use cached nearestOnCurve
  const nr = getCachedNearest(v, frameNum);
  const distToCenter = nr.dist / (trackWidth / 2);

  const p = trackCurve.getPointAt(v.progress);
  _fwd.set(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  _toTrack.set(p.x - v.mesh.position.x, 0, p.z - v.mesh.position.z);
  const trackAngle = Math.atan2(_toTrack.x, _toTrack.z) - Math.atan2(_fwd.x, _fwd.z);

  // Multi-distance lookahead curvature (10%, 20%, 30%, 50% ahead)
  const ahead1T = (v.progress + 0.10) % 1;
  const ahead2T = (v.progress + 0.20) % 1;
  const ahead3T = (v.progress + 0.30) % 1;
  const ahead4T = (v.progress + 0.50) % 1;
  const p1 = trackCurve.getPointAt(ahead1T);
  const p2 = trackCurve.getPointAt(ahead2T);
  const p3 = trackCurve.getPointAt(ahead3T);
  const p4 = trackCurve.getPointAt(ahead4T);
  const seg = trackLength * 0.05;
  const curv1 = p1.distanceTo(p) / seg;
  const curv2 = p2.distanceTo(p1) / seg;
  const curv3 = p3.distanceTo(p2) / seg;
  const curv4 = p4.distanceTo(p3) / seg;

  _up.set(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  const terrainSlope = _up.y - 1;

  // Compute distances to other cars in one pass
  const carDists = computeCarDistances(v);

  return [speedKmh / 200, trackAngle / Math.PI, distToCenter, curv1, curv2, curv3, curv4,
          terrainSlope * 10, carDists[0], carDists[1], carDists[2], 0];
}

// Compute distances to nearest cars in a single pass (no repeated sorting)
function computeCarDistances(v) {
  const px = v.mesh.position.x, py = v.mesh.position.y, pz = v.mesh.position.z;
  const dists = [];
  for (const other of vehicles) {
    if (other === v) continue;
    const ox = other.mesh.position.x - px;
    const oy = other.mesh.position.y - py;
    const oz = other.mesh.position.z - pz;
    dists.push(Math.sqrt(ox * ox + oy * oy + oz * oz));
  }
  dists.sort((a, b) => a - b);
  return [
    (dists[0] || 100) / 100,
    (dists[1] || 100) / 100,
    (dists[2] || 100) / 100
  ];
}

// ============================================================================
//  Reward — uses cached nearestOnCurve, pre-allocated vectors
// ============================================================================

function calculateReward(v, prevProgress, frameNum) {
  let reward = 0;

  // Progress along track (main incentive)
  let progressGain = v.progress - prevProgress;
  if (progressGain < -0.5) progressGain += 1.0;
  if (progressGain > 0.5) progressGain -= 1.0;
  reward += progressGain * 5000;

  // Lap completion bonus
  if (v.lap > (v.lastLap || 0)) { reward += 2000; v.lastLap = v.lap; }

  // Speed rewards
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;
  reward += speedKmh * 0.5;

  if (speedKmh < 3) reward -= 20;
  else if (speedKmh < 10) reward -= 5;

  // Track alignment bonus (reuse pre-allocated vectors)
  _fwd.set(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  _tan.copy(trackCurve.getTangentAt(v.progress));
  _tan.y = 0; _tan.normalize();
  reward += _fwd.dot(_tan) * 5;

  // Staying on track (use cached nearest)
  const distFromTrack = getCachedNearest(v, frameNum).dist;
  const trackHalf = trackWidth / 2;
  if (distFromTrack < trackHalf) {
    reward += 2;
  } else if (distFromTrack < trackWidth) {
    reward -= 3;
  } else {
    // Heavy escalating penalty the longer the car stays off-track
    const offTrackTime = v.aiState.offTrackTimer || 0;
    reward -= 15 + offTrackTime * 40;
  }

  // Orientation penalty
  _up.set(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  if (_up.y < 0.5) reward -= 100;

  // Backward movement penalty
  if (progressGain < -0.005) reward -= 30;

  return reward;
}

// ============================================================================
//  Init
// ============================================================================

export function initNeuralAI() {
  try {
    const loaded = RLAgent.load('car-ai-agent');
    if (loaded) {
      setRlAgent(loaded);
      console.log(`[AI] Loaded saved agent — ε=${loaded.epsilon.toFixed(3)}, steps=${loaded.trainSteps}`);
    } else {
      const agent = new RLAgent(12, [32, 24, 16], 2, {
        learningRate: 0.003, gamma: 0.95, epsilon: 0.6, epsilonMin: 0.05,
        epsilonDecay: 0.9997, batchSize: 32, bufferSize: 30000
      });
      setRlAgent(agent);
      console.log('[AI] Created new agent with improved exploration');
    }
    window.addEventListener('beforeunload', () => {
      if (rlAgent) rlAgent.save('car-ai-agent');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && rlAgent) rlAgent.save('car-ai-agent');
    });
  } catch (e) {
    console.warn('Failed to initialize neural AI:', e);
    setUseNeuralAI(false);
  }
}
