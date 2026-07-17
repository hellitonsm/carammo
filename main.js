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
import {
  loadManager, getState, getActiveCarDef, getCarCatalog, getCarDef,
  getPartsCatalog, getEffectiveStats, getBaseStats, powerScore,
  canUpgrade, buyUpgrade, repairCost, repairCostPart, repairAll, repairPart,
  applyRaceDamage, buyCar, selectCar, sellCar, addPrize, getMoney,
  getEngineForceMultiplier, saveManager, resetManager, colorHex,
  getDamagePercent, getInstalledParts, canBuyPart, buyPart,
  startChampionship, abandonChampionship, isChampionshipActive,
  getChampionship, getChampionshipBoard, getChampionshipRoundIndex,
} from './js/manager.js';
import { CHAMPIONSHIP_ROUNDS, getScene as getSceneDef } from './scenarios.js';

let ammoLoaded = false;
let animStarted = false;

const AI_COLORS = [0x9c27b0, 0xff9800, 0x00bcd4, 0xe91e63];
const AI_NAMES = ['Rocket', 'Flash', 'Shadow', 'Blaze'];
const AI_SKILLS = [0.82, 0.88, 0.93, 0.78];
const AI_CAR_IDS = ['street', 'sport', 'super', 'hyper'];

let raceMode = 'quick'; // 'quick' | 'championship'


async function main() {
  loadManager();
  bindMenu();
  bindManagerOverlay();
  bindGlobalActions();
  await waitForAmmo();
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
    if (raceMode === 'championship') return; // no free restart mid-champ
    setupRace();
    startCountdown();
  });
  window.addEventListener('carammo-menu', () => {
    if (isChampionshipActive()) {
      // abandoning mid-championship
      abandonChampionship();
      raceMode = 'quick';
      CFG.raceLaps = 3;
    }
    goToMenu();
  });
  window.addEventListener('carammo-champ-next', () => {
    continueChampionship();
  });

  refreshMenuHeader();
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
    60, window.innerWidth / window.innerHeight, 0.1, 1500
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
    if (!agent) agent = new RLAgent(12, [32, 24, 16], 2);
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
  bindSceneButtons();
  const forestBtn = document.querySelector('.scene-option[data-scene="forest"]');
  if (forestBtn) forestBtn.classList.add('selected');

  const optAi = document.getElementById('opt-ai');
  const optNitro = document.getElementById('opt-nitro');
  const optNeural = document.getElementById('opt-neural');
  if (optAi) optAi.addEventListener('change', () => setAiEnabled(optAi.checked));
  if (optNitro) optNitro.addEventListener('change', () => setNitroEnabled(optNitro.checked));
  if (optNeural) optNeural.addEventListener('change', () => setUseNeuralAI(optNeural.checked));

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

  const startBtn = document.getElementById('start-btn');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (isChampionshipActive()) {
        // resume current championship round
        continueChampionship();
        return;
      }
      raceMode = 'quick';
      CFG.raceLaps = 3;
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

  const openMgrBtn = document.getElementById('open-manager-btn');
  if (openMgrBtn) {
    openMgrBtn.addEventListener('click', () => {
      openManagerOverlay();
    });
  }

  const champBtn = document.getElementById('champ-start-btn');
  if (champBtn) {
    champBtn.addEventListener('click', () => {
      if (!ammoLoaded) return;
      startChampionshipFlow();
    });
  }

  refreshChampBanner();
}

function bindSceneButtons() {
  document.querySelectorAll('.scene-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (isChampionshipActive()) return; // locked during championship
      document.querySelectorAll('.scene-option').forEach((b) => b.classList.remove('selected'));
      btn.classList.add('selected');
      setSelectedScene(btn.dataset.scene);
      updateStartButton();
    });
  });
}

