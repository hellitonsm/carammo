# CarAmmo Deluxe

> criar o jogo. Contém arquitetura, módulos,
> algoritmos, valores de configuração e fluxo de execução.

---

## 1. Visão Geral

Jogo de corrida 3D single-player para navegador, sem build nem bundler.
O jogador escolhe um de 3 cenários, uma de 5 cores de carro e corre 3 voltas
contra 3 adversários controlados por IA. Um agente DQN opcional treina em
tempo real no navegador, persistindo pesos em `localStorage`.

### Stack
| Camada | Tecnologia |
|---|---|
| Render 3D | Three.js 0.160 (importmap CDN, ES module) |
| Física | Ammo.js (Bullet WASM) — `btRaycastVehicle` |
| Áudio | Web Audio API (oscilador sawtooth procedural) |
| IA neural | Rede neural pura JS em `Float64Array` + agente DQN |
| Build | Nenhum — serve com `python3 -m http.server` |

### Como rodar
```bash
python3 -m http.server 2626
# http://localhost:2626
```

---

## 2. Estrutura de Arquivos

```
carammo/
├── index.html              Menu, HUD, tela de resultados, import de scripts
├── main.js                 Entry point (~206 linhas)
├── style.css               Estilos do menu, HUD, painéis
├── scenarios.js            Definição dos 3 cenários (pontos + props)
├── neural-net.js           Rede neural (global, carrega antes dos módulos)
├── rl-agent.js             Agente DQN (global, carrega antes dos módulos)
├── js/
│   ├── config.js           CFG — constantes de tuning
│   ├── state.js            Estado mutável central + setters
│   ├── physics.js          Mundo Ammo.js
│   ├── sky.js              Céu procedural + iluminação por cenário
│   ├── textures.js         Texturas procedurais (canvas) + loadScene
│   ├── track-helpers.js    Geometria pura (ribbon, offset, nearest)
│   ├── track-build.js      Construção da pista + mesh de colisão
│   ├── track-environment.js Vegetação, rochas, cenário (29 KB)
│   ├── car.js              Mesh do carro + corpo Ammo + raycast vehicle
│   ├── particles.js        Sistemas de partículas mundo-espaciais
│   ├── fx.js               Escape, poeira, nitro, speed lines
│   ├── player-control.js   Input teclado → forças físicas + FX
│   ├── ai.js               IA rule-based + rede neural (DQN)
│   ├── sync-camera.js      Sync física→mesh + câmera multímodo
│   ├── lap-race.js         Detecção de volta, progresso, pódio
│   ├── hud.js              Velocímetro, voltas, minimapa
│   ├── countdown.js        3-2-1-GO
│   ├── main-loop.js        requestAnimationFrame
│   ├── skid-marks.js       Marcas de pneu (decals)
│   └── audio.js            Som do motor + beeps
└── README.md / CHANGELOG.md / SPEC.md
```

### Ordem de carregamento (index.html)
1. Ammo.js (CDN kripken) — script normal, define `window.Ammo`
2. `neural-net.js` — script normal, define `NeuralNetwork` global
3. `rl-agent.js` — script normal, define `RLAgent`/`ReplayBuffer` globais
4. importmap `{ "three": "...three.module.js" }`
5. `main.js` — ES module (entry point)

> `neural-net.js` e `rl-agent.js` são globais (não ES modules) para que
> `main.js` possa usar `new RLAgent(...)` no handler do botão reset.

---

## 3. Configuração Central — `js/config.js`

```js
export const CFG = {
  chassisSize:       { x: 1.0, y: 0.5, z: 2.2 },
  chassisMass:       800,
  wheelRadius:       0.4,
  wheelWidth:        0.3,
  wheelAxisOffset:   { x: 0.9, y: -0.2, z: 1.4 },
  engineForce:       2800,
  nitroForce:        5400,
  brakingForce:      90,
  maxSteer:          0.55,
  steerSpeed:        0.06,
  cameraHeight:      4.0,
  cameraDistance:    9.0,
  groundFriction:    0.9,
  raceLaps:          3,
  maxNitro:          100,
  nitroDrainRate:    35,   // por segundo
  nitroRegenRate:    8,    // por segundo
};
```

---

## 4. Estado Compartilhado — `js/state.js`

Único lugar com `let` para estado mutável do jogo. Todos os módulos
importam getters/setters daqui. Setters seguem o padrão `setX(v) { x = v; }`.

### Variáveis
- **Seleção**: `selectedCarColor`, `selectedScene`, `aiEnabled`, `nitroEnabled`, `paused`
- **Three.js**: `renderer`, `scene`, `camera`, `clock`, `sun`
- **Veículos**: `vehicles[]`, `playerVehicle`
- **Física**: `physicsWorld`
- **Pista**: `currentSceneDef`, `trackCurve`, `trackLength`, `trackStartPos`, `trackStartDir`, `trackWidth`, `minimapPath`, `minimapBounds`
- **Corrida**: `lap`, `raceState`, `countdownValue`, `countdownTimer`, `lapStartTime`, `bestLapMs`, `totalRaceMs`, `raceAccumMs`
- **Controles**: `controlsEnabled`, `frameProgress`, `nitro`, `nitroActive`, `camMode`, `currentSteer`, `skidCooldown`, `cameraToggleCooldown`, `escapeCooldown`, `keys{}`
- **Marcas de pneu**: `skidMarks[]`, `MAX_SKIDS=240`, `skidGeo`, `skidMat`
- **Neve**: `snowParticles`
- **Áudio**: `audioCtx`, `engineOsc`, `engineGain`
- **Speed lines**: `speedLines`
- **Partículas mundo**: `worldParticles[]`, `exhaustSys`, `dustSys`, `nitroFlameSys`
- **IA neural**: `rlAgent`, `useNeuralAI`, `frameCount`

