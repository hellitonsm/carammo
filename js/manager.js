const STORAGE_KEY = 'carammo-manager';

const CAR_CATALOG = [
  { id: 'starter',  name: 'Carammo GT',    tier: 'D',  color: 0xd62828, price: 0,      motor: 3, aero: 2, pneus: 3, motorMax: 6,  aeroMax: 5,  pneusMax: 6,  desc: 'Carro de entrada confiável. Bom para aprender as curvas.' },
  { id: 'street',   name: 'Viper RS',      tier: 'C',  color: 0x1e6bb8, price: 8000,   motor: 5, aero: 4, pneus: 4, motorMax: 8,  aeroMax: 7,  pneusMax: 7,  desc: 'Esportivo de rua com motor turbinado e chassi leve.' },
  { id: 'sport',    name: 'Falcon X',       tier: 'B',  color: 0x2a9d5c, price: 18000,  motor: 6, aero: 6, pneus: 5, motorMax: 9,  aeroMax: 8,  pneusMax: 8,  desc: 'Equilíbrio perfeito entre potência e aerodinâmica.' },
  { id: 'super',    name: 'Phantom S',      tier: 'A',  color: 0xf4c430, price: 35000,  motor: 8, aero: 7, pneus: 7, motorMax: 10, aeroMax: 9,  pneusMax: 9,  desc: 'Super carro com V12 e downforce agressivo.' },
  { id: 'hyper',    name: 'Titan SS',       tier: 'S',  color: 0x9c27b0, price: 60000,  motor: 9, aero: 9, pneus: 8, motorMax: 10, aeroMax: 10, pneusMax: 10, desc: 'Hypercar definitivo. Engenharia sem compromisso.' },
];

const PARTS_SHOP = [
  { id: 'turbo_i',     name: 'Turbo I',          type: 'motor', bonus: 1, price: 2000,  desc: 'Turbina básica. +1 Motor.',          req: null },
  { id: 'turbo_ii',    name: 'Turbo II',         type: 'motor', bonus: 2, price: 5000,  desc: 'Turbina dupla. +2 Motor.',           req: 'turbo_i' },
  { id: 'ecu_sport',   name: 'ECU Esportiva',    type: 'motor', bonus: 1, price: 3500,  desc: 'Remap do motor. +1 Motor.',          req: null },
  { id: 'escape_livre',name: 'Escape Livre',     type: 'motor', bonus: 1, price: 1500,  desc: 'Exaustão performance. +1 Motor.',    req: null },
  { id: 'spoiler_carb',name: 'Spoiler Carbono',  type: 'aero',  bonus: 1, price: 2500,  desc: 'Asa traseira leve. +1 Aero.',        req: null },
  { id: 'difusor',     name: 'Difusor Traseiro', type: 'aero',  bonus: 2, price: 4500,  desc: 'Downforce extra. +2 Aero.',          req: 'spoiler_carb' },
  { id: 'splitter',    name: 'Splitter Frontal', type: 'aero',  bonus: 1, price: 2000,  desc: 'Aderência frontal. +1 Aero.',        req: null },
  { id: 'pneu_slick',  name: 'Pneus Slick',      type: 'pneus', bonus: 2, price: 3000,  desc: 'Composto macio. +2 Pneus.',          req: null },
  { id: 'pneu_soft',   name: 'Pneus Soft',       type: 'pneus', bonus: 1, price: 1500,  desc: 'Bom grip, desgaste médio. +1 Pneus.',req: null },
  { id: 'suspensao',   name: 'Suspensão Race',   type: 'pneus', bonus: 1, price: 3500,  desc: 'Coilovers ajustáveis. +1 Pneus.',    req: null },
];

const PRIZES = [5000, 3000, 2000, 1000, 500];
const REPAIR_COST_PER_10 = 200;

function defaultState() {
  return {
    money: 10000,
    ownedCars: ['starter'],
    activeCar: 'starter',
    upgrades: { starter: { motor: 0, aero: 0, pneus: 0 } },
    damage: { starter: { motor: 0, aero: 0, pneus: 0 } },
    installedParts: { starter: [] },
    racesCount: 0,
    wins: 0,
    totalEarnings: 0,
    totalSpent: 0,
    championship: {
      active: false,
      round: 0,
      standings: {}, // name -> points
      playerPoints: 0,
      results: [], // per-round { sceneId, playerPos, points, prize }
      finished: false,
    },
  };
}

let state = null;