function startChampionshipFlow() {
  startChampionship();
  raceMode = 'championship';
  const round = CHAMPIONSHIP_ROUNDS[0];
  setSelectedScene(round.sceneId);
  CFG.raceLaps = round.laps || 3;
  // lock UI selection
  document.querySelectorAll('.scene-option').forEach((b) => {
    b.classList.toggle('selected', b.dataset.scene === round.sceneId);
    b.classList.add('locked');
  });
  refreshChampBanner();
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
}

function continueChampionship() {
  if (!isChampionshipActive()) {
    goToMenu();
    return;
  }
  const idx = getChampionshipRoundIndex();
  const round = CHAMPIONSHIP_ROUNDS[idx];
  if (!round) {
    goToMenu();
    return;
  }
  raceMode = 'championship';
  setSelectedScene(round.sceneId);
  CFG.raceLaps = round.laps || 3;
  document.querySelectorAll('.scene-option').forEach((b) => {
    b.classList.toggle('selected', b.dataset.scene === round.sceneId);
  });
  document.getElementById('menu').hidden = true;
  document.getElementById('hud').hidden = false;
  setupRace();
  startCountdown();
}

function refreshChampBanner() {
  const el = document.getElementById('champ-banner');
  if (!el) return;
  if (isChampionshipActive()) {
    const idx = getChampionshipRoundIndex();
    const round = CHAMPIONSHIP_ROUNDS[idx];
    const board = getChampionshipBoard();
    const you = board.find((e) => e.name === 'Você');
    el.hidden = false;
    el.innerHTML = `<strong>Campeonato</strong> · Rodada ${idx + 1}/5${round ? ' — ' + round.name : ''} · Seus pts: <strong>${you ? you.pts : 0}</strong>`;
  } else {
    const c = getChampionship();
    if (c && c.finished && c.results && c.results.length) {
      el.hidden = false;
      el.innerHTML = `Último campeonato: <strong>${(c.finalPlace ?? 0) + 1}º lugar</strong> · Bolsa $${(c.finalPurse || 0).toLocaleString()}`;
    } else {
      el.hidden = true;
      el.innerHTML = '';
    }
  }
}


function bindManagerOverlay() {
  const closeBtn = document.getElementById('close-manager-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeManagerOverlay();
    });
  }

  document.querySelectorAll('.mgr-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mgr-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const section = btn.dataset.section;
      document.querySelectorAll('.mgr-section').forEach(s => s.hidden = true);
      const target = document.getElementById('mgr-section-' + section);
      if (target) target.hidden = false;
      renderSection(section);
    });
  });
}

function bindGlobalActions() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const part = btn.dataset.part;
    const carId = btn.dataset.carId;
    const partId = btn.dataset.partId;

    if (action === 'upgrade' && part) {
      const result = buyUpgrade(part);
      if (result.ok) showToast(`${part.toUpperCase()} melhorado! Nível ${result.newLevel}`);
      else showToast(result.reason, 'error');
      refreshAll();
    }

    if (action === 'repair') {
      const result = repairAll(carId || null);
      if (result.ok) showToast(`Tudo reparado! -$${result.cost.toLocaleString()}`);
      else showToast(result.reason, 'error');
      refreshAll();
    }

    if (action === 'repair-part' && part) {
      const result = repairPart(null, part);
      if (result.ok) showToast(`${part} reparado! -$${result.cost.toLocaleString()}`);
      else showToast(result.reason, 'error');
      refreshAll();
    }

    if (action === 'buy-car' && carId) {
      const result = buyCar(carId);
      if (result.ok) showToast(`Carro comprado! -$${result.cost.toLocaleString()}`);
      else showToast(result.reason, 'error');
      refreshAll();
    }

    if (action === 'select-car' && carId) {
      selectCar(carId);
      const def = getCarDef(carId);
      setSelectedCarColor(def.color);
      showToast(`Carro ativo: ${def.name}`);
      refreshAll();
    }

    if (action === 'sell-car' && carId) {
      const result = sellCar(carId);
      if (result.ok) showToast(`Vendido! +$${result.price.toLocaleString()}`);
      else showToast(result.reason, 'error');
      refreshAll();
    }

    if (action === 'buy-part' && partId) {
      const result = buyPart(partId);
      if (result.ok) showToast(`Peça instalada! -$${result.cost.toLocaleString()}`);
      else showToast(result.reason, 'error');
      refreshAll();
    }

    if (action === 'reset-save') {
      if (confirm('Resetar todo o progresso?')) {
        resetManager();
        const def = getActiveCarDef();
        setSelectedCarColor(def.color);
        showToast('Progresso resetado');
        refreshAll();
      }
    }
  });
}

