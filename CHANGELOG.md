# Changelog

## [Unreleased]

### Added
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
