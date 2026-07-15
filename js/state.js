// Unique mutable state source. Modules import getters/setters only.

// ── Selection ──
let selectedCarColor = 0xd62828;
let selectedScene = 'forest';
let aiEnabled = true;
let nitroEnabled = true;
let paused = false;

// ── Three.js ──
let renderer = null;
let scene = null;
let camera = null;
let clock = null;
let sun = null;

// ── Vehicles ──
let vehicles = [];
let playerVehicle = null;

// ── Physics ──
let physicsWorld = null;

// ── Track ──
let currentSceneDef = null;
let trackCurve = null;
let trackLength = 0;
let trackStartPos = null;
let trackStartDir = null;
let trackWidth = 12;
let minimapPath = null;
let minimapBounds = null;

// ── Race ──
let lap = 0;
let raceState = 'menu'; // 'menu' | 'countdown' | 'racing' | 'finished'
let countdownValue = 3;
let countdownTimer = 0;
let lapStartTime = 0;
let bestLapMs = null;
let totalRaceMs = 0;
let raceAccumMs = 0;

// ── Controls ──
let controlsEnabled = false;
let frameProgress = 0;
let nitro = 100;
let nitroActive = false;
let camMode = 0;
let currentSteer = 0;
let skidCooldown = 0;
let cameraToggleCooldown = 0;
let escapeCooldown = 0;
const keys = {
  w: false, s: false, a: false, d: false,
  space: false, shift: false, r: false, c: false, escape: false,
};

// ── Skid marks ──
let skidMarks = [];
const MAX_SKIDS = 240;
let skidGeo = null;
let skidMat = null;

// ── Snow ──
let snowParticles = null;

// ── Audio ──
let audioCtx = null;
let engineOsc = null;
let engineGain = null;

// ── Speed lines ──
let speedLines = null;

// ── World particles ──
let worldParticles = [];
let exhaustSys = null;
let dustSys = null;
let nitroFlameSys = null;

// ── Neural AI ──
let rlAgent = null;
let useNeuralAI = true;
let frameCount = 0;

// ── Getters / Setters ──
export function getSelectedCarColor() { return selectedCarColor; }
export function setSelectedCarColor(v) { selectedCarColor = v; }
export function getSelectedScene() { return selectedScene; }
export function setSelectedScene(v) { selectedScene = v; }
export function getAiEnabled() { return aiEnabled; }
export function setAiEnabled(v) { aiEnabled = v; }
export function getNitroEnabled() { return nitroEnabled; }
export function setNitroEnabled(v) { nitroEnabled = v; }
export function getPaused() { return paused; }
export function setPaused(v) { paused = v; }

export function getRenderer() { return renderer; }
export function setRenderer(v) { renderer = v; }
export function getScene() { return scene; }
export function setScene(v) { scene = v; }
export function getCamera() { return camera; }
export function setCamera(v) { camera = v; }
export function getClock() { return clock; }
export function setClock(v) { clock = v; }
export function getSun() { return sun; }
export function setSun(v) { sun = v; }

export function getVehicles() { return vehicles; }
export function setVehicles(v) { vehicles = v; }
export function getPlayerVehicle() { return playerVehicle; }
export function setPlayerVehicle(v) { playerVehicle = v; }

export function getPhysicsWorld() { return physicsWorld; }
export function setPhysicsWorld(v) { physicsWorld = v; }

export function getCurrentSceneDef() { return currentSceneDef; }
export function setCurrentSceneDef(v) { currentSceneDef = v; }
export function getTrackCurve() { return trackCurve; }
export function setTrackCurve(v) { trackCurve = v; }
export function getTrackLength() { return trackLength; }
export function setTrackLength(v) { trackLength = v; }
export function getTrackStartPos() { return trackStartPos; }
export function setTrackStartPos(v) { trackStartPos = v; }
export function getTrackStartDir() { return trackStartDir; }
export function setTrackStartDir(v) { trackStartDir = v; }
export function getTrackWidth() { return trackWidth; }
export function setTrackWidth(v) { trackWidth = v; }
export function getMinimapPath() { return minimapPath; }
export function setMinimapPath(v) { minimapPath = v; }
export function getMinimapBounds() { return minimapBounds; }
export function setMinimapBounds(v) { minimapBounds = v; }