function openManagerOverlay() {
  const overlay = document.getElementById('manager-overlay');
  if (!overlay) return;
  overlay.hidden = false;
  document.querySelectorAll('.mgr-nav-btn').forEach(b => b.classList.remove('active'));
  const firstBtn = document.querySelector('.mgr-nav-btn[data-section="overview"]');
  if (firstBtn) firstBtn.classList.add('active');
  document.querySelectorAll('.mgr-section').forEach(s => s.hidden = true);
  const overview = document.getElementById('mgr-section-overview');
  if (overview) overview.hidden = false;
  renderSection('overview');
  refreshOverlayHeader();
}

function closeManagerOverlay() {
  const overlay = document.getElementById('manager-overlay');
  if (overlay) overlay.hidden = true;
  refreshMenuHeader();
}

function refreshMenuHeader() {
  const s = getState();
  const def = getActiveCarDef();
  const moneyEl = document.getElementById('mgr-money');
  if (moneyEl) moneyEl.textContent = `$${s.money.toLocaleString()}`;
  const carEl = document.getElementById('active-car-name');
  if (carEl) carEl.textContent = `${def.name} (${def.tier})`;
}

function refreshOverlayHeader() {
  const s = getState();
  const def = getActiveCarDef();
  const mEl = document.getElementById('mgr-overlay-money');
  if (mEl) mEl.textContent = `$${s.money.toLocaleString()}`;
  const cEl = document.getElementById('mgr-overlay-car');
  if (cEl) cEl.textContent = `${def.name} (${def.tier})`;
}

function refreshAll() {
  refreshMenuHeader();
  refreshOverlayHeader();
  const activeBtn = document.querySelector('.mgr-nav-btn.active');
  if (activeBtn) renderSection(activeBtn.dataset.section);
}

function renderSection(section) {
  const el = document.getElementById('mgr-section-' + section);
  if (!el) return;
  const s = getState();
  const def = getActiveCarDef();
  const stats = getEffectiveStats(s.activeCar);
  const base = getBaseStats(s.activeCar);
  const dmg = s.damage[s.activeCar] || { motor: 0, aero: 0, pneus: 0 };

  switch (section) {
    case 'overview': el.innerHTML = renderOverview(s, def, stats, base, dmg); break;
    case 'garage': el.innerHTML = renderGarage(s, def, stats, dmg); break;
    case 'workshop': el.innerHTML = renderWorkshop(s, def, stats, base, dmg); break;
    case 'carshop': el.innerHTML = renderCarShop(s); break;
    case 'partshop': el.innerHTML = renderPartShop(s); break;
  }
}

