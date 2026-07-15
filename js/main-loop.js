// ============================================================================
//  Main loop — requestAnimationFrame driver, physics step, render
// ============================================================================

import * as THREE from 'three';
import { scene, renderer, camera, clock, sun, vehicles, playerVehicle, physicsWorld,
         raceState, paused, snowParticles, exhaustSys, dustSys, nitroFlameSys,
         setFrameProgress } from './state.js';
import { syncVehicle, updateCamera } from './sync-camera.js';
import { updatePlayerVehicle, resetVehicle } from './player-control.js';
import { updateAI, beginAIFrame } from './ai.js';
import { checkLaps, updateProgress } from './lap-race.js';
import { updateHUD, updateMinimap } from './hud.js';
import { updateCountdown } from './countdown.js';
import { updateSkids, spawnSkid } from './skid-marks.js';
import { updateWorldParticles } from './particles.js';

export function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 30);
  updateCountdown(dt);
  updatePlayerVehicle(dt);
  beginAIFrame();
  updateAI(dt);
  physicsWorld.stepSimulation(dt, 4, 1 / 120);
  for (const v of vehicles) {
    v.vehicle.updateVehicle(dt);
    syncVehicle(v);
    updateProgress(v);
    if (v.mesh.position.y < -20 && raceState === 'racing' && !paused) resetVehicle(v, false);
  }
  setFrameProgress(playerVehicle.progress);
  checkLaps();
  updateCamera(dt);
  updateHUD();
  updateMinimap();
  updateSkids(dt);
  if (exhaustSys) updateWorldParticles(exhaustSys, dt, 1.5);
  if (dustSys) updateWorldParticles(dustSys, dt, -2);
  if (nitroFlameSys) updateWorldParticles(nitroFlameSys, dt, -1);
  updateSnow(dt);
  if (sun && playerVehicle) {
    const tx = playerVehicle.mesh.position.x, tz = playerVehicle.mesh.position.z;
    sun.target.position.set(tx, 0, tz);
    sun.position.set(tx + 80, playerVehicle.mesh.position.y + 110, tz + 50);
    sun.target.updateMatrixWorld();
  }
  renderer.render(scene, camera);
}

function updateSnow(dt) {
  if (!snowParticles) return;
  const pos = snowParticles.geometry.attributes.position.array;
  const vel = snowParticles.userData.vel;
  const cx = playerVehicle.mesh.position.x, cz = playerVehicle.mesh.position.z;
  for (let i = 0; i < pos.length / 3; i++) {
    pos[i * 3 + 1] -= vel[i] * 60 * dt;
    pos[i * 3] += Math.sin(performance.now() * 0.001 + i) * 0.02;
    if (pos[i * 3 + 1] < -2) {
      pos[i * 3] = cx + (Math.random() - 0.5) * 200;
      pos[i * 3 + 1] = 40 + Math.random() * 20;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * 200;
    }
  }
  snowParticles.geometry.attributes.position.needsUpdate = true;
}
