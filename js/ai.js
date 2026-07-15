// ============================================================================
//  AI — AI vehicle driving logic (rule-based + neural network)
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



export function updateAI(dt) {
  const Ammo = window.Ammo;
  if (!aiEnabled) return;
  for (const v of vehicles) {
    if (v.isPlayer || v.finished) continue;

    if (useNeuralAI && rlAgent && raceState === 'racing' && controlsEnabled && !paused) {
      if (!v.aiState.prevProgress) v.aiState.prevProgress = v.progress;
      const state = collectCarState(v);
      const action = rlAgent.selectAction(state);
      const steerVal = (action[0] * 2 - 1) * CFG.maxSteer;
      const throttle = action[1];

      v.vehicle.setSteeringValue(steerVal, 0);
      v.vehicle.setSteeringValue(steerVal, 1);

      const engine = CFG.engineForce * throttle;
      const brake = throttle < 0.1 ? CFG.brakingForce * 0.4 : 0;
      v.vehicle.applyEngineForce(engine, 2);
      v.vehicle.applyEngineForce(engine, 3);
      v.vehicle.setBrake(brake, 0);
      v.vehicle.setBrake(brake, 1);
      v.vehicle.setBrake(brake * 0.3, 2);
      v.vehicle.setBrake(brake * 0.3, 3);

      v.aiState.accel = throttle;
      v.aiState.steer = steerVal;

      const reward = calculateReward(v, v.aiState.prevProgress);
      const newState = collectCarState(v);
      const done = v.finished || v.mesh.position.y < -10;
      rlAgent.remember(state, action, reward, newState, done);
      v.aiState.prevProgress = v.progress;

      setFrameCount(frameCount + 1);
      if (frameCount % 4 === 0) rlAgent.train();
      if (frameCount % 3000 === 0) rlAgent.save('car-ai-agent');

      const lv = getLocalVelocity(v);
      const vel = v.body.getLinearVelocity();
      const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
      if (speedMs > 1) {
        const df = speedMs * speedMs * 8;
        const f = new Ammo.btVector3(0, -df, 0);
        v.body.applyCentralForce(f); Ammo.destroy(f);
      }
      const chassisUp = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
      if (chassisUp.y > 0.88) {
        const anti = new Ammo.btVector3(0, -220, 0);
        v.body.applyCentralForce(anti); Ammo.destroy(anti);
      }
      emitExhaustFx(v, speedMs * 3.6, Math.abs(lv.x) > 3);
      if (Math.abs(lv.x) > 3 || v.aiState.accel > 0.7) emitWheelDust(v, speedMs * 3.6, Math.abs(lv.x) > 3);
      v.aiState.stuckTimer = (v.aiState.stuckTimer || 0) + dt;
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
      const distFromTrack = nearestOnCurve(trackCurve, v.mesh.position).dist;
      if (up.y < 0.3 || v.mesh.position.y < -10 || distFromTrack > trackWidth * 3) {
        const badReward = calculateReward(v, v.aiState.prevProgress) - 500;
        rlAgent.remember(state, action, badReward, collectCarState(v), true);
        resetVehicle(v, false); v.aiState.stuckTimer = 0; v.aiState.prevProgress = 0;
      }
      else if (speedMs > 5) {
        v.aiState.stuckTimer = 0;
      }
      else if (v.aiState.stuckTimer > 2.5 && speedMs < 1.5 && v.aiState.prevSpeed > 5) {
        const badReward = calculateReward(v, v.aiState.prevProgress) - 200;
        rlAgent.remember(state, action, badReward, collectCarState(v), true);
        resetVehicle(v, false); v.aiState.stuckTimer = 0; v.aiState.prevProgress = 0;
      }
      v.aiState.prevSpeed = speedMs;
      continue;
    }

    if (paused || !controlsEnabled || raceState !== 'racing') {
      applyBrakes(v, CFG.brakingForce * 0.4); v.aiState.accel = 0; continue;
    }
    const ai = v.aiState;
    ai.errorTimer -= dt;
    if (ai.errorTimer <= 0) { ai.error = (Math.random() - 0.5) * (1 - v.aiSkill) * 1.2; ai.errorTimer = 0.4 + Math.random() * 0.7; }
    const aheadT = (v.progress + (ai.lookahead + Math.random() * 2.5) / trackLength) % 1;
    const ahead = trackCurve.getPointAt(aheadT);
    const here = v.mesh.position;
    const to = new THREE.Vector3().subVectors(ahead, here); to.y = 0; to.normalize();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
    let ang = Math.atan2(to.x, to.z) - Math.atan2(fwd.x, fwd.z);
    while (ang > Math.PI) ang -= Math.PI * 2;
    while (ang < -Math.PI) ang += Math.PI * 2;
    ang += ai.error;
    let steer = 0;
    const steerMult = Math.abs(ang) > 0.4 ? 3.4 : 2.8;
    if (ang > 0.025) steer = Math.min(CFG.maxSteer, ang * steerMult);
    else if (ang < -0.025) steer = Math.max(-CFG.maxSteer, ang * steerMult);
    v.vehicle.setSteeringValue(steer, 0); v.vehicle.setSteeringValue(steer, 1);

    const vel = v.body.getLinearVelocity();
    const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
    const speedKmh = speedMs * 3.6;
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
    if (speedMs > 1) { const df = speedMs * speedMs * 8; const f = new Ammo.btVector3(0, -df, 0); v.body.applyCentralForce(f); Ammo.destroy(f); }
    const chassisUp = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
    if (chassisUp.y > 0.88) {
      const anti = new Ammo.btVector3(0, -220, 0);
      v.body.applyCentralForce(anti); Ammo.destroy(anti);
    }
    emitExhaustFx(v, speedKmh, Math.abs(lv.x) > 3);
    if (Math.abs(lv.x) > 3 || ai.accel > 0.7) emitWheelDust(v, speedKmh, Math.abs(lv.x) > 3);

    ai.stuckTimer = (ai.stuckTimer || 0) + dt;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
    const gs = Math.hypot(lv.x, lv.z);
    const distFromTrack = nearestOnCurve(trackCurve, v.mesh.position).dist;
    if (up.y < 0.3 || v.mesh.position.y < -10 || distFromTrack > trackWidth * 3) {
      resetVehicle(v, false); ai.stuckTimer = 0;
    }
    else if (speedMs > 5) {
      ai.stuckTimer = 0;
    }
    else if (ai.stuckTimer > 2.5 && speedMs < 1.5 && ai.prevSpeed > 5) {
      resetVehicle(v, false); ai.stuckTimer = 0;
    }
    ai.prevSpeed = speedMs;
  }
}