### `keys` (objeto plano)
`w, s, a, d, space, shift, r, c, escape` — booleanos atualizados em `player-control.js`.

> `raceState` é uma máquina de estados: `'menu' | 'countdown' | 'racing' | 'finished'`.

---

## 5. Cenários — `scenarios.js`

`export const SCENES = { forest, desert, snow }` — cada um tem `id`, `name`, `emoji`.

### Props por cenário
| Prop | forest | desert | snow |
|---|---|---|---|
| `skyTop / skyBottom` | azul / azul-claro | laranja / creme | cinza-az / branco |
| `fogColor / fogDensity` | 0x9ec5de / 0.0017 | 0xe8b878 / 0.0028 | 0xc8d4de / 0.0042 |
| `sunColor / sunIntensity` | 0xfff2d6 / 1.35 | 0xffd070 / 1.65 | 0xf0f4ff / 0.95 |
| `sunAz / sunEl` | 60 / 90 | -30 / 70 | 40 / 55 |
| `ambientInt / hemiInt` | 0.30 / 0.55 | 0.42 / 0.55 | 0.55 / 0.6 |
| `exposure` | 1.10 | 1.25 | 1.0 |
| `groundColor / groundTex` | 0x3f6e35 / grass | 0xd8a865 / sand | 0xe8eef5 / snow |
| `trackColor / trackFriction` | 0x2c2c2c / 0.88 | 0x6b5840 / 0.76 | 0x48505a / 0.52 |
| `trackWidth` | 12 | 11 | 13 |
| `treeType / treeCount` | pine / 50 | cactus / 200 | pine-snow / 320 |
| `treeDensity` (dist min) | 14 | 16 | 15 |
| `hasLamps / lampSpacing` | true / 32 | false | true / 38 |
| `hasBarriers / barrierColor` | true / 0xc42e2e | false | true / 0x2a5888 |
| `rumbleColorA / rumbleColorB` | vermelho / branco | laranja / branco | azul / branco |
| `hasCones / conesEvery` | true / 16 | false | true / 18 |
| `hasRocks / rockCount / rockColor` | true / 120 / 0x6a6a6a | true / 150 / 0xa06838 | true / 90 / 0x7a8898 |
| `hasFlowers / hasSigns / hasSheds` | true / true / true | — | — |
| `hasDunes / duneCount` | — | true / (55 no def) | — |
| `hasBarrels / hasTumbleweeds` | — | true / true | — |
| `hasSnowPiles / hasSnowmen / hasIcePatches` | — | — | true / true / true |
| `snowParticles` | — | — | true |
| `dustColor / dustAlpha` | 0xffffff / 0.25 | 0xd8a865 / 0.75 | 0xffffff / 0.6 |
| `widthVariation` | 0 | 1 | 2 |
| `particles` | null | null | 'snow' |

### Pontos de controle (`points: number[][]`)
Arrays `[x, y, z]` usados para `THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5)`.

- **FOREST_POINTS** — 22 pontos: reta larga → hairpin à esquerda → S-curva elevada (overpass em y=5.5) → curva ampla topo → descida S
- **DESERT_POINTS** — 20 pontos: curva na duna → hairpin cânion → reta dos falésios → curva cega → S chegada
- **SNOW_POINTS** — 15 pontos: reta início → subida íngreme montanha → **ponte elevada** (y=3.8, cruza sobre pista inicial) → descida → retorno nível chão

### `widthFnFor(scn)` → `t => 1 + sin(t·π·4)·0.08·W + sin(t·π·9+1.3)·0.06·W` (W = `widthVariation`)
Retorna `null` se `widthVariation === 0` (pista de largura constante).

### `getScene(id)` → `SCENES[id]`

---

## 6. Boot / Entry Point — `main.js`

```
main()
 ├─ bindMenu()                      conecta UI do menu
 ├─ waitForAmmo()                   poll window.Ammo (timeout 30s)
 ├─ window.Ammo()                    inicializa Ammo WASM
 ├─ initThree()                     renderer + scene + camera + clock + resize
 │    ├─ initSpeedLines()            cria 60 segmentos de speed lines na câmera
 │    └─ initAudio()                 AudioContext + osc sawtooth
 ├─ initPhysics()                    btDiscreteDynamicsWorld (grav -9.81)
 ├─ initInput()                      keydown/keyup listeners
 ├─ initNeuralAI()                   carrega RLAgent do localStorage ou cria novo
 └─ createSkidMarks()                geo/mat das marcas

start-btn click:
  menu.hidden=true, hud.hidden=false
  setupRace()
    ├─ clearScene()                  remove e dispõe todos os filhos da scene
    ├─ loadScene(sceneId)            setCurrentSceneDef + chão/rochas/dunas/montes
    ├─ buildSky(scn)                 céu + luzes + sombras
    ├─ buildTrack(scn)               pista + colisão + ambiente + minimap path
    ├─ createVehicle(color, 0, true, 'Voce', 1.0)  → player
    ├─ if aiEnabled: 3× createVehicle(aiColor, i+1, false, aiName, skill)
    └─ addVehicle(...)
  startCountdown()
  animate()                          main loop
```

### Cores/nomes/skills dos 3 IA
| Índice | Cor | Nome | Skill |
|---|---|---|---|
| 1 | 0x9c27b0 | Rocket | 0.82 |
| 2 | 0xff9800 | Flash | 0.88 |
| 3 | 0x00bcd4 | Shadow | 0.93 |

