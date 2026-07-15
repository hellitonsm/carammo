import * as THREE from 'three';
import {
  setRenderer, getRenderer,
  setScene, getScene,
  setCamera, getCamera,
  setClock,
  setSelectedScene, getSelectedScene,
  setSelectedCarColor, getSelectedCarColor,
  setAiEnabled, getAiEnabled,
  setNitroEnabled, getNitroEnabled,
  setUseNeuralAI, getUseNeuralAI,
  setRlAgent, getRlAgent,
  setVehicles, setPlayerVehicle,
  getVehicles,
  setRaceState, getRaceState,
  setPaused,
  setSnowParticles,
  setExhaustSys, setDustSys, setNitroFlameSys,
  setSpeedLines,
  setSkidMarks,
  getPhysicsWorld,
  getAudioCtx,
} from './js/state.js';
import { CFG } from './js/config.js';
import { initPhysics } from './js/physics.js';
import { initInput } from './js/player-control.js';
import { initAudio, pauseAudio } from './js/audio.js';
import { initSpeedLines } from './js/fx.js';
import { createSkidMarks } from './js/skid-marks.js';
import { loadScene } from './js/textures.js';
import { buildSky } from './js/sky.js';
import { buildTrack } from './js/track-build.js';
import { createVehicle, addVehicle } from './js/car.js';
import { createNitroFlameSystem, initParticleSystems } from './js/particles.js';
import { startCountdown } from './js/countdown.js';
import { animate } from './js/main-loop.js';
import { resetMinimap } from './js/hud.js';
import { getScene as getSceneDef } from './scenarios.js';

let ammoLoaded = false;
let animStarted = false;

const AI_COLORS = [0x9c27b0, 0xff9800, 0x00bcd4];
const AI_NAMES = ['Rocket', 'Flash', 'Shadow'];
const AI_SKILLS = [0.82, 0.88, 0.93];
const CAR_COLORS = [0xd62828, 0x1e6bb8, 0x2a9d5c, 0xf4c430, 0x1a1a1a];

async function main() {
  bindMenu();
  await waitForAmmo();
  // Ammo.js factory: populates / returns the WASM module with bt* classes
  const ammoFactory = window.Ammo;
  const ammoModule = await ammoFactory();
  if (ammoModule && ammoModule.btVector3) {
    window.Ammo = ammoModule;
  }
  ammoLoaded = true;
  updateStartButton();

  initThree();
  initPhysics();
  initInput();
  initNeuralAI();
  createSkidMarks();

  window.addEventListener('carammo-restart', () => {
    setupRace();
    startCountdown();
  });
  window.addEventListener('carammo-menu', () => {
    goToMenu();
  });
}

function waitForAmmo() {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.Ammo) return resolve();
      if (Date.now() - start > 30000) return reject(new Error('Ammo.js timeout'));
      setTimeout(poll, 50);
    })();
  });
}

function initThree() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  setRenderer(renderer);

  const scene = new THREE.Scene();
  setScene(scene);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1500
  );
  camera.position.set(0, 10, 20);
  setCamera(camera);

  const clock = new THREE.Clock();
  setClock(clock);

  initSpeedLines();
  initAudio();

  window.addEventListener('resize', () => {
    const cam = getCamera();
    const ren = getRenderer();
    if (!cam || !ren) return;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    ren.setSize(window.innerWidth, window.innerHeight);
  });
}

function initNeuralAI() {
  let agent = null;
  if (typeof RLAgent !== 'undefined') {
    agent = RLAgent.load('car-ai-agent');
    if (!agent) {
      agent = new RLAgent(12, [32, 24, 16], 2);
    }
  }
  setRlAgent(agent);
  updateAIStatus();
}

function updateAIStatus() {
  const el = document.getElementById('ai-status');
  if (!el) return;
  const agent = getRlAgent();
  if (agent && agent.trainSteps > 0) {
    el.textContent = `IA treinada: ${agent.trainSteps} passos · ${agent.statusKB} KB`;
    el.classList.add('has-data');
    el.classList.remove('cleared');
  } else {
    el.textContent = 'IA neural: sem dados (treina durante a corrida)';
    el.classList.remove('has-data');
  }
}

