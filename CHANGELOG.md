# Changelog

## [Unreleased]

### Added
- Rede neural DQN para IA dos veículos (neural-net.js, rl-agent.js)
- Agente RL com replay buffer, epsilon-greedy, Double DQN
- Treinamento em tempo real no browser com salvamento automático
- Separação do main.js em 20 módulos ES (js/)

### Fixed
- Corrige dunas invadindo a pista no cenário deserto (distância mínima verificada)
- Corrige IA: carros não reiniciavam depois de sair da pista
- Corrige stuck detection: timer aumentado para 2.5s, só reinicia se estava se movendo
- Corrige Ammo.js timing: referências resolvidas no momento da chamada, não no parse
- Corrige initNeuralAI: usa import estático em vez de import dinâmico

### Changed
- main.js: de ~2188 linhas para ~206 linhas (entry point)
- Estado compartilhado em js/state.js com setters

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
