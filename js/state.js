// ============================================================================
//  Shared mutable state — every module that needs to read/write game state
//  imports from here. This is the ONLY place `let` game state lives.
// ============================================================================

import { CFG } from './config.js';

// Selection / settings
export let selectedCarColor = 0xd62828;
export let selectedScene = 'forest';
export let aiEnabled = true;
export let nitroEnabled = true;
export let paused = false;

// Core Three.js objects
export let renderer, scene, camera, clock, sun;

// Vehicles
export let vehicles = [];
export let playerVehicle = null;

// Physics
export let physicsWorld = null;

// Track
export let currentSceneDef = null;
export let trackCurve = null;
export let trackLength = 0;
export let trackStartPos = null;
export let trackStartDir = null;
export let trackWidth = 0;
export let minimapPath = null;
export let minimapBounds = null;

// Race
export let lap = 0;
export let raceState = 'menu';
export let countdownValue = 3;
export let countdownTimer = 0;
export let lapStartTime = 0;
export let bestLapMs = null;
export let totalRaceMs = 0;
export let raceAccumMs = 0;

// Controls
export let controlsEnabled = false;
export let frameProgress = 0;
export let nitro = CFG.maxNitro;
export let nitroActive = false;
export let camMode = 0;
export let currentSteer = 0;
export let skidCooldown = 0;
export let cameraToggleCooldown = 0;
export let escapeCooldown = 0;
export let keys = { w:false,s:false,a:false,d:false,space:false,shift:false,r:false,c:false,escape:false };

// Skid marks
export let skidMarks = [];
export const MAX_SKIDS = 240;
export let skidGeo = null;
export let skidMat = null;

// Snow
export let snowParticles = null;

// Audio
export let audioCtx = null;
export let engineOsc = null;
export let engineGain = null;

// Speed lines
export let speedLines = null;

// World particles (dust/spray)
export const worldParticles = [];

// Particle systems (exhaust/dust/nitro flame)
export let exhaustSys = null;
export let dustSys = null;
export let nitroFlameSys = null;

// Neural AI
export let rlAgent = null;
export let useNeuralAI = true;
export let frameCount = 0;

// --- Setters (for modules that need to write state) ---
export function setRenderer(v) { renderer = v; }
export function setScene(v) { scene = v; }
export function setCamera(v) { camera = v; }
export function setClock(v) { clock = v; }
export function setSun(v) { sun = v; }
export function setPhysicsWorld(v) { physicsWorld = v; }
export function setCurrentSceneDef(v) { currentSceneDef = v; }
export function setTrackCurve(v) { trackCurve = v; }
export function setTrackLength(v) { trackLength = v; }
export function setTrackStartPos(v) { trackStartPos = v; }
export function setTrackStartDir(v) { trackStartDir = v; }
export function setTrackWidth(v) { trackWidth = v; }
export function setMinimapPath(v) { minimapPath = v; }
export function setMinimapBounds(v) { minimapBounds = v; }
export function setVehicles(v) { vehicles = v; }
export function setPlayerVehicle(v) { playerVehicle = v; }
export function setLap(v) { lap = v; }
export function setRaceState(v) { raceState = v; }
export function setCountdownValue(v) { countdownValue = v; }
export function setCountdownTimer(v) { countdownTimer = v; }
export function setLapStartTime(v) { lapStartTime = v; }
export function setBestLapMs(v) { bestLapMs = v; }
export function setTotalRaceMs(v) { totalRaceMs = v; }
export function setRaceAccumMs(v) { raceAccumMs = v; }
export function setControlsEnabled(v) { controlsEnabled = v; }
export function setFrameProgress(v) { frameProgress = v; }
export function setNitro(v) { nitro = v; }
export function setNitroActive(v) { nitroActive = v; }
export function setCamMode(v) { camMode = v; }
export function setCurrentSteer(v) { currentSteer = v; }
export function setSkidCooldown(v) { skidCooldown = v; }
export function setCameraToggleCooldown(v) { cameraToggleCooldown = v; }
export function setEscapeCooldown(v) { escapeCooldown = v; }
export function setPaused(v) { paused = v; }
export function setSelectedCarColor(v) { selectedCarColor = v; }
export function setSelectedScene(v) { selectedScene = v; }
export function setAiEnabled(v) { aiEnabled = v; }
export function setNitroEnabled(v) { nitroEnabled = v; }
export function setSnowParticles(v) { snowParticles = v; }
export function setAudioCtx(v) { audioCtx = v; }
export function setEngineOsc(v) { engineOsc = v; }
export function setEngineGain(v) { engineGain = v; }
export function setSpeedLines(v) { speedLines = v; }
export function setRlAgent(v) { rlAgent = v; }
export function setUseNeuralAI(v) { useNeuralAI = v; }
export function setFrameCount(v) { frameCount = v; }
export function setExhaustSys(v) { exhaustSys = v; }
export function setDustSys(v) { dustSys = v; }
export function setNitroFlameSys(v) { nitroFlameSys = v; }
export function setSkidGeo(v) { skidGeo = v; }
export function setSkidMat(v) { skidMat = v; }
