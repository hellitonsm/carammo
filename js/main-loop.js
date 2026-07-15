import {
  getClock,
  getRenderer,
  getScene,
  getCamera,
  getPhysicsWorld,
  getVehicles,
  getPlayerVehicle,
  getRaceState,
  getPaused,
  setFrameProgress,
  getExhaustSys,
  getDustSys,
  getNitroFlameSys,
  getSnowParticles,
  getSun,
} from './state.js';
import { updateCountdown } from './countdown.js';
import { updatePlayerVehicle } from './player-control.js';
import { beginAIFrame, updateAI } from './ai.js';
import { syncVehicle, updateCamera } from './sync-camera.js';
import { updateProgress, checkLaps } from './lap-race.js';
import { updateHUD, updateMinimap } from './hud.js';
import { updateSkids } from './skid-marks.js';
import { updateWorldParticles } from './particles.js';
import { updateSnow } from './track-environment.js';
import { resetVehicle } from './car.js';

let _running = false;

export function animate() {
  _running = true;
  requestAnimationFrame(animate);

  const clock = getClock();
  const renderer = getRenderer();
  const scene = getScene();
  const camera = getCamera();
  if (!clock || !renderer || !scene || !camera) return;

  let dt = clock.getDelta();
  dt = Math.min(dt, 1 / 30); // clamp anti-spike

  updateCountdown(dt);
  updatePlayerVehicle(dt);
  beginAIFrame();
  updateAI(dt);

  const physicsWorld = getPhysicsWorld();
  if (physicsWorld) {
    physicsWorld.stepSimulation(dt, 4, 1 / 120);
  }

  const vehicles = getVehicles();
  const raceState = getRaceState();
  const paused = getPaused();

  for (const v of vehicles) {
    if (v.vehicle) v.vehicle.updateVehicle(dt);
    syncVehicle(v);
    updateProgress(v);
    if (
      v.mesh &&
      v.mesh.position.y < -20 &&
      raceState === 'racing' &&
      !paused
    ) {
      resetVehicle(v, false);
    }
  }

  const player = getPlayerVehicle();
  if (player) setFrameProgress(player.progress);

  checkLaps();
  updateCamera(dt);
  updateHUD();
  updateMinimap();
  updateSkids(dt);

  updateWorldParticles(getExhaustSys(), dt, 1.5);
  updateWorldParticles(getDustSys(), dt, -2);
  updateWorldParticles(getNitroFlameSys(), dt, -1);

  if (getSnowParticles()) updateSnow(dt);

  renderer.render(scene, camera);
}

export function isAnimating() {
  return _running;
}
