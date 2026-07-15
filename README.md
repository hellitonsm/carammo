# CarAmmo Deluxe — Corrida 3D

Versão melhorada do jogo de corrida 3D usando **Three.js** + **Ammo.js**, com 3 cenários distintos, pistas mais elaboradas, adversários IA, nitro, efeitos de partículas, som de motor e muito mais.

## ✨ Funcionalidades

### 🗺️ 3 Cenários jogáveis
- 🌲 **Floresta** — circuito clássico com vegetação densa, curvas largas, postes, barreiras vermelhas e asfalto escuro
- 🏜️ **Deserto** — dunas ao fundo, céu de pôr-do-sol, atrito menor (mais derrapagem), cactos e poeira nos pneus
- ❄️ **Nevasca** — pista gelada com atrito baixo (drift!), partículas de neve em tempo real, pinheiros com ponta branca, longas retas, zebras azuis/brancas

### 🛣️ Pistas melhoradas
- Cada cenário tem seu próprio traçado com CatmullRom, elevações, curvas de diferentes raios e retas longas
- Largura variável em trechos do deserto e neve (estreitamentos que aumentam a dificuldade)
- Zebras coloridas por cenário, linhas centrais pontilhadas, linhas laterais
- Postes de iluminação, barreiras, cones de tráfego, pedras, postes xadrez na linha de largada
- Texturas procedurais de asfalto (com marcas de pneu na neve) e chão (grama/areia/neve)

### 🚘 Jogabilidade
- **3 adversários IA** (Rocket, Flash, Shadow) com níveis de habilidade (82%/88%/93%) — freiam nas curvas, aceleram nas retas e erram propositalmente
- **Sistema de nitro** (Shift) com barra animada no HUD, chamas azuis/laranjas saindo do escapamento
- **3 modos de câmera** (tecla `C`): perseguição, capô (primeira pessoa com FOV maior) e distante
- **FOV dinâmico** e **shake** de câmera em alta velocidade, freios e nitro
- **Speed lines** (linhas de velocidade) acima de 80 km/h
- **Pause** com tecla `ESC`
- Setas do teclado também funcionam (↑↓←→)
- **5 cores de carro** (vermelho, azul, verde, amarelo, preto)
- Reset com `R` se capotar ou sair do mapa

### ✨ Efeitos visuais
- Fumaça saindo do escapamento em aceleração (branca/escura conforme velocidade)
- **Poeira/neve/areia** jogada pelos pneus traseiros em derrapagem e aceleração forte
- Chamas de nitro azul/laranja nos escapamentos
- Partículas de neve caindo em tempo real no cenário nevado
- Marcas de pneu pretas que aparecem em frenagens e derrapagens (desvanecem com o tempo)
- Faróis com luz projetada à noite
- Sol segue o jogador para sombras consistentes

### 🔊 Áudio
- Som de motor em tempo real usando Web Audio API (oscilação serrilhada com frequência proporcional à velocidade + aceleração)
- Beeps na contagem regressória e ao completar volta
- O som inicia após a primeira interação do usuário (política dos navegadores)

### 📊 HUD completo
- Velocímetro em km/h
- Contagem de voltas (Volta X/3)
- Tempo da volta atual, melhor volta e tempo total
- Posição na corrida (1º/4)
- Barra de nitro com gradiente azul→laranja e pulso quando ativo
- Nome do cenário no canto superior direito
- Minimapa com traçado da pista, progresso destacado em laranja, pontos coloridos para adversários e seta direcional do jogador
- Tela de resultados com pódio 🥇🥈🥉 e tempos de todos os pilotos

## 🎮 Controles

| Tecla               | Ação                  |
| ------------------- | --------------------- |
| `W` ou `↑`          | Acelerar              |
| `S` ou `↓`          | Freio / ré            |
| `A/D` ou `←/→`      | Virar                 |
| `Espaço`            | Freio de mão (drift)  |
| `Shift`             | Nitro                 |
| `R`                 | Resetar posição       |
| `C`                 | Trocar câmera         |
| `ESC`               | Pausar                |

## ▶️ Como executar

O jogo precisa de um servidor HTTP local (para carregar módulos ES):

```bash
cd carammo
python3 -m http.server 2626
```

Acesse `http://localhost:2626` no navegador.

## 🛠️ Tecnologias

- **Three.js** 0.160 (via importmap CDN)
- **Ammo.js** (Bullet Physics para WebAssembly)
- HTML5/CSS3/JavaScript puro — sem build, sem bundler
- **Web Audio API** para sintetizar som do motor em tempo real

## 📁 Estrutura

```
carammo/
├── index.html   # Menu, HUD e tela de resultados
├── main.js      # Física, IA, cenários, partículas, áudio
├── style.css    # Estilos do menu, HUD e painéis
└── README.md
```

## 📜 Licença

MIT