### Render Three.js
- `WebGLRenderer({ antialias:true, powerPreference:'high-performance' })`
- `pixelRatio = min(devicePixelRatio, 2)`
- `shadowMap.enabled = true`, tipo `PCFSoftShadowMap`
- `outputColorSpace = SRGBColorSpace`, `toneMapping = ACESFilmic`, `exposure` ajustado por cenário
- Câmera: `PerspectiveCamera(60, aspect, 0.1, 1500)` em `(0,10,20)`
- Resize listener atualiza aspect + size

### Menu UI (index.html)
- `#scene-select`: 3 botões `.scene-option[data-scene]`
- `#car-select`: 5 botões `.car-option[data-color]` (0xd62828, 0x1e6bb8, 0x2a9d5c, 0xf4c430, 0x1a1a1a)
- `#opt-ai` (checked), `#opt-nitro` (checked), `#opt-neural` (checked)
- `#reset-ai-btn`: remove `localStorage['car-ai-agent']` e recria agente
- `#ai-status`: mostra passos de treino + KB salvos
- `#start-btn`: disabled até `ammoLoaded && selectedScene && selectedCarColor`
- Defaults: forest + vermelho selecionados

---

## 7. Física — `js/physics.js`

```js
btDefaultCollisionConfiguration → btCollisionDispatcher
btDbvtBroadphase → btSequentialImpulseConstraintSolver
btDiscreteDynamicsWorld(gravity = (0, -9.81, 0))
```

### Step (em main-loop)
`physicsWorld.stepSimulation(dt, 4, 1/120)` — max 4 substeps, 1/120 fixed.

---

## 8. Pista — `js/track-build.js` + `track-helpers.js`

### Construção (`buildTrack(scn)`)
1. `pts = scn.points.map(p => new Vector3(...))`
2. `curve = new CatmullRomCurve3(pts, true, 'centripetal', 0.5)` — **loop fechado**
3. `length = curve.getLength()`, `width = scn.trackWidth`
4. `wFn = widthFnFor(scn)` (pode ser null)
5. `startPos = curve.getPointAt(0)` + offset y(WheelRadius+0.6), `startDir = curve.getTangentAt(0)`
6. Chão: `PlaneGeometry(worldSize, worldSize)` rotacionado, textura procedural
7. Asfalto: `buildRibbon(curve, width/2, 1400, wFn)` — 1400 segmentos, DoubleSide
8. **Rumble strips** (zebras): 260 segmentos por lado, alternando cores A/B
9. **Lane markings**: linhas pontilhadas centrais (dash 2.2, gap 3.2)
10. **Side lines**: ribbons brancas a `width/2 - 0.4`
11. **Barriers** (se `hasBarriers`): `buildSegmentedBarrier` h=0.6 + postes a cada 10u
12. **Collision mesh**: triangula asphaltGeo → `btTriangleMesh` → `btBvhTriangleMeshShape` estático, fricção = `trackFriction`
13. **Start line**: textura xadrez canvas 64×8, BoxGeometry(width, 0.05, 2) + 2 pilares brancos
14. **Ice patches** (se `hasIcePatches`): 10 CircleGeometry raios random, semi-transparentes
15. `buildEnvironment(scn, curve, bound, wFn)` — ver seção 9
16. **Minimap path**: 141 pontos amostrados → `setMinimapPath`

### `buildRibbon(curve, halfW, segs, wFn)`
Para cada segmento: normal = perpendicular à tangente (no plano XZ). Posiciona
vértices esquerdo/direito a `±halfW * wFn(t)`. Índices triangulam como
`(a,c,b, b,c,d)`. UV = `(0, t*50), (1, t*50)`.

### `offsetCurve(curve, dist, outward, wFn)`
Amostra 400 pontos deslocados pela normal (inversa se `!outward`), retorna nova CatmullRom fechada.

### `buildSegmentedBarrier(curve, off, side, height, wFn, segs=500)`
Ribbon vertical (2 vértices por seg: base + topo) para muretas/barreiras.

### `nearestOnCurve(curve, p)`
Busca bruta em 221 amostras: retorna `{ dist, t, point }` do mais próximo.
> Performance: em `ai.js` há cache por frame (`_nearestCache`),
> zerado a cada chamada de `updateAI`.

### `computeTrackBounds(curve, extra=220)`
Itera 201 pontos, retorna bbox com margem `{ minX, maxX, minZ, maxZ, cx, cz, sizeX, sizeZ }`.

---

## 9. Ambiente — `js/track-environment.js`

`buildEnvironment(scn, curve, bound, wFn)` despacha por `scn.id`:

### placeTrees
- Instâncias (`InstancedMesh`) para tronco + folhas, tipo definido por `treeType`
- **pine**: Cone verde sobre cilindro marrom
- **cactus**: Cilindro com 0-2 braços (sub-instâncias)
- **pine-snow**: Cone escuro + cone branco (cap) + cone branco menor (cap2)
- Rejeição: distância < `treeDensity` da pista ou < 30 do start
- Escala aleatória 0.7–2.3

### placeLamps (se hasLamps)
A cada `lampSpacing`: poste cilíndrico 7.5 + braço + bulbo esférico emissivo + PointLight.

### placeCones (se hasCones)
A cada `conesEvery`: cone laranja + faixa branca, alternando lados.

### placeRocks (se hasRocks)
`rockCount` dodecaedros ao redor da pista, escala 0.4–2.4, achatados (y×0.7).

