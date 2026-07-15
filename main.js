// ============================================================================
//  CarAmmo DELUXE — Entry point
//  3D racing with Ammo.js + Three.js
//  3 scenarios · AI · Nitro · Multi-camera · Particles · Engine sound
// ============================================================================

import * as THREE from 'three';

import * as S from './js/state.js';

import { initPhysics } from './js/physics.js';
import { buildSky } from './js/sky.js';
import { buildTrack } from './js/track-build.js';
import { loadScene } from './js/textures.js';
import { createVehicle, addVehicle } from './js/car.js';
import { initInput } from './js/player-control.js';
import { initNeuralAI } from './js/ai.js';
import { startCountdown } from './js/countdown.js';
import { animate } from './js/main-loop.js';
import { createSkidMarks } from './js/skid-marks.js';
import { initSpeedLines } from './js/fx.js';
import { initAudio } from './js/audio.js';

let Ammo = window.Ammo;

// ---- Three.js bootstrap ----
function initThree() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.domElement.style.position = 'fixed';
  renderer.domElement.style.top = '0';
  renderer.domElement.style.left = '0';
  renderer.domElement.style.zIndex = '1';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  camera.position.set(0, 10, 20);
  const clock = new THREE.Clock();

  S.setRenderer(renderer);
  S.setScene(scene);
  S.setCamera(camera);
  S.setClock(clock);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  initSpeedLines();
  initAudio();
}

// ---- Race setup ----
function setupRace() {
  clearScene();
  loadScene(S.selectedScene);
  buildSky(S.currentSceneDef);
  buildTrack(S.currentSceneDef);

  const pv = createVehicle(S.selectedCarColor, 0, true, 'Voce', 1.0);
  addVehicle(pv);

  if (S.aiEnabled) {
    const aiColors = [0x9c27b0, 0xff9800, 0x00bcd4];
    const aiNames = ['Rocket', 'Flash', 'Shadow'];
    const skills = [0.82, 0.88, 0.93];
    for (let i = 0; i < 3; i++) {
      addVehicle(createVehicle(aiColors[i], i + 1, false, aiNames[i], skills[i]));
    }
  }
}

function clearScene() {
  const scene = S.scene;
  while (scene.children.length > 0) {
    const o = scene.children[0];
    scene.remove(o);
    if (o.geometry) o.geometry.dispose && o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
      else o.material.dispose && o.material.dispose();
    }
  }
  S.setVehicles([]);
  S.setPlayerVehicle(null);
}

// ---- Ammo.js loader ----
function waitForAmmo() {
  return new Promise(res => {
    const t = performance.now();
    (function chk() {
      if (typeof window.Ammo === 'function') return res();
      if (performance.now() - t > 30000) return res(new Error('Ammo not loaded'));
      setTimeout(chk, 30);
    })();
  });
}

// ---- Menu ----
let ammoLoaded = false;

function tryStart() {
  document.getElementById('start-btn').disabled = !(ammoLoaded && S.selectedScene && S.selectedCarColor);
}

function bindMenu() {
  document.querySelectorAll('.scene-option').forEach(o => {
    o.addEventListener('click', () => {
      document.querySelectorAll('.scene-option').forEach(x => x.classList.remove('selected'));
      o.classList.add('selected');
      S.setSelectedScene(o.dataset.scene);
      tryStart();
    });
  });
  document.querySelectorAll('.car-option').forEach(o => {
    o.addEventListener('click', () => {
      document.querySelectorAll('.car-option').forEach(x => x.classList.remove('selected'));
      o.classList.add('selected');
      S.setSelectedCarColor(parseInt(o.dataset.color));
      tryStart();
    });
  });
  document.getElementById('opt-ai').addEventListener('change', e => S.setAiEnabled(e.target.checked));
  document.getElementById('opt-nitro').addEventListener('change', e => S.setNitroEnabled(e.target.checked));
  document.getElementById('opt-neural').addEventListener('change', e => S.setUseNeuralAI(e.target.checked));
  // Reset AI weights button
  document.getElementById('reset-ai-btn').addEventListener('click', () => {
    try {
      localStorage.removeItem('car-ai-agent');
      const status = document.getElementById('ai-status');
      status.textContent = '✓ Pesos apagados!';
      status.className = 'ai-status-text cleared';
      // If agent is already loaded, reinitialize
      if (S.rlAgent) {
        const agent = new RLAgent(12, [32, 24, 16], 2, {
          learningRate: 0.003, gamma: 0.95, epsilon: 0.6, epsilonMin: 0.05,
          epsilonDecay: 0.9997, batchSize: 32, bufferSize: 30000
        });
        S.setRlAgent(agent);
      }
      setTimeout(() => { status.textContent = ''; status.className = 'ai-status-text'; }, 3000);
    } catch (e) {
      console.warn('Reset failed:', e);
    }
  });
  // Show AI status on load
  const savedData = localStorage.getItem('car-ai-agent');
  if (savedData) {
    try {
      const data = JSON.parse(savedData);
      const status = document.getElementById('ai-status');
      const kb = (savedData.length / 1024).toFixed(1);
      status.textContent = `💾 ${data.trainSteps || 0} passos (${kb} KB)`;
      status.className = 'ai-status-text has-data';
    } catch (e) {}
  }
  document.getElementById('start-btn').addEventListener('click', () => {
    document.getElementById('menu').hidden = true;
    document.getElementById('hud').hidden = false;
    document.getElementById('finish').hidden = true;
    setupRace();
    startCountdown();
    animate();
  });
  document.getElementById('restart-btn').addEventListener('click', () => {
    document.getElementById('finish').hidden = true;
    setupRace();
    startCountdown();
  });
  document.getElementById('menu-btn').addEventListener('click', () => {
    document.getElementById('finish').hidden = true;
    document.getElementById('hud').hidden = true;
    document.getElementById('menu').hidden = false;
    S.setRaceState('menu');
    S.setControlsEnabled(false);
    S.setPaused(false);
    hidePause();
    if (S.engineGain) S.engineGain.gain.setTargetAtTime(0, S.audioCtx.currentTime, 0.1);
  });
}

// ---- Pause overlay ----
function showPause() {
  let ov = document.getElementById('pause-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'pause-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:60;display:grid;place-items:center;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);font-family:Oswald,sans-serif;color:#fff;font-size:3rem;letter-spacing:0.3em;text-transform:uppercase;';
    ov.innerHTML = 'PAUSADO <div style="font-size:1rem;letter-spacing:0.2em;margin-top:1rem;opacity:0.7;font-family:IBM Plex Mono,monospace;">ESC para continuar</div>';
    document.body.appendChild(ov);
  } else ov.hidden = false;
}

function hidePause() {
  const ov = document.getElementById('pause-overlay');
  if (ov) ov.hidden = true;
}

// ---- Boot ----
async function main() {
  bindMenu();
  const err = await waitForAmmo();
  if (err instanceof Error) throw err;
  await window.Ammo();
  Ammo = window.Ammo;

  initThree();
  initPhysics();
  initInput();
  initNeuralAI();
  createSkidMarks();

  ammoLoaded = true;
  document.querySelector('.scene-option[data-scene="forest"]').classList.add('selected');
  document.querySelector('.car-option[data-color="0xd62828"]').classList.add('selected');
  S.setSelectedScene('forest');
  S.setSelectedCarColor(0xd62828);
  tryStart();
}

main().catch(err => {
  console.error('Startup failed:', err);
  const hint = document.querySelector('.menu-hint');
  if (hint) {
    hint.textContent = 'Error loading Ammo.js. Run: python3 -m http.server 8000';
    hint.style.color = '#ff6b4a';
  }
});