function bindMenu() {
  // Scene select
  document.querySelectorAll('.scene-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.scene-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      setSelectedScene(btn.dataset.scene);
      updateStartButton();
    });
  });
  // Default forest
  const forestBtn = document.querySelector('.scene-option[data-scene="forest"]');
  if (forestBtn) forestBtn.classList.add('selected');

  // Car select
  document.querySelectorAll('.car-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.car-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      setSelectedCarColor(parseInt(btn.dataset.color, 16));
      updateStartButton();
    });
  });
  const redBtn = document.querySelector('.car-option[data-color="d62828"]');
  if (redBtn) redBtn.classList.add('selected');

  // Options
  const optAi = document.getElementById('opt-ai');
  const optNitro = document.getElementById('opt-nitro');
  const optNeural = document.getElementById('opt-neural');
  if (optAi) optAi.addEventListener('change', () => setAiEnabled(optAi.checked));
  if (optNitro) optNitro.addEventListener('change', () => setNitroEnabled(optNitro.checked));
  if (optNeural) optNeural.addEventListener('change', () => setUseNeuralAI(optNeural.checked));

  // Reset AI
  const resetBtn = document.getElementById('reset-ai-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localStorage.removeItem('car-ai-agent');
      if (typeof RLAgent !== 'undefined') {
        setRlAgent(new RLAgent(12, [32, 24, 16], 2));
      }
      const el = document.getElementById('ai-status');
      if (el) {
        el.textContent = 'IA resetada — treino do zero';
        el.classList.add('cleared', 'ai-reset');
        el.classList.remove('has-data');
      }
    });
  }

  // Start
  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      document.getElementById('menu').hidden = true;
      document.getElementById('hud').hidden = false;
      const results = document.getElementById('race-results');
      if (results) results.hidden = true;
      setupRace();
      startCountdown();
      if (!animStarted) {
        animStarted = true;
        animate();
      }
    });
  }
}

function updateStartButton() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  btn.disabled = !(ammoLoaded && getSelectedScene() && getSelectedCarColor());
}

function clearScene() {
  const scene = getScene();
  if (!scene) return;

  // Remove vehicles from physics world first
  const world = getPhysicsWorld();
  const vehicles = getVehicles();
  if (world && vehicles) {
    for (const v of vehicles) {
      try {
        if (v.vehicle) world.removeAction(v.vehicle);
        if (v.body) world.removeRigidBody(v.body);
      } catch (_) { /* ignore */ }
    }
  }

  // Dispose Three.js children
  const children = [...scene.children];
  for (const obj of children) {
    scene.remove(obj);
    disposeObject(obj);
  }

  setVehicles([]);
  setPlayerVehicle(null);
  setSnowParticles(null);
  setExhaustSys(null);
  setDustSys(null);
  setNitroFlameSys(null);
  setSkidMarks([]);
  resetMinimap();
}

function disposeObject(obj) {
  if (!obj) return;
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) obj.material.forEach((m) => disposeMat(m));
    else disposeMat(obj.material);
  }
  if (obj.children) {
    for (const c of [...obj.children]) disposeObject(c);
  }
}

function disposeMat(m) {
  if (!m) return;
  if (m.map) m.map.dispose();
  m.dispose();
}

function setupRace() {
  clearScene();

  // Re-add camera to scene graph (speed lines are children of camera)
  const camera = getCamera();
  const scene = getScene();
  // camera doesn't need to be in scene for rendering, but speed lines parented to it

  const sceneId = getSelectedScene();
  const scn = loadScene(sceneId);
  buildSky(scn);
  buildTrack(scn);

  // Particle systems
  initParticleSystems();

  // Player
  const color = getSelectedCarColor();
  const player = createVehicle(color, 0, true, 'Você', 1.0);
  addVehicle(player);

  // AI
  if (getAiEnabled()) {
    for (let i = 0; i < 3; i++) {
      const ai = createVehicle(AI_COLORS[i], i + 1, false, AI_NAMES[i], AI_SKILLS[i]);
      addVehicle(ai);
    }
  }

  setPaused(false);
  setRaceState('countdown');
  createSkidMarks();

  // Resume audio
  const ctx = getAudioCtx();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function goToMenu() {
  setRaceState('menu');
  setPaused(false);
  document.getElementById('hud').hidden = true;
  document.getElementById('menu').hidden = false;
  const results = document.getElementById('race-results');
  if (results) results.hidden = true;
  pauseAudio();
  updateAIStatus();
}

main().catch((err) => {
  console.error('CarAmmo failed to start:', err);
  const btn = document.getElementById('start-btn');
  if (btn) {
    btn.textContent = 'Erro ao carregar';
    btn.disabled = true;
  }
});