export function getLap() { return lap; }
export function setLap(v) { lap = v; }
export function getRaceState() { return raceState; }
export function setRaceState(v) { raceState = v; }
export function getCountdownValue() { return countdownValue; }
export function setCountdownValue(v) { countdownValue = v; }
export function getCountdownTimer() { return countdownTimer; }
export function setCountdownTimer(v) { countdownTimer = v; }
export function getLapStartTime() { return lapStartTime; }
export function setLapStartTime(v) { lapStartTime = v; }
export function getBestLapMs() { return bestLapMs; }
export function setBestLapMs(v) { bestLapMs = v; }
export function getTotalRaceMs() { return totalRaceMs; }
export function setTotalRaceMs(v) { totalRaceMs = v; }
export function getRaceAccumMs() { return raceAccumMs; }
export function setRaceAccumMs(v) { raceAccumMs = v; }

export function getControlsEnabled() { return controlsEnabled; }
export function setControlsEnabled(v) { controlsEnabled = v; }
export function getFrameProgress() { return frameProgress; }
export function setFrameProgress(v) { frameProgress = v; }
export function getNitro() { return nitro; }
export function setNitro(v) { nitro = v; }
export function getNitroActive() { return nitroActive; }
export function setNitroActive(v) { nitroActive = v; }
export function getCamMode() { return camMode; }
export function setCamMode(v) { camMode = v; }
export function getCurrentSteer() { return currentSteer; }
export function setCurrentSteer(v) { currentSteer = v; }
export function getSkidCooldown() { return skidCooldown; }
export function setSkidCooldown(v) { skidCooldown = v; }
export function getCameraToggleCooldown() { return cameraToggleCooldown; }
export function setCameraToggleCooldown(v) { cameraToggleCooldown = v; }
export function getEscapeCooldown() { return escapeCooldown; }
export function setEscapeCooldown(v) { escapeCooldown = v; }
export function getKeys() { return keys; }

export function getSkidMarks() { return skidMarks; }
export function setSkidMarks(v) { skidMarks = v; }
export function getMAX_SKIDS() { return MAX_SKIDS; }
export function getSkidGeo() { return skidGeo; }
export function setSkidGeo(v) { skidGeo = v; }
export function getSkidMat() { return skidMat; }
export function setSkidMat(v) { skidMat = v; }

export function getSnowParticles() { return snowParticles; }
export function setSnowParticles(v) { snowParticles = v; }

export function getAudioCtx() { return audioCtx; }
export function setAudioCtx(v) { audioCtx = v; }
export function getEngineOsc() { return engineOsc; }
export function setEngineOsc(v) { engineOsc = v; }
export function getEngineGain() { return engineGain; }
export function setEngineGain(v) { engineGain = v; }

export function getSpeedLines() { return speedLines; }
export function setSpeedLines(v) { speedLines = v; }

export function getWorldParticles() { return worldParticles; }
export function setWorldParticles(v) { worldParticles = v; }
export function getExhaustSys() { return exhaustSys; }
export function setExhaustSys(v) { exhaustSys = v; }
export function getDustSys() { return dustSys; }
export function setDustSys(v) { dustSys = v; }
export function getNitroFlameSys() { return nitroFlameSys; }
export function setNitroFlameSys(v) { nitroFlameSys = v; }

export function getRlAgent() { return rlAgent; }
export function setRlAgent(v) { rlAgent = v; }
export function getUseNeuralAI() { return useNeuralAI; }
export function setUseNeuralAI(v) { useNeuralAI = v; }
export function getFrameCount() { return frameCount; }
export function setFrameCount(v) { frameCount = v; }

export function togglePause() {
  paused = !paused;
  if (audioCtx) {
    if (paused && audioCtx.state === 'running') audioCtx.suspend();
    else if (!paused && audioCtx.state === 'suspended') audioCtx.resume();
  }
}
