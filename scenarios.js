// ============================================================================
//  CarAmmo DELUXE — Definições dos 3 cenários
//  Separado para ficar fácil de editar/adicionar novos
// ============================================================================
import * as THREE from 'three';

// ---- PONTOS DE CONTROLE DAS PISTAS ----
// Cada ponto é [x, y, z] — CatmullRom faz curva suave entre eles

const FOREST_POINTS = [
  // Reta principal (larga, subida leve)
  [0, 0, 0],
  [35, 0.1, 5],
  [75, 0.2, 8],
  [120, 0.1, -2],
  // Curva longa à direita (descendo)
  [155, 0.0, -25],
  [170, -0.2, -55],
  [160, -0.3, -85],
  // Curva hairpin à esquerda (subida forte)
  [130, 0.2, -115],
  [85, 0.4, -130],
  [40, 0.5, -125],
  [5, 0.3, -100],
  // S-curva sinuosa pela floresta (elevada para sensação de altura)
  [-20, 0.2, -80],
  [-35, 0.3, -55],
  [-30, 5.5, -28],   // pista elevada (overpass)
  [-50, 5.8, -8],
  // Curva rápida à esquerda (subida)
  [-85, 0.6, 10],
  [-110, 0.7, 40],
  // Curva ampla à direita no topo
  [-100, 0.6, 70],
  [-70, 0.5, 90],
  [-40, 0.4, 85],
  // Descida rápida com S-curva
  [-22, 0.25, 65],
  [-10, 0.15, 40],
  [-4, 0.05, 18],
];

const DESERT_POINTS = [
  [0, 0, 0],
  [50, 0.2, -10],
  [95, 0.4, -35],
  // Curva fechada na duna
  [115, 0.6, -70],
  [105, 0.7, -105],
  // Hairpin no cânion
  [70, 0.5, -130],
  [25, 0.3, -140],
  [-20, 0.2, -130],
  // Reta longa dos falésias
  [-55, 0.15, -100],
  [-70, 0.2, -65],
  [-60, 0.3, -30],
  // Curva sobre duna
  [-35, 0.4, 0],
  [-60, 0.6, 35],
  [-90, 0.8, 65],
  [-100, 0.7, 100],
  // Curva cega na poeira
  [-75, 0.5, 120],
  [-35, 0.3, 125],
  [0, 0.2, 105],
  // S para a linha de chegada
  [22, 0.15, 70],
  [25, 0.08, 35],
  [12, 0, 12],
];

const SNOW_POINTS = [
  // Início — nível do chão, reta para frente
  [0, 0, 0],
  [45, 0, 12],
  [85, 0, 8],
  [115, 0, -15],
  // Subida íngreme pela montanha
  [125, 1.0, -55],
  [105, 2.0, -95],
  [65, 3.0, -115],
  // Ponte — cruzando sobre a pista inicial
  [25, 3.8, -85],
  [5, 3.8, -50],
  // Descida da ponte
  [-25, 2.8, -15],
  [-55, 1.8, 5],
  [-75, 0.8, 35],
  // Volta ao nível do chão
  [-60, 0, 65],
  [-30, 0, 55],
  [-10, 0, 28],
];