function renderOverview(s, def, stats, base, dmg) {
  const ps = powerScore(s.activeCar);
  const dmgPct = getDamagePercent(s.activeCar);
  const repCost = repairCost(s.activeCar);
  const parts = getInstalledParts(s.activeCar);
  const winRate = s.racesCount > 0 ? Math.round((s.wins / s.racesCount) * 100) : 0;

  return `
    <div class="mgr-grid-2">
      <div class="mgr-panel">
        <h3 class="mgr-panel-title">Carro Ativo</h3>
        <div class="mgr-car-preview" style="background:${colorHex(def.color)}">
          <span class="mgr-car-tier tier-${def.tier}">${def.tier}</span>
        </div>
        <h4 class="mgr-car-name">${def.name}</h4>
        <p class="mgr-car-desc">${def.desc}</p>
        <div class="mgr-power-score">
          <span class="mgr-ps-label">Power Score</span>
          <span class="mgr-ps-value">${ps.toFixed(1)}</span>
        </div>
      </div>

      <div class="mgr-panel">
        <h3 class="mgr-panel-title">Status</h3>
        ${renderStatBar('Motor', stats.motor, 10, 'motor', dmg.motor, base.motor)}
        ${renderStatBar('Aerodinâmica', stats.aero, 10, 'aero', dmg.aero, base.aero)}
        ${renderStatBar('Pneus', stats.pneus, 10, 'pneus', dmg.pneus, base.pneus)}
        ${dmgPct > 0 ? `
          <div class="mgr-dmg-summary">
            <span>Dano médio: <strong class="text-danger">${dmgPct}%</strong></span>
            ${repCost > 0 ? `<button class="btn btn-sm btn-ok" data-action="repair">Reparar ($${repCost.toLocaleString()})</button>` : ''}
          </div>
        ` : '<p class="mgr-ok">Sem danos</p>'}
      </div>
    </div>

    <div class="mgr-grid-3">
      <div class="mgr-stat-card">
        <span class="mgr-stat-icon">🏁</span>
        <span class="mgr-stat-num">${s.racesCount}</span>
        <span class="mgr-stat-label">Corridas</span>
      </div>
      <div class="mgr-stat-card">
        <span class="mgr-stat-icon">🏆</span>
        <span class="mgr-stat-num">${s.wins}</span>
        <span class="mgr-stat-label">Vitórias</span>
      </div>
      <div class="mgr-stat-card">
        <span class="mgr-stat-icon">📈</span>
        <span class="mgr-stat-num">${winRate}%</span>
        <span class="mgr-stat-label">Taxa Vitória</span>
      </div>
    </div>

    <div class="mgr-grid-2">
      <div class="mgr-stat-card">
        <span class="mgr-stat-icon">💰</span>
        <span class="mgr-stat-num">$${s.totalEarnings.toLocaleString()}</span>
        <span class="mgr-stat-label">Total Ganho</span>
      </div>
      <div class="mgr-stat-card">
        <span class="mgr-stat-icon">🛒</span>
        <span class="mgr-stat-num">$${s.totalSpent.toLocaleString()}</span>
        <span class="mgr-stat-label">Total Gasto</span>
      </div>
    </div>

    ${parts.length > 0 ? `
      <div class="mgr-panel">
        <h3 class="mgr-panel-title">Peças Instaladas (${parts.length})</h3>
        <div class="mgr-parts-list">
          ${parts.map(p => `<span class="mgr-part-tag">${p.name} <small>+${p.bonus} ${p.type}</small></span>`).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

function renderGarage(s, activeDef, activeStats, activeDmg) {
  let html = '<h3 class="mgr-section-title">Meus Carros</h3>';
  html += '<div class="mgr-car-list">';

  for (const carId of s.ownedCars) {
    const def = getCarDef(carId);
    const stats = getEffectiveStats(carId);
    const base = getBaseStats(carId);
    const dmg = s.damage[carId] || { motor: 0, aero: 0, pneus: 0 };
    const dmgPct = Math.round((dmg.motor + dmg.aero + dmg.pneus) / 3);
    const isActive = carId === s.activeCar;
    const ps = powerScore(carId);
    const parts = getInstalledParts(carId);
    const repCost = repairCost(carId);

    html += `
      <div class="mgr-car-detail ${isActive ? 'active' : ''}">
        <div class="mgr-car-detail-left">
          <div class="mgr-car-swatch" style="background:${colorHex(def.color)}">
            <span class="mgr-car-tier tier-${def.tier}">${def.tier}</span>
          </div>
        </div>
        <div class="mgr-car-detail-center">
          <h4 class="mgr-car-detail-name">${def.name}</h4>
          <p class="mgr-car-desc">${def.desc}</p>
          <div class="mgr-mini-stats">
            ${renderMiniBar('M', stats.motor, 10, 'motor')}
            ${renderMiniBar('A', stats.aero, 10, 'aero')}
            ${renderMiniBar('P', stats.pneus, 10, 'pneus')}
          </div>
          <div class="mgr-car-meta">
            <span>PS: <strong>${ps.toFixed(1)}</strong></span>
            ${parts.length > 0 ? `<span>⚙️ ${parts.length} peça${parts.length > 1 ? 's' : ''}</span>` : ''}
            ${dmgPct > 0 ? `<span class="text-danger">⚠ ${dmgPct}% dano</span>` : '<span class="text-ok">✓ OK</span>'}
          </div>
        </div>
        <div class="mgr-car-detail-right">
          ${!isActive ? `<button class="btn btn-sm btn-accent" data-action="select-car" data-car-id="${carId}">Usar</button>` : '<span class="mgr-active-tag">ATIVO</span>'}
          ${repCost > 0 ? `<button class="btn btn-sm btn-ok" data-action="repair" data-car-id="${carId}">Reparar $${repCost.toLocaleString()}</button>` : ''}
          ${carId !== 'starter' ? `<button class="btn btn-sm btn-danger" data-action="sell-car" data-car-id="${carId}">Vender</button>` : ''}
        </div>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

function renderWorkshop(s, def, stats, base, dmg) {
  const parts = ['motor', 'aero', 'pneus'];
  const partNames = { motor: 'Motor', aero: 'Aerodinâmica', pneus: 'Pneus' };
  const partIcons = { motor: '🔥', aero: '💨', pneus: '🛞' };

  let html = '<h3 class="mgr-section-title">Oficina — Upgrades</h3>';
  html += `<p class="mgr-section-desc">Melhore as peças do <strong>${def.name}</strong>. Nível máximo baseado no tier do carro.</p>`;

  html += '<div class="mgr-upgrade-grid">';
  for (const part of parts) {
    const current = stats[part];
    const max = def[part + 'Max'];
    const check = canUpgrade(part);
    const cost = check.ok ? check.cost : (current >= max ? 0 : (current + 1) * 1000);
    const pct = (current / 10) * 100;

    html += `
      <div class="mgr-upgrade-card">
        <div class="mgr-upgrade-header">
          <span class="mgr-upgrade-icon">${partIcons[part]}</span>
          <span class="mgr-upgrade-name">${partNames[part]}</span>
        </div>
        <div class="mgr-upgrade-bar-wrap">
          <div class="mgr-upgrade-bar">
            <div class="stat-fill ${part}" style="width:${pct}%"></div>
          </div>
          <span class="mgr-upgrade-level">${current}/${max}</span>
        </div>
        ${dmg[part] > 0 ? `<div class="mgr-upgrade-dmg">Dano: ${dmg[part]}% (-${Math.floor(dmg[part]/20)} efetivo)</div>` : ''}
        <button class="btn btn-sm ${check.ok ? 'btn-accent' : 'disabled'}" data-action="upgrade" data-part="${part}" ${check.ok ? '' : 'disabled'}>
          ${current >= max ? 'NÍVEL MAX' : `Upgrade +$${cost.toLocaleString()}`}
        </button>
      </div>
    `;
  }
  html += '</div>';

  html += '<h3 class="mgr-section-title">Reparo Individual</h3>';
  html += '<div class="mgr-repair-grid">';
  for (const part of parts) {
    const rCost = repairCostPart(null, part);
    html += `
      <div class="mgr-repair-card">
        <span class="mgr-repair-name">${partIcons[part]} ${partNames[part]}</span>
        <div class="mgr-repair-bar-wrap">
          <div class="mgr-repair-bar">
            <div class="mgr-repair-fill" style="width:${dmg[part]}%"></div>
          </div>
          <span class="mgr-repair-pct">${dmg[part]}%</span>
        </div>
        ${rCost > 0 ?
          `<button class="btn btn-sm btn-ok" data-action="repair-part" data-part="${part}">Reparar $${rCost.toLocaleString()}</button>` :
          '<span class="mgr-ok">Sem dano</span>'
        }
      </div>
    `;
  }
  html += '</div>';

  const totalRepCost = repairCost();
  if (totalRepCost > 0) {
    html += `<button class="btn btn-ok btn-full" data-action="repair" style="margin-top:1rem">Reparar Tudo — $${totalRepCost.toLocaleString()}</button>`;
  }

  return html;
}

function renderCarShop(s) {
  const catalog = getCarCatalog();
  const activeStats = getEffectiveStats(s.activeCar);
  const activePS = powerScore(s.activeCar);

  let html = '<h3 class="mgr-section-title">Loja de Carros</h3>';
  html += '<p class="mgr-section-desc">Compre novos carros com stats base mais altos e maior potencial de upgrade.</p>';
  html += '<div class="mgr-shop-grid">';

  for (const def of catalog) {
    const owned = s.ownedCars.includes(def.id);
    const canBuy = !owned && s.money >= def.price;
    const ps = def.motor * 0.5 + def.aero * 0.3 + def.pneus * 0.2;
    const diff = ps - activePS;

    html += `
      <div class="mgr-shop-card ${owned ? 'owned' : ''}">
        <div class="mgr-shop-card-top">
          <div class="mgr-shop-swatch" style="background:${colorHex(def.color)}">
            <span class="mgr-car-tier tier-${def.tier}">${def.tier}</span>
          </div>
          <div class="mgr-shop-card-info">
            <h4>${def.name}</h4>
            <p class="mgr-car-desc">${def.desc}</p>
            <p class="mgr-car-style">Visual: <em>${styleLabel(def.id)}</em></p>
          </div>
        </div>
        <div class="mgr-shop-card-stats">
          ${renderMiniBar('M', def.motor, def.motorMax, 'motor')}
          ${renderMiniBar('A', def.aero, def.aeroMax, 'aero')}
          ${renderMiniBar('P', def.pneus, def.pneusMax, 'pneus')}
        </div>
        <div class="mgr-shop-card-footer">
          <span class="mgr-shop-ps">PS: ${ps.toFixed(1)} ${!owned ? `<small class="${diff > 0 ? 'text-ok' : diff < 0 ? 'text-danger' : ''}">(${diff > 0 ? '+' : ''}${diff.toFixed(1)})</small>` : ''}</span>
          ${owned ?
            '<span class="mgr-owned-tag">✓ Na garagem</span>' :
            def.price === 0 ?
              '<span class="mgr-owned-tag">Grátis</span>' :
              `<button class="btn btn-sm ${canBuy ? 'btn-accent' : 'disabled'}" data-action="buy-car" data-car-id="${def.id}" ${canBuy ? '' : 'disabled'}>$${def.price.toLocaleString()}</button>`
          }
        </div>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

function renderPartShop(s) {
  const catalog = getPartsCatalog();
  const installed = s.installedParts[s.activeCar] || [];
  const types = { motor: '🔥 Motor', aero: '💨 Aerodinâmica', pneus: '🛞 Pneus' };

  let html = '<h3 class="mgr-section-title">Loja de Peças</h3>';
  html += `<p class="mgr-section-desc">Instale peças no <strong>${getActiveCarDef().name}</strong> para bônus permanente nos stats.</p>`;

  for (const [type, label] of Object.entries(types)) {
    const items = catalog.filter(p => p.type === type);
    html += `<h4 class="mgr-part-type-title">${label}</h4>`;
    html += '<div class="mgr-part-grid">';
    for (const p of items) {
      const isInstalled = installed.includes(p.id);
      const check = canBuyPart(p.id);
      const hasReq = !p.req || installed.includes(p.req);

      html += `
        <div class="mgr-part-card ${isInstalled ? 'installed' : ''}">
          <div class="mgr-part-card-header">
            <span class="mgr-part-name">${p.name}</span>
            <span class="mgr-part-bonus">+${p.bonus}</span>
          </div>
          <p class="mgr-part-desc">${p.desc}</p>
          ${p.req ? `<span class="mgr-part-req ${hasReq ? 'met' : 'unmet'}">Requer: ${getPartsCatalog().find(x => x.id === p.req)?.name || p.req}</span>` : ''}
          <div class="mgr-part-card-footer">
            ${isInstalled ?
              '<span class="mgr-installed-tag">✓ Instalada</span>' :
              `<button class="btn btn-sm ${check.ok ? 'btn-accent' : 'disabled'}" data-action="buy-part" data-part-id="${p.id}" ${check.ok ? '' : 'disabled'}>$${p.price.toLocaleString()}</button>`
            }
          </div>
        </div>
      `;
    }
    html += '</div>';
  }
  return html;
}

function renderStatBar(label, value, max, cls, dmg, base) {
  const pct = (value / max) * 100;
  const basePct = (base / max) * 100;
  return `
    <div class="mgr-stat-row">
      <span class="mgr-stat-label">${label}</span>
      <div class="mgr-stat-bar-wrap">
        <div class="mgr-stat-bar">
          <div class="mgr-stat-base" style="width:${basePct}%"></div>
          <div class="stat-fill ${cls}" style="width:${pct}%"></div>
        </div>
      </div>
      <span class="mgr-stat-val">${value}/${max}</span>
      ${dmg > 0 ? `<span class="mgr-dmg-tag">-${Math.floor(dmg/20)}</span>` : ''}
    </div>
  `;
}

function renderMiniBar(label, value, max, cls) {
  const pct = (value / max) * 100;
  return `
    <div class="mgr-mini-bar">
      <span class="mgr-mini-label">${label}</span>
      <div class="mgr-mini-bar-track">
        <div class="stat-fill ${cls}" style="width:${pct}%"></div>
      </div>
      <span class="mgr-mini-val">${value}</span>
    </div>
  `;
}

function styleLabel(id) {
  return ({
    starter: 'Hatch GT compacto',
    street: 'Cupê esportivo',
    sport: 'GT com asa e saias',
    super: 'Supercarro asa alta',
    hyper: 'Hypercar cunha / wing',
  })[id] || id;
}

function showToast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function updateStartButton() {
  const btn = document.getElementById('start-btn');
  if (!btn) return;
  btn.disabled = !(ammoLoaded && getSelectedScene());
}

function clearScene() {
  const scene = getScene();
  if (!scene) return;
  const world = getPhysicsWorld();
  const vehicles = getVehicles();
  if (world && vehicles) {
    for (const v of vehicles) {
      try {
        if (v.vehicle) world.removeAction(v.vehicle);
        if (v.body) world.removeRigidBody(v.body);
      } catch (_) {}
    }
  }
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
  const sceneId = getSelectedScene();
  const scn = loadScene(sceneId);
  buildSky(scn);
  buildTrack(scn);
  initParticleSystems();

  const activeDef = getActiveCarDef();
  setSelectedCarColor(activeDef.color);
  const player = createVehicle(activeDef.color, 0, true, 'Você', 1.0, activeDef.id);
  addVehicle(player);

  if (getAiEnabled()) {
    for (let i = 0; i < 4; i++) {
      const ai = createVehicle(
        AI_COLORS[i],
        i + 1,
        false,
        AI_NAMES[i],
        AI_SKILLS[i],
        AI_CAR_IDS[i]
      );
      addVehicle(ai);
    }
  }

  setPaused(false);
  setRaceState('countdown');
  createSkidMarks();

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
  refreshMenuHeader();
  raceMode = isChampionshipActive() ? 'championship' : 'quick';
  if (!isChampionshipActive()) {
    CFG.raceLaps = 3;
    document.querySelectorAll('.scene-option').forEach((b) => b.classList.remove('locked'));
  }
  refreshChampBanner();
}

main().catch((err) => {
  console.error('CarAmmo failed to start:', err);
  const btn = document.getElementById('start-btn');
  if (btn) {
    btn.textContent = 'Erro ao carregar';
    btn.disabled = true;
  }
});