### Floresta
- `addFlowers`: 5 InstancedMesh de 60 icosaedros coloridos, dist 10–40 da pista
- `addSheds`: 5 galpões (cubo + teto cone + porta)
- `addSigns`: 8 placas com seta indicando curva (azul direita, vermelho esquerda)
- `addBroadleafTrees`: 60 instâncias de tronco + 120 instâncias de copa (icosaedro)

### Deserto
- `addDunes`: 38 semi-esferas achatadas (scale.y 0.28–0.5) a 38–113u da pista
- `addCanyon`: 2 paredes (caixa 18×22×28 + rocha topo + 8 boulders) + arco (torus meio) + 12 penhascos
- `addBarrels`: 25 barris vermelhos com 2 anéis torus
- `addTumbleweeds`: 20 icosaedros wireframe marrom

### Nevasca
- `addSnowPiles`: 50 esferas brancas achatadas
- `addSnowmen`: 6 bonecos de neve (3 esferas + botões + olhos + nariz cone + cartola + cachecol torus)
- `addSnowTracks`: ribbons cinza-claras nas bordas
- `addBridge`: deck + teto + laterais (40 segs entre t=0.45 e t=0.6) + 7 pilares
- `addFrozenLakes`: 3 círculos azul translúcido (raio 15–35) fora da pista
- `createSnowParticles`: 3000 pontos brancos, vel 0.5–2.0, respawn acima do player

---

## 10. Carro — `js/car.js`

### `buildCarMesh(colorHex)` → THREE.Group
| Parte | Geometria | Material |
|---|---|---|
| Body | Box(2x, 2y, 2z) | Standard cor, rough 0.28, metal 0.75 |
| Hood | Box menor à frente | mesmo bodyMat |
| Cab | Box transparente opacity 0.65 | Standard 0x111, metal 0.9 |
| Front/rear bumper | Box 2.1x×0.7y×0.3z | Standard 0x222 |
| Headlights (×2) | Sphere 0.14 emissiva | + SpotLight angle π/7 |
| Taillights (×2) | Sphere 0.11 vermelha emissiva | stored em userData.tlMat |
| Spoiler | Box 1.7×0.08×0.35 + 2 suportes | Standard 0x111 |
| Exhausts (×2) | Cylinder 0.08×0.25 | metal 0.9 |

`userData.tlMat` e `userData.bodyMat` referenciados depois (breake light).

### `createVehicle(colorHex, startIdx, isPlayer, name, skill)`
1. Mesh + `scene.add(mesh)`
2. **Compound shape**: `btCompoundShape` + `btBoxShape(chassisSize)` offset y=2.0
3. **Grid de largada**: `startIdx` → col = idx%2, row = floor(idx/2). Posição =
   `trackStartPos ± 2.5 (lateral) − 5·row − 1 (trás)` ao longo de `trackStartDir`
4. **btTransform** com yaw = `atan2(startDir.x, startDir.z)` → quaternion
5. **btRigidBody** mass=800, damping (lin 0.3, ang 0.95)
6. **btRaycastVehicle** com `setCoordinateSystem(0,1,2)`, adicionado como action
7. **4 rodas** em `wheelAxisOffset` (frente z+ é direção, atrás z−):
   - wheelDown=(0,-1,0), wheelAxle=(-1,0,0), connection=offset, radius=0.4
   - Mesh: cilindro tire (0x111) + cilindro rim (0xccc) rotacionados z=π/2
8. **Tuning**: suspensionStiffness=50, dampRelax=8, dampCompress=20,
   frictionSlip=`trackFriction·10`, rollInfluence=0.005
9. `createExhaust()` + `createWheelDustSystem()` (sistemas de partículas)

### Retorno
```js
{
  mesh, body, vehicle, wheels[4], color, isPlayer, name,
  progress: 0, lap: 0, lastT: 0, lastLap: 0,
  finished: false, finishTime: 0,
  aiSkill, aiState: { steer, accel, lookahead: 35+rand*10, error, errorTimer, stuckTimer },
  ramp: 0, startP
}
```

### `addVehicle(v)`
`setVehicles([...vehicles, v])`; se `isPlayer`, `setPlayerVehicle(v)`.

---

## 11. Input & Controle do Player — `js/player-control.js`

### `initInput()`
Listeners para `keydown`/`keyup` mapeando:
`w/↑`, `s/↓`, `a/←`, `d/→`, `Space`, `Shift`, `r`, `c`, `escape`.
Espaço previne default (scroll).

### `updatePlayerVehicle(dt)` (chamado no main loop, antes da IA)
1. Se `R` pressionado e racing → `resetVehicle(player, false)`
2. Decrementa cooldowns de câmera (0.3s) e escape (0.3s)
3. Se `C` → `camMode = (camMode+1) % 3`
4. Se `ESC` e racing → `togglePause()`
5. **Se pausado**: freia tudo, return
6. **Se !controlsEnabled ou !racing**: freio leve, ramp=0, return
7. **Velocidade**: `speedMs = hypot(linearVel)`, `speedKmh = speedMs·3.6`
8. **Nitro**: `nitroActive = nitroEnabled && shift && nitro>0 && w`
   - Drena `nitroDrainRate·dt`, regenera `nitroRegenRate·dt`
   - `updateNitroBar()`
9. **Engine force**: `maxE = nitroActive ? nitroForce : engineForce`
   - Se `w`: ramp suave baseada em speedKmh (1 → 1.5 → 2 → 2.4), com impulso inicial de 25 se speedMs<0.3
   - Se `s`: freio 0.6 ou ré `-engineForce·0.55`
   - Apply nas rodas traseiras (índices 2, 3)