export function loadManager() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      if (!state.upgrades) state.upgrades = {};
      if (!state.damage) state.damage = {};
      if (!state.installedParts) state.installedParts = {};
      if (!state.totalEarnings) state.totalEarnings = 0;
      if (!state.totalSpent) state.totalSpent = 0;
      if (!state.championship) {
        state.championship = defaultState().championship;
      }
      for (const id of state.ownedCars) {
        if (!state.upgrades[id]) state.upgrades[id] = { motor: 0, aero: 0, pneus: 0 };
        if (!state.damage[id]) state.damage[id] = { motor: 0, aero: 0, pneus: 0 };
        if (!state.installedParts[id]) state.installedParts[id] = [];
      }
    } else {
      state = defaultState();
    }
  } catch {
    state = defaultState();
  }
  saveManager();
  return state;
}

export function saveManager() {
  if (!state) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getState() {
  if (!state) loadManager();
  return state;
}

export function resetManager() {
  state = defaultState();
  saveManager();
}

export function getCarCatalog() { return CAR_CATALOG; }
export function getPartsCatalog() { return PARTS_SHOP; }

export function getActiveCarDef() {
  const s = getState();
  return CAR_CATALOG.find(c => c.id === s.activeCar) || CAR_CATALOG[0];
}

export function getCarDef(carId) {
  return CAR_CATALOG.find(c => c.id === carId) || CAR_CATALOG[0];
}

export function getEffectiveStats(carId) {
  const s = getState();
  const id = carId || s.activeCar;
  const def = CAR_CATALOG.find(c => c.id === id) || CAR_CATALOG[0];
  const upg = s.upgrades[id] || { motor: 0, aero: 0, pneus: 0 };
  const dmg = s.damage[id] || { motor: 0, aero: 0, pneus: 0 };
  const parts = s.installedParts[id] || [];
  let partBonus = { motor: 0, aero: 0, pneus: 0 };
  for (const pid of parts) {
    const pdef = PARTS_SHOP.find(p => p.id === pid);
    if (pdef) partBonus[pdef.type] += pdef.bonus;
  }
  const motor = Math.max(1, def.motor + upg.motor + partBonus.motor - Math.floor(dmg.motor / 20));
  const aero  = Math.max(1, def.aero  + upg.aero  + partBonus.aero  - Math.floor(dmg.aero  / 20));
  const pneus = Math.max(1, def.pneus + upg.pneus + partBonus.pneus - Math.floor(dmg.pneus / 20));
  return { motor, aero, pneus };
}

export function getBaseStats(carId) {
  const def = getCarDef(carId);
  return { motor: def.motor, aero: def.aero, pneus: def.pneus };
}

export function powerScore(carId) {
  const { motor, aero, pneus } = getEffectiveStats(carId);
  return motor * 0.5 + aero * 0.3 + pneus * 0.2;
}

export function upgradeCost(currentLevel) {
  return (currentLevel + 1) * 1000;
}

export function canUpgrade(part) {
  const s = getState();
  const def = getActiveCarDef();
  const upg = s.upgrades[s.activeCar] || { motor: 0, aero: 0, pneus: 0 };
  const base = def[part];
  const max = def[part + 'Max'];
  const current = base + upg[part];
  if (current >= max) return { ok: false, reason: 'Nível máximo atingido' };
  const cost = upgradeCost(current);
  if (s.money < cost) return { ok: false, reason: 'Saldo insuficiente', cost };
  return { ok: true, cost, nextLevel: current + 1 };
}

export function buyUpgrade(part) {
  const check = canUpgrade(part);
  if (!check.ok) return check;
  const s = getState();
  s.money -= check.cost;
  s.totalSpent += check.cost;
  s.upgrades[s.activeCar][part]++;
  saveManager();
  return { ok: true, cost: check.cost, newLevel: getEffectiveStats(s.activeCar)[part] };
}

export function repairCostPart(carId, part) {
  const s = getState();
  const dmg = s.damage[carId || s.activeCar] || { motor: 0, aero: 0, pneus: 0 };
  return Math.ceil(dmg[part] / 10) * REPAIR_COST_PER_10;
}

export function repairPart(carId, part) {
  const s = getState();
  const id = carId || s.activeCar;
  const cost = repairCostPart(id, part);
  if (cost === 0) return { ok: true, cost: 0, reason: 'Sem dano' };
  if (s.money < cost) return { ok: false, reason: 'Saldo insuficiente' };
  s.money -= cost;
  s.totalSpent += cost;
  s.damage[id][part] = 0;
  saveManager();
  return { ok: true, cost };
}

export function repairCost(carId) {
  const s = getState();
  const dmg = s.damage[carId || s.activeCar] || { motor: 0, aero: 0, pneus: 0 };
  const totalDmg = dmg.motor + dmg.aero + dmg.pneus;
  return Math.ceil(totalDmg / 10) * REPAIR_COST_PER_10;
}

export function repairAll(carId) {
  const s = getState();
  const id = carId || s.activeCar;
  const cost = repairCost(id);
  if (cost === 0) return { ok: true, cost: 0, reason: 'Sem dano' };
  if (s.money < cost) return { ok: false, reason: 'Saldo insuficiente' };
  s.money -= cost;
  s.totalSpent += cost;
  s.damage[id] = { motor: 0, aero: 0, pneus: 0 };
  saveManager();
  return { ok: true, cost };
}

export function applyRaceDamage(carId) {
  const s = getState();
  const id = carId || s.activeCar;
  if (!s.damage[id]) s.damage[id] = { motor: 0, aero: 0, pneus: 0 };
  s.damage[id].motor += 5 + Math.floor(Math.random() * 11);
  s.damage[id].aero  += 3 + Math.floor(Math.random() * 8);
  s.damage[id].pneus += 8 + Math.floor(Math.random() * 8);
  for (const p of ['motor', 'aero', 'pneus']) {
    s.damage[id][p] = Math.min(100, s.damage[id][p]);
  }
  saveManager();
}

export function buyCar(carId) {
  const s = getState();
  const def = CAR_CATALOG.find(c => c.id === carId);
  if (!def) return { ok: false, reason: 'Carro não existe' };
  if (s.ownedCars.includes(carId)) return { ok: false, reason: 'Já possui' };
  if (s.money < def.price) return { ok: false, reason: 'Saldo insuficiente' };
  s.money -= def.price;
  s.totalSpent += def.price;
  s.ownedCars.push(carId);
  s.upgrades[carId] = { motor: 0, aero: 0, pneus: 0 };
  s.damage[carId] = { motor: 0, aero: 0, pneus: 0 };
  s.installedParts[carId] = [];
  saveManager();
  return { ok: true, cost: def.price };
}

export function selectCar(carId) {
  const s = getState();
  if (!s.ownedCars.includes(carId)) return { ok: false, reason: 'Não possui' };
  s.activeCar = carId;
  saveManager();
  return { ok: true };
}

export function sellCar(carId) {
  const s = getState();
  if (!s.ownedCars.includes(carId)) return { ok: false, reason: 'Não possui' };
  if (carId === 'starter') return { ok: false, reason: 'Não pode vender carro inicial' };
  if (s.activeCar === carId) s.activeCar = 'starter';
  const def = CAR_CATALOG.find(c => c.id === carId);
  const sellPrice = Math.floor(def.price * 0.5);
  s.money += sellPrice;
  s.totalEarnings += sellPrice;
  s.ownedCars = s.ownedCars.filter(id => id !== carId);
  delete s.upgrades[carId];
  delete s.damage[carId];
  delete s.installedParts[carId];
  saveManager();
  return { ok: true, price: sellPrice };
}

export function canBuyPart(partId) {
  const s = getState();
  const pdef = PARTS_SHOP.find(p => p.id === partId);
  if (!pdef) return { ok: false, reason: 'Peça não existe' };
  const installed = s.installedParts[s.activeCar] || [];
  if (installed.includes(partId)) return { ok: false, reason: 'Já instalada' };
  if (pdef.req && !installed.includes(pdef.req)) {
    const reqDef = PARTS_SHOP.find(p => p.id === pdef.req);
    return { ok: false, reason: `Requer: ${reqDef ? reqDef.name : pdef.req}` };
  }
  if (s.money < pdef.price) return { ok: false, reason: 'Saldo insuficiente' };
  return { ok: true, cost: pdef.price };
}

export function buyPart(partId) {
  const check = canBuyPart(partId);
  if (!check.ok) return check;
  const s = getState();
  const pdef = PARTS_SHOP.find(p => p.id === partId);
  s.money -= pdef.price;
  s.totalSpent += pdef.price;
  if (!s.installedParts[s.activeCar]) s.installedParts[s.activeCar] = [];
  s.installedParts[s.activeCar].push(partId);
  saveManager();
  return { ok: true, cost: pdef.price };
}

export function addPrize(position) {
  const s = getState();
  const prize = PRIZES[position] || 200;
  s.money += prize;
  s.totalEarnings += prize;
  s.racesCount++;
  if (position === 0) s.wins++;
  saveManager();
  return prize;
}

export function getMoney() { return getState().money; }

export function getEngineForceMultiplier() {
  const stats = getEffectiveStats(getState().activeCar);
  const basePower = stats.motor * 0.5 + stats.aero * 0.3 + stats.pneus * 0.2;
  return 0.7 + (basePower / 10) * 0.6;
}

export function getFrictionMultiplier() {
  const stats = getEffectiveStats(getState().activeCar);
  return 0.85 + (stats.pneus / 10) * 0.3;
}

export function getAeroDownforceMultiplier() {
  const stats = getEffectiveStats(getState().activeCar);
  return 0.8 + (stats.aero / 10) * 0.4;
}

export function colorHex(c) {
  return '#' + (c >>> 0).toString(16).padStart(6, '0');
}

export function getDamagePercent(carId) {
  const s = getState();
  const dmg = s.damage[carId || s.activeCar] || { motor: 0, aero: 0, pneus: 0 };
  return Math.round((dmg.motor + dmg.aero + dmg.pneus) / 3);
}

export function getInstalledParts(carId) {
  const s = getState();
  const ids = s.installedParts[carId || s.activeCar] || [];
  return ids.map(id => PARTS_SHOP.find(p => p.id === id)).filter(Boolean);
}

// ── Championship ──────────────────────────────────────────

const CHAMP_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const CHAMP_PRIZES = [8000, 5000, 3500, 2000, 1000]; // per-round prize boost by pos
const CHAMP_AI = ['Rocket', 'Flash', 'Shadow', 'Blaze'];

export function getChampionship() {
  return getState().championship;
}

export function isChampionshipActive() {
  const c = getChampionship();
  return !!(c && c.active && !c.finished);
}

export function startChampionship() {
  const s = getState();
  s.championship = {
    active: true,
    round: 0,
    standings: { Você: 0 },
    playerPoints: 0,
    results: [],
    finished: false,
  };
  for (const name of CHAMP_AI) s.championship.standings[name] = 0;
  saveManager();
  return s.championship;
}

export function abandonChampionship() {
  const s = getState();
  s.championship = defaultState().championship;
  saveManager();
}

export function getChampionshipRoundIndex() {
  return getChampionship().round || 0;
}

/**
 * Record end of a championship race.
 * @param {number} playerPos 0-based finishing position
 * @param {Array<{name:string,isPlayer:boolean}>} ranks ordered standings
 * @param {string} sceneId
 * @returns {{ points: number, prize: number, finished: boolean, standings: object }}
 */
export function recordChampionshipResult(playerPos, ranks, sceneId) {
  const s = getState();
  const champ = s.championship;
  if (!champ || !champ.active) return null;

  // Award points to all ranked racers present
  ranks.forEach((r, idx) => {
    const pts = CHAMP_POINTS[idx] || 0;
    if (!champ.standings[r.name]) champ.standings[r.name] = 0;
    champ.standings[r.name] += pts;
  });
  champ.playerPoints = champ.standings['Você'] || 0;

  const points = CHAMP_POINTS[playerPos] || 0;
  // Prize: base race prize already via addPrize; championship bonus
  const bonus = CHAMP_PRIZES[playerPos] || 400;
  s.money += bonus;
  s.totalEarnings += bonus;

  champ.results.push({
    sceneId,
    playerPos,
    points,
    prize: bonus,
    round: champ.round,
  });

  champ.round += 1;
  // 5 rounds
  if (champ.round >= 5) {
    champ.finished = true;
    champ.active = false;
    // Final purse based on overall rank
    const board = getChampionshipBoard();
    const overall = board.findIndex((e) => e.name === 'Você');
    const finalPurse = [15000, 9000, 5000, 2500, 1000][overall] || 500;
    s.money += finalPurse;
    s.totalEarnings += finalPurse;
    champ.finalPurse = finalPurse;
    champ.finalPlace = overall;
  }

  saveManager();
  return {
    points,
    prize: bonus,
    finished: champ.finished,
    standings: { ...champ.standings },
    finalPurse: champ.finalPurse,
    finalPlace: champ.finalPlace,
  };
}

export function getChampionshipBoard() {
  const champ = getChampionship();
  const entries = Object.entries(champ.standings || {}).map(([name, pts]) => ({ name, pts }));
  entries.sort((a, b) => b.pts - a.pts);
  return entries;
}

export function getChampPointsTable() {
  return CHAMP_POINTS;
}