// ---- DEFINIÇÃO DOS 3 CENÁRIOS ----
export const SCENES = {
  forest: {
    id: 'forest',
    name: 'Floresta',
    emoji: '🌲',
    // Tempo/clima
    skyTop: 0x4a8fc8, skyBottom: 0xd4e8f5,
    fogColor: 0x9ec5de, fogDensity: 0.0017,
    sunColor: 0xfff2d6, sunIntensity: 1.35, sunAz: 60, sunEl: 90,
    ambientColor: 0xffffff, ambientInt: 0.30,
    hemiSky: 0xc8e4ff, hemiGround: 0x3d5c2e, hemiInt: 0.55,
    exposure: 1.10,
    // Chão
    groundColor: 0x3f6e35, groundTex: 'grass', groundRoughness: 0.95,
    // Pista
    trackColor: 0x2c2c2c, trackFriction: 0.88, trackWidth: 12,
    trackWearMarks: true,
    // Vegetação
    treeCount: 50, treeDensity: 14, treeTrunkColor: 0x6b4423,
    treeType: 'pine',
    // Objetos
    hasLamps: true, lampSpacing: 32,
    hasBarriers: true, barrierColor: 0xc42e2e,
    rumbleColorA: 0xd82222, rumbleColorB: 0xffffff,
    hasCones: true, coneCount: 1, conesEvery: 16,
    hasRocks: true, rockColor: 0x6a6a6a, rockCount: 120,
    // Extras
    hasFlowers: true,
    hasSigns: true,
    hasSheds: true,
    dustColor: 0xffffff, dustAlpha: 0.25,
    particles: null,
    points: FOREST_POINTS,
    widthVariation: 0,
  },

  desert: {
    id: 'desert',
    name: 'Deserto',
    emoji: '🏜️',
    skyTop: 0xd8722a, skyBottom: 0xfad49a,
    fogColor: 0xe8b878, fogDensity: 0.0028,
    sunColor: 0xffd070, sunIntensity: 1.65, sunAz: -30, sunEl: 70,
    ambientColor: 0xffd6a0, ambientInt: 0.42,
    hemiSky: 0xffd9a8, hemiGround: 0xa86a30, hemiInt: 0.55,
    exposure: 1.25,
    groundColor: 0xd8a865, groundTex: 'sand', groundRoughness: 1.0,
    trackColor: 0x6b5840, trackFriction: 0.76, trackWidth: 11,
    trackWearMarks: false,
    treeCount: 200, treeDensity: 16, treeTrunkColor: 0x7a5028,
    treeType: 'cactus',
    hasLamps: false,
    hasBarriers: false,
    rumbleColorA: 0xd89020, rumbleColorB: 0xffffff,
    hasCones: false,
    hasRocks: true, rockColor: 0xa06838, rockCount: 150,
    // Extras
    hasDunes: true, duneCount: 55,
    hasBarrels: true,
    hasSkulls: false,
    hasTumbleweeds: true,
    dustColor: 0xd8a865, dustAlpha: 0.75,
    particles: null,
    points: DESERT_POINTS,
    widthVariation: 1,
  },

  snow: {
    id: 'snow',
    name: 'Nevasca',
    emoji: '❄️',
    skyTop: 0x88a8c0, skyBottom: 0xdce6f0,
    fogColor: 0xc8d4de, fogDensity: 0.0042,
    sunColor: 0xf0f4ff, sunIntensity: 0.95, sunAz: 40, sunEl: 55,
    ambientColor: 0xc8d8ea, ambientInt: 0.55,
    hemiSky: 0xe6eef5, hemiGround: 0x90a8b8, hemiInt: 0.6,
    exposure: 1.0,
    groundColor: 0xe8eef5, groundTex: 'snow', groundRoughness: 0.9,
    trackColor: 0x48505a, trackFriction: 0.52, trackWidth: 13,
    trackWearMarks: true,
    treeCount: 320, treeDensity: 15, treeTrunkColor: 0x3a2818,
    treeType: 'pine-snow',
    hasLamps: true, lampSpacing: 38,
    hasBarriers: true, barrierColor: 0x2a5888,
    rumbleColorA: 0x2848a0, rumbleColorB: 0xffffff,
    hasCones: true, conesEvery: 18,
    hasRocks: true, rockColor: 0x7a8898, rockCount: 90,
    // Extras
    hasSnowPiles: true,
    hasIcePatches: true,
    hasSnowmen: true,
    snowParticles: true,
    dustColor: 0xffffff, dustAlpha: 0.6,
    particles: 'snow',
    points: SNOW_POINTS,
    widthVariation: 2,
  },
};

export function getScene(id) { return SCENES[id]; }