10. **Downforce** se speedMs>1: `speedMs²·8 + (nitro?1800:0)` para baixo
11. **Steering**: target = ±maxSteer (a/d), lerp por `steerSpeed` → rodas dianteiras (0,1)
12. **Brake**: space → `brakingForce` + `spawnSkid` se >20km/h. Balance: dianteiras 100%, traseiras 35%
13. **Taillight emissive**: 2.2 se space, 0.5 senão
14. **Drift**: se `|localVel.x|>4 && speedKmh>25` → `spawnSkid`
15. **FX**: `emitExhaustFx`, `emitWheelDust`, `emitNitroFlames` (se ativo), `updateSpeedLines`
16. **Som**: `updateEngineSound(speedKmh, w && !s, space)`

### `resetVehicle(v, full)`
Teleporta para `v.startP`, zera velocidades/angular, `progress=lap=ramp=0`.
Se `full`: também `finished=false, finishTime=0`.

### `getLocalVelocity(v)`
`linearVel.applyQuaternion(mesh.quaternion.invert())` — velocidade no espaço do carro.

---

## 12. IA — `js/ai.js`

### `updateAI(dt)`
Se `!aiEnabled` return. Limpa cache `nearestOnCurve` por frame.
Para cada veículo não-player não-finalizado:
- Se `useNeuralAI && rlAgent && racing && controlsEnabled && !paused` → `updateNeuralAI`
- Senão → `updateRuleBasedAI`

### `beginAIFrame()` — reseta flag `_trainedThisFrame` (treina só 1× por frame).

---

## 12.1. IA Rule-Based — `updateRuleBasedAI(v, dt)`

1. Se pausa/!controls/!racing: freio leve, return
2. **Erro humano**: a cada 0.4–1.1s, `error = (rand−0.5)·(1−skill)·1.2`
3. **Lookahead**: `aheadT = (progress + lookahead·(1+speedKmh/200)/trackLength + rand·2.5/trackLength) % 1`
4. **Ângulo para target** (plano XZ): `atan2(to.x, to.z) − atan2(fwd.x, fwd.z)`, normalizado ±π, + error
5. **Steer**: `min(maxSteer, ang·steerMult)` onde steerMult=3.4 se |ang|>0.4 senão 2.8
6. **Target speed** = `max(40, 160 − sharp·120) · skill`
   - Se speedKmh < target−5 → accel crescente
   - Se speedKmh > target+10 → freio 0.4
   - Senão → cruise 28% engine
7. Downforce + antirim (chassisUp.y>0.88 → −220)
8. FX (exhaust, dust, skid se drift)
9. **Stuck detection**:
   - Se capotado (`up.y<0.3`), caiu (`y<−10`), ou `distFromTrack > trackWidth·3` → reset
   - Se `stuckTimer>2.5s && speedMs<1.5 && prevSpeed>5` → reset

---

## 12.2. IA Neural — `updateNeuralAI(v, dt, frame)`

### Estado (12 features) — `collectCarState(v, frame)`
```
[0]  speedKmh / 200
[1]  trackAngle / π              (ângulo até centro da pista à frente)
[2]  distToCenter                 (dist normalizada por trackWidth/2)
[3]  curv1                        (curvatura 10% à frente)
[4]  curv2                        (20% à frente)
[5]  curv3                        (30% à frente)
[6]  curv4                        (50% à frente — lookahead múltiplo)
[7]  terrainSlope · 10           (chassisUp.y − 1)
[8]  carDist[0] / 100            (dist ao carro mais próximo)
[9]  carDist[1] / 100
[10] carDist[2] / 100
[11] 0                            (reservado)
```

Curvaturas: distância entre pontos consecutivos a 10/20/30/50% de `trackLength·0.05` à frente.

### Ação — `rlAgent.selectAction(state)`
Retorna `{ steering ∈ {−1,−0.5,−0.25,0,0.25,0.5,1}, throttle ∈ {0,0.25,0.5,0.75,1} }`.

Aplicação: `steerVal = action.steering · maxSteer`, `engine = engineForce·throttle`,
freio se throttle<0.1.

### Reward — `calculateReward(v, prevProgress, frame)`
| Componente | Valor |
|---|---|
| Progresso na pista (wrap-around) | `Δprogress · 5000` |
| Bônus por volta completada | `+2000` |
| Velocidade | `+speedKmh · 0.5` |
| Muito lento (<3 km/h) | `−20` |
| Lento (<10 km/h) | `−5` |
| Alinhamento com tangente | `+fwd·tan · 5` |
| Na pista (<half) | `+2` |
| Borda (<trackWidth) | `−3` |
| Fora da pista | `−15` |
| Capotado (up.y<0.5) | `−100` |
| Movimento ré (Δprogress<−0.005) | `−30` |

### Stuck detection neural
- Capotado/fora → penalty `−500` (`done=true`), reset
- `stuckTimer>4s && speedMs<2` → penalty `−200` (`done=true`), reset

### Treinamento
- `rlAgent.remember(state, action, reward, newState, done)`
- `frameCount++`; se `frameCount % 10 === 0 && !_trainedThisFrame` → `rlAgent.train()`, flag=true
- `frameCount % 1000 === 0` → `rlAgent.save('car-ai-agent')`

---

## 13. Rede Neural — `neural-net.js`

### Arquitetura
- Input: 12 · Hidden: [32, 24, 16] · Output: 2
- **Ativação**: hidden = ReLU; output[0]=tanh (steering), output[1]=sigmoid (throttle)
- **Init**: He (`sqrt(2/cols)·randn`)
- **Storage**: pesos em `Float64Array` flat (cache-friendly), biases em `Float64Array`

