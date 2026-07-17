import {
  getTrackCurve,
  getVehicles,
  getPlayerVehicle,
  getRaceState,
  setRaceState,
  getLap,
  setLap,
  getLapStartTime,
  setLapStartTime,
  getBestLapMs,
  setBestLapMs,
  getRaceAccumMs,
  setRaceAccumMs,
  setTotalRaceMs,
  setControlsEnabled,
  getRlAgent,
  getSelectedScene,
} from './state.js';
import { CFG } from './config.js';
import { nearestOnCurve } from './track-helpers.js';
import { beep } from './audio.js';
import {
  addPrize,
  applyRaceDamage,
  getMoney,
  isChampionshipActive,
  recordChampionshipResult,
  getChampionshipBoard,
  getChampionship,
} from './manager.js';
import { CHAMPIONSHIP_ROUNDS } from '../scenarios.js';

export function updateProgress(v) {
  const curve = getTrackCurve();
  if (!curve || !v.mesh) return;
  const r = nearestOnCurve(curve, v.mesh.position);
  v.lastT = v.progress;
  v.progress = r.t;
}

export function checkLaps() {
  if (getRaceState() !== 'racing') return;

  const vehicles = getVehicles();
  const raceLaps = CFG.raceLaps;

  for (const v of vehicles) {
    if (v.finished) continue;

    if (v.lastT > 0.88 && v.progress < 0.12) {
      v.lap++;

      if (v.isPlayer) {
        const now = performance.now();
        const lapStart = getLapStartTime();
        const lapMs = now - lapStart;
        setRaceAccumMs(getRaceAccumMs() + lapMs);

        const best = getBestLapMs();
        if (best === null || lapMs < best) {
          setBestLapMs(lapMs);
        }
        setLap(v.lap);
        setLapStartTime(now);
        beep(880, 0.15, 0.2);

        if (v.lap >= raceLaps) {
          finishRace();
        }
      } else {
        if (v.lap >= raceLaps) {
          v.finished = true;
          v.finishTime = getRaceAccumMs() + (performance.now() - getLapStartTime());
        }
      }
    }
  }
}

export function finishRace() {
  setRaceState('finished');
  setControlsEnabled(false);

  const agent = getRlAgent();
  if (agent) agent.save('car-ai-agent');

  const player = getPlayerVehicle();
  if (player) {
    player.finished = true;
    const total = getRaceAccumMs() + (performance.now() - getLapStartTime());
    player.finishTime = total;
    setTotalRaceMs(total);
  }

  const vehicles = getVehicles();
  for (const v of vehicles) {
    if (!v.finished) {
      v.finishTime = Infinity;
    }
  }

  const ranks = standings();
  const playerPos = ranks.findIndex((v) => v.isPlayer);
  let prize = 0;
  let champInfo = null;

  if (playerPos >= 0) {
    prize = addPrize(playerPos);
    applyRaceDamage();

    if (isChampionshipActive()) {
      const sceneId = getSelectedScene();
      champInfo = recordChampionshipResult(playerPos, ranks, sceneId);
      if (champInfo) prize += champInfo.prize || 0;
    }
  }

  renderResults(prize, playerPos, champInfo);
}

export function standings() {
  const vehicles = getVehicles().slice();
  vehicles.sort((a, b) => {
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  return vehicles;
}

export function formatTime(ms) {
  if (!isFinite(ms) || ms === null || ms === undefined) return '--:--.---';
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const milli = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(milli).padStart(3, '0')}`;
}

function renderResults(prize, playerPos, champInfo) {
  const el = document.getElementById('race-results');
  if (!el) return;

  const ranks = standings();
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
  const raceLaps = CFG.raceLaps;
  const inChamp = !!champInfo;
  const champDone = champInfo && champInfo.finished;

  let html = '<div class="finish-card">';
  if (champDone) {
    html += '<h2>Campeonato Encerrado!</h2>';
  } else if (inChamp) {
    const champ = getChampionship();
    html += `<h2>Rodada ${champ.round}/5 Concluída</h2>`;
  } else {
    html += '<h2>Corrida Finalizada!</h2>';
  }

  html += '<ol class="podium">';
  ranks.forEach((v, i) => {
    const cls = [i === 0 ? 'pos1' : '', v.isPlayer ? 'you' : ''].filter(Boolean).join(' ');
    const timeStr =
      v.finished && isFinite(v.finishTime)
        ? formatTime(v.finishTime)
        : `Volta ${Math.min(v.lap, raceLaps)}/${raceLaps}`;
    html += `<li class="${cls}">
      <span class="medal">${medals[i] || i + 1}</span>
      <span class="racer-name">${v.name}${v.isPlayer ? ' (Você)' : ''}</span>
      <span class="racer-time">${timeStr}</span>
    </li>`;
  });
  html += '</ol>';

  if (prize > 0) {
    html += `<div class="prize-display">Prêmio: <strong>$${prize.toLocaleString()}</strong> · Saldo: $${getMoney().toLocaleString()}</div>`;
  }

  if (inChamp && champInfo.points != null) {
    html += `<div class="prize-display">Pontos da rodada: <strong>+${champInfo.points}</strong></div>`;
  }

  if (inChamp) {
    const board = getChampionshipBoard();
    html += '<div class="champ-board"><h3>Classificação do Campeonato</h3><ol class="champ-list">';
    board.forEach((e, i) => {
      const you = e.name === 'Você' ? ' you' : '';
      html += `<li class="${you}"><span>${i + 1}. ${e.name}</span><span>${e.pts} pts</span></li>`;
    });
    html += '</ol></div>';
  }

  if (champDone) {
    const place = (champInfo.finalPlace ?? 0) + 1;
    html += `<div class="prize-display champ-final">Posição final: <strong>${place}º</strong> · Bolsa: <strong>$${(champInfo.finalPurse || 0).toLocaleString()}</strong></div>`;
  }

  html += '<div class="finish-actions">';
  if (inChamp && !champDone) {
    const nextRound = getChampionship().round;
    const next = CHAMPIONSHIP_ROUNDS[nextRound];
    const label = next ? `Próxima: ${next.name}` : 'Próxima rodada';
    html += `<button id="champ-next-btn" class="btn primary">${label}</button>`;
    html += '<button id="menu-btn" class="btn">Abandonar / Menu</button>';
  } else if (champDone) {
    html += '<button id="menu-btn" class="btn primary">Voltar ao Menu</button>';
  } else {
    html += '<button id="restart-btn" class="btn primary">Reiniciar</button>';
    html += '<button id="menu-btn" class="btn">Menu</button>';
  }
  html += '</div></div>';

  el.innerHTML = html;
  el.hidden = false;

  const restartBtn = document.getElementById('restart-btn');
  const menuBtn = document.getElementById('menu-btn');
  const nextBtn = document.getElementById('champ-next-btn');

  if (restartBtn) {
    restartBtn.onclick = () => {
      el.hidden = true;
      window.dispatchEvent(new CustomEvent('carammo-restart'));
    };
  }
  if (menuBtn) {
    menuBtn.onclick = () => {
      el.hidden = true;
      window.dispatchEvent(new CustomEvent('carammo-menu'));
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      el.hidden = true;
      window.dispatchEvent(new CustomEvent('carammo-champ-next'));
    };
  }
}
