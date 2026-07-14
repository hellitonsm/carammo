# CarAmmo — Corrida 3D

Jogo de corrida de carros 3D com física realista, desenvolvido com Three.js e Ammo.js.

## Funcionalidades

- **Seleção de carro** — 3 opções de cores (vermelho, azul, verde)
- **Circuito fechado** — 3 voltas com paisagem 3D completa
- **Física realista** — Peso, aceleração, freio de mão, derrapagens
- **Marcas de pneu** — Rastros visíveis no asfalto ao frear
- **Minimapa** — Acompanhe sua posição no circuito
- **HUD completo** — Velocímetro, contagem de voltas, melhores tempos

## Controles

| Tecla | Ação |
|-------|------|
| `W` | Acelerar |
| `S` | Ré |
| `A` / `D` | Virar |
| `Espaço` | Freio de mão |
| `R` | Resetar posição |

## Como executar

O jogo roda no navegador e precisa de um servidor local:

```bash
# Python 3
python3 -m http.server 8000

# Node.js
npx serve .
```

Acesse `http://localhost:8000` no navegador.

## Tecnologias

- [Three.js](https://threejs.org/) — Renderização 3D
- [Ammo.js](https://github.com/kripken/ammo.js/) — Motor de física (port do Bullet)
- HTML/CSS/JS puro

## Estrutura

```
carammo/
├── index.html    — Interface do jogo
├── main.js       — Lógica do jogo e física
└── style.css     — Estilos e HUD
```

## Licença

MIT