### `predict(input)` (zero alocação)
Copia input → forward pass com ReLU inline → output tanh/sigmoid. Retorna `[steer, throttle]`.

### `trainSingle(target, lr)` (zero alocação)
Backprop com derivadas inline (tanh: 1−t², sigmoid: s(1−s), ReLU: 1 se pre>0).
Update weights/biases in-place. Retorna MSE `(e0²+e1²)/2`.

### Outros
- `clone()` — cópia profunda dos Float64Array
- `softUpdate(other, tau=0.005)` — `w = (1−τ)·w + τ·other.w`
- `toJSON / fromJSON` — converte flat→nested e volta
- `save(name) / load(name)` — localStorage

---

## 14. Agente RL — `rl-agent.js`

### `RLAgent(inputSize=12, hiddenSizes=[32,24,16], outputSize=2, options)`
Hiperparâmetros default do jogo:
```js
{ learningRate: 0.003, gamma: 0.95, epsilon: 0.6, epsilonMin: 0.05,
  epsilonDecay: 0.9997, batchSize: 32, bufferSize: 30000 }
```

### Redes
- `qNetwork` — política atual
- `targetNetwork` — clone estático, atualizado a cada 500 trainSteps

### `ReplayBuffer`
- Buffer circular, `maxSize` (30K), `push`/`sample(batchSize)` aleatório

### `selectAction(state, explore=true)`
- ε-greedy: com prob ε, ação aleatória **enviesada** (70% throttle≥0.5)
- Senão: `predict` → discretiza para nearest action; throttle mínimo 0.25

### Ações discretizadas
- Steering: `[-1, -0.5, -0.25, 0, 0.25, 0.5, 1]`
- Throttle: `[0, 0.25, 0.5, 0.75, 1.0]`

### `train()`
Se buffer < batchSize, return. Senão:
1. Sample batch
2. Para cada experiência:
   - `currentOutput = qNetwork.predict(state)`
   - `normalizedReward = tanh(reward · 0.001)`
   - `reinforceStrength = min(1,|nr|)·sign(nr)`, `alpha=0.3`
   - `targetSteering = cur + α·rs·(taken − cur)` (clamp ±1)
   - `targetThrottle = cur + α·rs·(taken − cur)` (clamp 0..1)
   - Se done && reward<−50: throttle −0.3 (evitar estado ruim)
   - `loss = qNetwork.trainSingle(target, lr)`
3. `trainSteps++`
4. A cada `targetUpdateFreq` (500): `targetNetwork = qNetwork.clone()`
5. `epsilon = max(epsilonMin, epsilon·epsilonDecay)`

### Persistência
- `save(name)`: `{ version:2, qNetwork: toJSON, epsilon, trainSteps, episodeRewards[-500], losses[-500], avgReward, hyperparams, savedAt }` → localStorage (com fallback de limpeza se quota estourar)
- `static load(name)`: reconstrói agente, valida `qNetwork.weights`
- Auto-save em `beforeunload` e `visibilitychange(hidden)`
- Reset: `localStorage.removeItem('car-ai-agent')` + recria agente

---

## 15. Loop Principal — `js/main-loop.js`

```js
animate()
  requestAnimationFrame(animate)
  dt = min(clock.getDelta(), 1/30)              // clamp anti-spike
  updateCountdown(dt)
  updatePlayerVehicle(dt)
  beginAIFrame()
  updateAI(dt)
  physicsWorld.stepSimulation(dt, 4, 1/120)
  for v in vehicles:
    v.vehicle.updateVehicle(dt)
    syncVehicle(v)                               // física→mesh+rodas
    updateProgress(v)                            // nearestOnCurve → v.progress
    if v.y < −20 && racing && !paused: resetVehicle(v, false)
  setFrameProgress(playerVehicle.progress)
  checkLaps()
  updateCamera(dt)
  updateHUD()
  updateMinimap()
  updateSkids(dt)
  updateWorldParticles(exhaustSys, dt, +1.5)    // grav positiva
  updateWorldParticles(dustSys, dt, −2)
  updateWorldParticles(nitroFlameSys, dt, −1)
  updateSnow(dt)                                 // se neve
  sun segue player (target + posição relativa)
  renderer.render(scene, camera)
```

---

## 16. Sync & Câmera — `js/sync-camera.js`

### `syncVehicle(v)`
Lê `getChassisWorldTransform()` → seta position/quaternion do mesh.
Para cada roda: `updateWheelTransform(i,true)` → seta position/quaternion dos wheel groups.

### `updateCamera(dt)` — 3 modos
| Modo | Tecla | dist | height | fov | lerp | descrição |
|---|---|---|---|---|---|---|
| 0 | default | 9 + min(speed·0.04, 6) | 4 + min(speed·0.01, 1.3) | 60 + min(speed·0.08, 14) | 0.12 | Perseguição |
| 1 | C×1 | 1.8 | 1.4 | 78 | 0.3 | Capô (cockpit) |
| 2 | C×2 | 9·1.7 + min(speed·0.05, 7) | 4·1.5 + min(speed·0.01, 1.5) | 55 | 0.1 | Distante |

- FOV lerp 0.08
- Offset aplicado com quaternion do carro (atrás em modo 0/2, frente em 1)
- **Shake** se `speedKmh>110 || space || nitroActive` → até 2.0 (nitro) ou 1.0
- LookAt: ponto à frente do carro (modo 1 mais longe)

---

## 17. Voltas & Corrida — `js/lap-race.js`

### `updateProgress(v)`
`v.progress = nearestOnCurve(trackCurve, v.mesh.position).t` — valor 0..1 ao longo do loop.

