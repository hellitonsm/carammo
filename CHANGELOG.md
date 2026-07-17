# Changelog

## [Unreleased]

### Added
- **RMSProp optimizer** na rede neural — adapta taxa de aprendizado por peso, evita gradientes que explodem/desaparecem
- **Ruído Gaussiano (Box-Muller)** na exploração — substitui epsilon-greedy discreto por perturbação contínua suave nas ações
- **Baseline de vantagem dinâmica** (`runningRewardAvg`) — IA só reforça ações acima da média esperada
- **Velocidade lateral (G-Force)** em `state[11]` — rede neural agora detecta oversteer/derrapagem
- **Penalidade de suavidade no volante** (`steerDelta * 3.0`) — incentiva traçados limpos e reduz oscilações

### Changed
- Rede neural: SGD puro → RMSProp (decay=0.9, eps=1e-8), LR 0.003→0.0005
- Exploração: ações discretas aleatórias → ruído Gaussiano contínuo sobre saídas da rede
- Treinamento: batch 32→64, gamma 0.95→0.98, epsilon 0.6→0.4, epsilonMin 0.05→0.02, decay 0.9997→0.9995
- Removido targetNetwork e targetUpdateFreq (estavam declarados mas nunca usados no treinamento)
- Save version bump v2→v3 com persistência do `runningRewardAvg`

### Fixed
- Bug em `softUpdate()`: `ob[ob]` → `ob[j]` (indexação incorreta do array de biases)
- **Sistema de gerenciamento completo** (`js/manager.js`) — catálogo de carros, loja de peças, upgrades, reparos, compra/venda de veículos
- Overlay de gerenciamento com sidebar (📊 Visão Geral, 🏎 Garagem, 🔧 Oficina, 🏪 Loja de Carros, ⚙️ Loja de Peças)
- 5 carros jogáveis com tiers (D, C, B, A, S): Carammo GT, Viper RS, Falcon X, Phantom S, Titan SS
- 10 peças instaláveis com sistema de pré-requisitos (Turbo, ECU, Escape, Spoiler, Difusor, Splitter, Pneus, Suspensão)
- Upgrades de motor/aero/pneus com nível máximo por carro
- Sistema de dano por corrida (motor, aerodinâmica, pneus) com reparo individual ou completo
- Prêmios em dinheiro por posição (1º=$5000, 2º=$3000, 3º=$2000, 4º=$1000, 5º=$500)
- Motor, atrito e downforce afetados por stats do carro ativo (multipliers)
- Indicador de dano no HUD quando total > 30%
- 4 adversários IA (Rocket, Flash, Shadow, Blaze) em vez de 3
- Botão "Resetar Save" no menu principal
- Header no menu com saldo e nome do carro ativo
- Saldo exibido no resultado da corrida
- SPEC.md com especificação completa da arquitetura do jogo
- Toggle de IA Neural no menu (checkbox)
- Botão de resetar pesos da IA com status (passos + tamanho)
- Auto-save da IA ao fechar aba ou trocar de aba
- Vetores Ammo pré-alocados (elimina GC pressure)
- Cache de nearestOnCurve por frame
- Vetores Three.js pré-alocados (_fwd, _up, _tan, etc.)
- Lookahead múltiplo no estado da IA neural (3 pontos futuros)
- Reset automático de carros fora da pista após 3s + penalidade de treinamento

### Fixed
- Corrige action format: `selectAction()` agora retorna `{steering, throttle}` em vez de array
- Corrige carros parados: reward de velocidade aumentado (0.5/kmh), penalidade se < 3 km/h
- Corrige reward de progresso: wrap-around para pistas circulares (progress > 0.5)
- Corrige stuck detection: timer aumentado para 4s, simplificado para `speedMs < 2.0`
- Corrige dunas invadindo a pista no deserto (distância mínima verificada)
- Corrige spawn dos carros na pista com chão colisionável
- Eleva chão visual para y=0 alinhando com a pista
- Reduz árvores na floresta de 450 para 50 (desempenho)

### Changed
- Treinamento: frequência de 4→10 frames, save a cada 1000 frames
- Hiperparâmetros: lr 0.001→0.003, gamma 0.99→0.95, epsilon 1.0→0.6, buffer 100K→30K
- IA refatorada: separada em updateNeuralAI() e updateRuleBasedAI()
- Reward reformulado: track alignment bonus, staying on track bonus, backward penalty
- Seleção de cor removida do menu (cor agora vem do carro ativo no catálogo)

## [0.4.0] - 2026-07-15

### Added
- SPEC.md com documentação detalhada do sistema

### Changed
- Refatoração massiva do estado: `export let` substituído por getters/setters centralizados em `state.js`
- Todos os comentários removidos do código (DRY — especificação vive na SPEC.md)
- `resetVehicle()` movido de `player-control.js` para `car.js`
- `stepPhysics()` extraído como export em `physics.js`
- HTML simplificado: removido Google Fonts, importmap Three.js inline, canvas explícito
- CSS reescrito: seletores simplificados, removido dependência de fontes externas
- `textures.js` simplificado: chão/rochas/dunas movidos para `track-environment.js`
- Mesh do carro reescrito com materiais separados e iluminação melhorada
- `main.js` reescrito com `main()` assíncrono e loading de Ammo.js WASM
- Áudio com auto-resume de AudioContext suspenso + `pauseAudio()`/`resumeAudio()`
- `raceLaps` alterado de 3 para 4 no `config.js`
- HUD com null-safety em elementos DOM
- Cache de nearestOnCurve por veículo (chave por id)
- Sistema de exhaust por veículo (opcional, fallback para global)

## [0.3.0] - 2026-07-15

### Added
- Cenário com desfiladeiro (canyon) e ponte
- Novos pontos de controle para o cenário deserto

## [0.2.0] - 2026-07-15

### Added
- 3 cenários de gameplay (deserto, floresta, neve)
- IA dos veículos com steering e freio inteligente
- Sistema de nitro e multi-câmera
- Partículas de poeira e neve
- Efeitos sonoros

## [0.1.0] - 2026-07-15

### Added
- Estrutura inicial do jogo
- README com documentação

## 0.5 — 2026-07-17

### Added
- **2 novos cenários jogáveis**: Litoral (praia, palmeiras, píer e barcos) e Metrópole (noite urbana, prédios, outdoors)
- **Modo Campeonato**: 5 rodadas (Floresta → Deserto → Litoral → Metrópole → Nevasca), pontuação F1-style (25-18-15-12-10…), prêmios por rodada + bolsa final
- **Banner de campeonato** no menu com rodada atual, seus pontos e último resultado
- **Carros da loja com mesh 3D distinto por tier** (starter/street/sport/super/hyper) — cada carro com silhueta própria (hatch, cupê, GT, supercarro, hypercar), asas, saias, entradas laterais
- **IA usa carros com estilos diferentes** (`AI_CAR_IDS`: street/sport/super/hyper) em vez de todos iguais
- **Ambiente costeiro**: dunas, sinais, píer de madeira com pilares e barcos com velas
- **Ambiente urbano**: 45 prédios com janelas emissivas, outdoors e sinais
- **Palmeiras instanciadas** no Litoral (folhas via InstancedMesh)
- Separação de botões: "Corrida Rápida" e "🏆 Campeonato (5 rodadas)"

### Changed
- README atualizado: 5 cenários, seção de Campeonato, aparência 3D dos carros
- Cenário Floresta: "overpass" → colina, descrição ajustada
- `buildCarMesh` agora recebe `carId` e resolve o estilo via tabela `BODY_STYLES`
- Menu bloqueia seleção de pista durante campeonato (cenas travadas por rodada)