function collectCarState(v) {
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  const speedKmh = speedMs * 3.6;
  const nr = nearestOnCurve(trackCurve, v.mesh.position);
  const distToCenter = nr.dist / (trackWidth / 2);
  const p = trackCurve.getPointAt(v.progress);
  const tan = trackCurve.getTangentAt(v.progress);
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(v.mesh.quaternion);
  const toTrack = new THREE.Vector3().subVectors(p, v.mesh.position);
  toTrack.y = 0;
  const trackAngle = Math.atan2(toTrack.x, toTrack.z) - Math.atan2(fwd.x, fwd.z);
  const aheadT = (v.progress + 0.05) % 1;
  const ahead = trackCurve.getPointAt(aheadT);
  const curvature = ahead.distanceTo(p) / (trackLength * 0.05);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  const terrainSlope = up.y - 1;
  const car1Dist = getDistanceToNearestCar(v, 0);
  const car2Dist = getDistanceToNearestCar(v, 1);
  const car3Dist = getDistanceToNearestCar(v, 2);
  return [speedKmh / 200, trackAngle / Math.PI, distToCenter, curvature, terrainSlope * 10,
          car1Dist, car2Dist, car3Dist, 0, 0, 0, 0];
}

function getDistanceToNearestCar(v, index) {
  let distances = [];
  for (const other of vehicles) {
    if (other === v) continue;
    const dist = v.mesh.position.distanceTo(other.mesh.position);
    distances.push(dist);
  }
  distances.sort((a, b) => a - b);
  return distances[index] ? distances[index] / 100 : 1;
}

function calculateReward(v, prevProgress) {
  const progressGain = v.progress - prevProgress;
  let reward = progressGain * 100;
  if (v.lap > (v.lastLap || 0)) { reward += 500; v.lastLap = v.lap; }
  const vel = v.body.getLinearVelocity();
  const speedMs = Math.hypot(vel.x(), vel.y(), vel.z());
  reward += speedMs * 0.1;
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(v.mesh.quaternion);
  if (up.y < 0.5) reward -= 50;
  if (progressGain < -0.01) reward -= 10;
  return reward;
}

export function initNeuralAI() {
  try {
    const loaded = RLAgent.load('car-ai-agent');
    if (loaded) {
      setRlAgent(loaded);
    } else {
      const agent = new RLAgent(12, [32, 24, 16], 2, {
        learningRate: 0.001, gamma: 0.99, epsilon: 1.0, epsilonMin: 0.01,
        epsilonDecay: 0.9995, batchSize: 64, bufferSize: 100000
      });
      setRlAgent(agent);
    }
  } catch (e) {
    console.warn('Failed to initialize neural AI:', e);
    setUseNeuralAI(false);
  }
}