### `checkLaps()`
Se `raceState !== 'racing'` return. Para cada veículo:
- Detecta cruzamento de linha: `lastT > 0.88 && t < 0.12` (wrap da curva fechada)
- `v.lap++`
  - **Player**: calcula tempo de volta, atualiza `bestLapMs`, `raceAccumMs`, `lap++`, beep 880Hz. Se `lap >= raceLaps` → `finishRace()`
  - **IA**: se `lap >= raceLaps` → `finished=true`, `finishTime` calculado

### `finishRace()`
- `raceState='finished'`, `controlsEnabled=false`
- Salva RLAgent
- `playerVehicle.finished=true`, `finishTime=totalRaceMs`
- Computa `standings()` (sort: lap desc, finishedPorTempo, progress desc)
- Renderiza pódio em `#race-results` com medalhas e tempos

### `formatTime(ms)` → `MM:SS.mmm`

---

## 18. HUD — `js/hud.js`

### `updateHUD()`
- `#speed`: `speedKmh<span>km/h</span>`
- `#lap`: `Volta {min(lap+1, raceLaps)} / {raceLaps}`
- `#lap-time`: tempo desde `lapStartTime` ( só se racing)
- `#best-time`: melhor volta
- `#position-info`: `Posição: {idx+1}/{n}`; se neural: `| ε:{.2f} buf:{bufferSize}`
- Toggle `#pause-overlay` conforme `paused`

### `updateNitroBar()`
Se `!nitroEnabled`: esconde barra. Senão `width = nitro%`, toggle `.active` se `nitroActive`.

### `updateMinimap()`
Canvas 200×200. Calcula bounds uma vez (scale + offset).
- Fundo preto translúcido
- Traça path branco
- Traça progresso laranja semi até `playerVehicle.progress`
- Pontos por veículo: player laranja (raio 5 + seta direção), IA cor do carro (raio 4)

---

## 19. Contagem Regressiva — `js/countdown.js`

```
startCountdown():
  raceState='countdown', controlsEnabled=false
  countdownValue=3, countdownTimer=1
  showCountdown('3'); resetVehicle(all, full=true)
  lap=0, bestLapMs=null, raceAccumMs=0, nitro=maxNitro
  beep(440, 0.2, 0.2)

updateCountdown(dt):
  if raceState!='countdown' return
  countdownTimer -= dt
  if > 0 return
  countdownValue--
  if > 0: show(str), timer=1, beep(440)
  if == 0: show('GO!', green), raceState='racing', controlsEnabled=true,
           lapStartTime=now, timer=0.5, beep(880, 0.3, 0.25), hide after 700ms
```

Animação: reset via `animation='none'; offsetWidth; animation=''`.

---

## 20. Áudio — `js/audio.js`

### `initAudio()`
`AudioContext` + OscillatorNode (sawtooth, 60Hz) → GainNode (0) → destination. Start imediato.

### `updateEngineSound(speedKmh, accel, braking)`
- freq = `clamp(55, 50 + speedKmh·1.4 + (accel?40:0), 380)` — setTargetAtTime 0.08s
- vol = `min(0.05, 0.015 + speedKmh/3500 + (accel?0.015:0) − (braking?0.005:0))` — 0.1s

### `beep(freq=440, dur=0.15, vol=0.2)`
Square osc + gain com exponential decay para 0.001. Count-down e lap beep.

---

## 21. FX & Partículas — `js/fx.js` + `js/particles.js`

### Sistemas (`createWorldPointSystem(count, color, size, maxLife)`)
BufferGeometry com position/color/sizes + PointsMaterial (vertexColors, sizeAttenuation, depthWrite=false).
Data array: `{life, maxLife, vx, vy, vz, size}`. Índice circular.

| Sistema | count | size | maxLife |
|---|---|---|---|
| exhaust | 200 | 0.35 | 0.8 |
| dust | 400 | 0.3 | 1.0 (neve: 1.5) |
| nitroFlame | 250 | 0.4 | 0.4 |

### `emitParticle(sys, x,y,z, vx,vy,vz, size, color)`
Slot circular, reseta life, seta vel/size/tint.

### `updateWorldParticles(sys, dt, gravity)`
Para cada partícula viva: `pos += vel·dt`, `vy += gravity·dt`, drag `vx,vz *= 0.96`.

### `emitExhaustFx(v, speedKmh, drifting)`
Intensidade baseada em `keys.w`/accel do player ou `aiState.accel`.
Posição traseira (2 escapamentos). Cor: cinza (escuro se >120km/h), branco na neve.

### `emitWheelDust(v, speedKmh, hard)`
Apenas se `speedKmh>15`. Floresta só se `hard`. Intensidade 2 (hard), 1 (deserto), 0.4 (outros).
Emitido nas rodas traseiras.

### `emitNitroFlames(v)`
2 jatos traseiros, cor aleatória cyan/laranja, vel -10 z.

### `initSpeedLines()`
60 `LineSegments` children da câmera. Vida 0.25–0.55s, respawn aleatório acima de 80km/h.
`updateSpeedLines(speedKmh)`: intensity = `(speedKmh−80)/120`. Opacity = `min(0.8, intensity·0.8)`.

---

## 22. Marcas de Pneu — `js/skid-marks.js`

- Geo compartilhada: `PlaneGeometry(0.35, 1.1)`
- Mat opaca clone por marca (neve: opacity 0.22, outros: 0.5)
- `spawnSkid(carData)`: cooldown 0.04s. Marca nas rodas traseiras (2 e 3), yaw = direção do carro
- Buffer circular `MAX_SKIDS = 240` — remove a mais antiga
- `updateSkids(dt)`: decréscimo life 5s, opacity proporcional, dispose ao expirar

