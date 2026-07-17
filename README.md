# CarAmmo Deluxe — Corrida 3D

Jogo de corrida 3D usando **Three.js** + **Ammo.js**, com 3 cenários distintos, IA com rede neural que aprende em tempo real, nitro, efeitos de partículas, som de motor e muito mais.

## Funcionalidades

### Campeonato
- **5 rodadas** (Floresta → Deserto → Litoral → Metrópole → Nevasca)
- Pontuação F1-style (25-18-15-12-10…), prêmios por rodada + bolsa final
- Classificação persistente entre rodadas; botão **Próxima rodada** no pódio

### Sistema de Gerenciamento
- **5 carros jogáveis** com tiers (D → S) e **aparência 3D distinta** (hatch, cupê, GT, supercarro, hypercar): Carammo GT, Viper RS, Falcon X, Phantom S, Titan SS
- **10 peças instaláveis** com árvore de pré-requisitos (Turbo, ECU, Spoiler, Pneus, etc.)
- **Upgrades** de motor, aerodinâmica e pneus com nível máximo por carro
- **Sistema de dano** — cada corrida desgasta motor, aero e pneus; reparo individual ou completo
- **Economia** — saldo inicial $10.000, prêmios por posição ($500–$5.000), custos de reparo e upgrades
- **Compra e venda** de carros com 50% de valor de revenda
- **Stats afetam gameplay** — motor → força, pneus → atrito, aero → downforce
- **Overlay completo** com sidebar: Visão Geral, Garagem, Oficina, Loja de Carros, Loja de Peças

### 5 Cenários jogáveis
- **Floresta** — circuito clássico com vegetação densa, colina, pinheiros
- **Deserto** — dunas, céu de pôr-do-sol, atrito menor, cactos
- **Litoral** — praia, palmeiras, píer e barcos
- **Metrópole** — noite urbana, prédios e outdoors
- **Nevasca** — gelo, ponte, baixa aderência, neve

### Pistas
- CatmullRom com elevações, curvas de diferentes raios e retas longas
- Largura variável em trechos do deserto e neve
- Zebras coloridas, linhas centrais pontilhadas, postes de iluminação, barreiras, cones, pedras
- Texturas procedurais de asfalto e chão

### IA com Rede Neural (DQN)
- **4 voltas por corrida** (configurável em `CFG.raceLaps`)
- **4 adversários IA** (Rocket, Flash, Shadow, Blaze) com níveis de habilidade
- **Rede neural treina em tempo real** no browser durante as corridas
- **Agente DQN** com replay buffer, epsilon-greedy, Double DQN, target network
- Salvamento automático a cada 1000 frames + ao fechar aba
- **Toggle de IA Neural** no menu — ativar/desativar o aprendizado
- **Botão de reset** para apagar pesos e recomeçar do zero
- Status mostra passos de treinamento e tamanho dos dados salvos
- Stuck detection inteligente: carros que travam são reiniciados com reward negativo

### Jogabilidade
- **Sistema de nitro** (Shift) com barra animada, chamas azuis/laranjas
- **3 modos de câmera** (tecla `C`): perseguição, capô e distante
- **FOV dinâmico** e shake de câmera em alta velocidade
- **Speed lines** acima de 80 km/h
- **Pause** com tecla `ESC`
- Setas do teclado também funcionam
- **5 cores de carro** (vermelho, azul, verde, amarelo, preto)
- Reset com `R` se capotar ou sair do mapa

### Efeitos visuais
- Fumaça do escapamento, poeira/neve/areia nos pneus
- Chamas de nitro, partículas de neve em tempo real
- Marcas de pneu que desvanecem com o tempo
- Faróis com luz projetada, sombras consistentes

### Audio
- Motor em tempo real via Web Audio API
- Beeps na contagem regressiva e ao completar volta

### HUD
- Velocimetro, voltas, tempo, posicao, barra de nitro
- Minimapa com progresso e adversarios
- Tela de resultados com podio

## Controles

| Tecla | Acao |
|-------|------|
| `W` ou `↑` | Acelerar |
| `S` ou `↓` | Freio / re |
| `A/D` ou `←/→` | Virar |
| `Espaço` | Freio de mao (drift) |
| `Shift` | Nitro |
| `R` | Resetar posicao |
| `C` | Trocar camera |
| `ESC` | Pausar |

## Como executar

```bash
cd carammo
python3 -m http.server 2626
```

Acesse `http://localhost:2626` no navegador.

## Tecnologias

- **Three.js** 0.160 (via importmap CDN)
- **Ammo.js** (Bullet Physics para WebAssembly via WASM assíncrono)
- HTML5/CSS3/JavaScript ES modules — sem build, sem bundler
- **Web Audio API** para som do motor em tempo real
- **Código sem comentários** — toda a documentação vive na `SPEC.md`

## Estrutura

```
carammo/
├── index.html              # Menu, HUD e tela de resultados
├── main.js                 # Entry point async (Ammo WASM loading)
├── style.css               # Estilos do menu, HUD e paineis
├── scenarios.js            # Definicao dos 3 cenarios
├── neural-net.js           # Rede neural (3 camadas, Adam, ReLU)
├── rl-agent.js             # Agente DQN (replay buffer, epsilon-greedy)
├── SPEC.md                 # Especificacao completa da arquitetura
├── js/
│   ├── manager.js          # Gerenciamento: carros, pecas, upgrades, economia
│   ├── state.js            # Estado mutavel central + getters/setters
│   ├── config.js           # Constantes (CFG)
│   ├── physics.js          # Mundo Ammo.js
│   ├── sky.js              # Ceu procedural
│   ├── textures.js         # Texturas procedurais
│   ├── track-helpers.js    # Geometria pura (ribbon, offset)
│   ├── track-build.js      # Construcao da pista + colisao
│   ├── track-environment.js # Arvores, rochas, cenario
│   ├── car.js              # Mesh do carro + corpo Ammo (contem resetVehicle)
│   ├── particles.js        # Sistemas de particulas
│   ├── fx.js               # Escape, poeira, nitro, speed lines
│   ├── player-control.js   # Input do teclado + fisica
│   ├── ai.js               # IA rule-based + neural network
│   ├── sync-camera.js      # Sync fisica->mesh + camera
│   ├── lap-race.js         # Deteccao de volta, progresso
│   ├── hud.js              # Atualizacao do HUD
│   ├── countdown.js        # Contagem regressiva
│   ├── main-loop.js        # requestAnimationFrame
│   ├── skid-marks.js       # Marcas de pneu
│   └── audio.js            # Som do motor
├── CHANGELOG.md
└── README.md
```

## Licenca

MIT
