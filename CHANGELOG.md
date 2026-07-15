# Changelog

## [Unreleased]

### Added
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