---

## 23. Céu & Iluminação — `js/sky.js`

### `buildSky(scn)`
- `scene.background = fogColor`, `fog = FogExp2(fogColor, fogDensity)`
- Remove luzes/céu existentes
- `HemisphereLight(hemiSky, hemiGround, hemiInt)`
- `AmbientLight(ambientColor, ambientInt)`
- **Sun**: `DirectionalLight(sunColor, sunIntensity)` em (sunAz, sunEl, 40)
  - `castShadow=true`, `mapSize=(2048,2048)`, bias −0.0003, normalBias 0.03
  - Frustum ±180, near 10, far 400
- `renderer.toneMappingExposure = scn.exposure`
- Sky dome: `SphereGeometry(1200)` BackSide, ShaderMaterial gradiente vertical top/bottom

---

## 24. Texturas Procedurais — `js/textures.js`

### `loadScene(sceneId)` — chão e features secundárias
- Chão grande 800×800 a y=−2 com groundTex/groundColor
- **Forest**: grass overlay + 60 rochas dodecaedro
- **Desert**: sand overlay + 40 dunas (semi-esfera, scale.y 0.3–0.5)
- **Snow**: snow overlay + 45 montes brancos

### `makeAsphaltTexture(scn)`
Canvas 256². Base `trackColor`. 6000 speckles. Neve adiciona 140 streaks curvos. Repeat (40, 1).

### `makeGroundTexture(type)`
Canvas 256². Tipos: `grass` (verde com 5000 speckles), `sand` (areia), `snow` (branco). Repeat (80, 80).

---

## 25. CSS / UI — `style.css`

Define estilos para:
- Menu principal (`.menu-bg`, `.menu-content`, `.section-title`)
- Botões de cenário (`.scene-option`, `.scene-thumb`, `.scene-name`, `.scene-desc`)
- Botões de carro (`.car-option`, `.car-preview`)
- Opções (`.opt` checkboxes)
- AI status (`.ai-status-text` com estados `.has-data`, `.cleared`, `.ai-reset`)
- HUD (`.hud-left`, `#speed`, `.hud-meta`, `#nitro-bar-wrap`, `#nitro-bar` com `.active`)
- Minimapa canvas
- Countdown (`#countdown` com animação, `.go` verde)
- Tela de results (`.finish-card`, `.pos1`, `.you`)

Fontes: Oswald (display) + IBM Plex Mono (mono).

---

## 26. Controles

| Tecla | Ação |
|---|---|
| `W` / `↑` | Acelerar |
| `S` / `↓` | Freio / Ré |
| `A` / `←` | Virar esquerda |
| `D` / `→` | Virar direita |
| `Espaço` | Freio de mão (drift) |
| `Shift` | Nitro |
| `R` | Resetar posição |
| `C` | Trocar câmera (3 modos) |
| `ESC` | Pausar |

---

## 27. Fluxo de Estados da Corrida

```
menu ──start──▶ countdown (3-2-1-GO) ──▶ racing ──3 voltas──▶ finished
  ▲                                                        │
  └────────────── menu-btn ◀────────── restart-btn ◀────────┘
                                             (volta direto para countdown)
```

- `R`/pós-finish não passam pelo menu; `restart-btn` chama `setupRace()` + `startCountdown()` direto
- `menu-btn` esconde finish/hud, mostra menu, seta `raceState='menu'`, pausa áudio

---

## 28. Pontos de Atenção / Invariantes

1. **Ammo é WASM assíncrono** — `waitForAmmo()` poll até 30s. Botão start só habilita após load.
2. **`neural-net.js` e `rl-agent.js` são scripts globais** (não ES modules) — definem classes no escopo global para uso em handlers de UI e em `ai.js`.
3. **`state.js` é a única fonte de `let`** — pattern setter para evitar problemas de re-export.
4. **Cada `setupRace()` chama `clearScene()`** que dispõe geometria/materiais — evitar vazamento de WebGL.
5. **Loop da curva é fechado** (`CatmullRomCurve3(..., true, ...)`) — detecção de volta usa wrap 0.88→0.12.
6. **Reward usa wrap-around** (`progressGain` ajustado se >0.5 ou <−0.5) para pistas circulares.
7. **Cache `nearestOnCurve`** é por-veículo por-frame (zerado em cada `updateAI`).
8. **Treinamento neural** ocorre no máximo 1× por frame (`_trainedThisFrame`).
9. **Auto-save** em `beforeunload`, `visibilitychange(hidden)`, e a cada 1000 frames.
10. **Física**: `stepSimulation(dt, 4, 1/120)` — até 4 substeps a 120Hz para estabilidade.
11. **dt clamped** a `1/30` no main loop (anti-spike de tab oculta).
12. **Reset de veículo** zera progress/lap — não conta como volta.
13. **`frictionSlip`** das rodas = `trackFriction·10` (escala Bullet).
14. **Bias de exploração**: 70% das ações aleatórias têm throttle ≥0.5 (carro não para).

---

## 29. Comandos de Verificação

```bash
# rodar
python3 -m http.server 2626

# types / lint (não há tooling configurado — projeto sem build)
# verifique erros no console do navegador (F12)
```

---

## 30. Dependências Externas

| Recurso | URL | Tipo |
|---|---|---|
| Three.js 0.160 | `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js` | importmap |
| Ammo.js | `https://cdn.jsdelivr.net/gh/kripken/ammo.js@main/builds/ammo.js` | script |
| Google Fonts | Oswald 500/700 + IBM Plex Mono 400/600 | CSS |
