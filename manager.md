# Racer Manager

Simulador de gerenciamento de equipe de corrida — gerencie carro, piloto, economia e dispute campeonatos contra 20 NPCs.

## Stack

| Camada     | Tecnologia      |
|------------|-----------------|
| Backend    | Python 3 + Flask |
| Banco      | SQLite           |
| CLI        | Python (built-in) |
| Frontend   | Flutter (Android/Linux) |
| Testes     | pytest           |

## Começando

```bash
# 1. Iniciar um save (popula banco com time + 20 NPCs + patrocinadores)
python main.py seed

# 2. Menu interativo
python main.py

# 3. Ou comandos diretos
python main.py race
python main.py status
python main.py shop
python main.py repair
python main.py sponsors
python main.py championship
python main.py saves
```

### Menu

```
[1] Correr
[2] Loja
[3] Reparar
[4] Status
[5] Patrocínios
[6] Campeonato
[7] Salvos
[0] Sair
```

### API (Flask)

```bash
python run.py
# Servidor em http://localhost:5000
```

Endpoints:

```
GET   /                    → Lista de endpoints
GET   /api/status          → Status do time
POST  /api/race            → Executar corrida
GET   /api/shop            → Loja (peças + pneu chuva)
POST  /api/shop/buy        → Comprar upgrade
POST  /api/shop/rain-tire  → Comprar pneu de chuva
GET   /api/repair          → Info de reparo
POST  /api/repair          → Executar reparo
GET   /api/sponsors        → Patrocínios
POST  /api/sponsors/accept → Aceitar patrocínio
POST  /api/sponsors/cancel → Cancelar patrocínio
GET   /api/championship    → Status do campeonato
POST  /api/championship/start → Iniciar campeonato
GET   /api/saves           → Listar saves
POST  /api/saves/create    → Criar save
POST  /api/saves/load      → Carregar save
DELETE /api/saves/<id>     → Deletar save
```

### Frontend (Flutter)

```bash
cd flutter_app
flutter run
```

---

## Motor de Simulação

### Fórmula Central

```
PoderCarro   = (motor * 0.5) + (aerodinamica * 0.3) + (pneus * 0.2)
Penalidade   = PoderCarro * (desgaste_acumulado / 100)
PoderPiloto  = habilidade_base + (nivel_xp * multiplicador)
ScoreFinal   = (PoderCarro - Penalidade + PoderPiloto) * FatorSorte * FatorClima * FatorPneu
```

### Componentes do Carro

| Componente     | Peso  |
|----------------|-------|
| Motor          | 0.5   |
| Aerodinâmica   | 0.3   |
| Pneus          | 0.2   |

Cada peça tem nível **1-10** e desgaste **0-100%**. O valor efetivo é `valor_base * (1 - desgaste/100)`.

### Clima

| Clima       | Probabilidade | Fator   |
|-------------|---------------|---------|
| Seco        | 50%           | 1.00    |
| Chuva       | 30%           | 0.85-0.95 |
| Tempestade  | 20%           | 0.75-0.90 |

### Pneus de Chuva

Item na loja por **$5.000**. Sem eles em chuva/tempestade, o score sofre **-40%** (fator 0.6).

---

## Economia

| Item | Custo |
|------|-------|
| Upgrade de peça (nível N) | N × $1.000 |
| Reparo (por 10% desgaste) | $200 |
| Pneu de Chuva | $5.000 |

### Prêmios por Corrida

| Posição | Prêmio |
|---------|--------|
| 1º      | $5.000 |
| 2º      | $3.000 |
| 3º      | $2.000 |
| 4º      | $1.000 |
| 5º      | $500 |
| 6º-10º  | $200 |
| 11º+    | $50 |

---

## Campeonato

- Temporada de **7 corridas** com pontuação acumulada (sistema F1).
- Bônus de **$10.000** se vencer a última corrida.

### Pontuação

| Pos | Pts | Pos | Pts |
|-----|-----|-----|-----|
| 1º  | 25  | 6º  | 8   |
| 2º  | 18  | 7º  | 6   |
| 3º  | 15  | 8º  | 4   |
| 4º  | 12  | 9º  | 2   |
| 5º  | 10  | 10º | 1   |
|     |     | 11º+ | 0  |

---

## Patrocínios

Contratos que pagam bônus por corrida se a condição for atingida:

| Patrocínio       | Bônus  | Requisito |
|------------------|--------|-----------|
| Motor X          | $2.000 | Top 3     |
| Óleo Premium     | $1.500 | Top 3     |
| Veloz Parts      | $800   | Top 5     |
| Baterias Turbo   | $600   | Top 5     |
| PneuTech         | $300   | Top 10    |
| Combustível Rápido | $200 | Top 10    |

---

## XP do Piloto

- **+10 XP** por corrida
- **+5 XP bônus** se ficar no Top 3
- A cada **20 XP** o piloto sobe de nível
- `PoderPiloto = habilidade_base + (nivel_xp * multiplicador)`

---

## Salvos Múltiplos

Os saves ficam em `backend/database/saves/` como arquivos `.db` independentes, gerenciados por `index.json`. Crie, carregue ou delete saves pelo menu ou API.

---

## Estrutura do Projeto

```
racer-manager/
├── main.py                    # CLI entry point
├── run.py                     # Flask entry point
├── RTK.md                     # Referência técnica detalhada
├── backend/
│   ├── api/app.py             # Flask app factory
│   ├── api/routes.py          # Blueprint com todos os endpoints
│   ├── database/
│   │   ├── connection.py      # SQLite + gerenciamento de saves
│   │   ├── schema.py          # CREATE TABLE statements
│   │   ├── seed.py            # Popula banco com dados iniciais
│   │   ├── repository.py      # CRUD + regras de negócio
│   │   └── saves/             # Arquivos .db de cada save
│   ├── engine/
│   │   └── power_score.py     # Fórmula de cálculo de score
│   ├── models/
│   │   ├── car.py             # Model Car (agrega CarPart)
│   │   ├── car_part.py        # Model CarPart (motor/aero/pneu)
│   │   ├── championship.py    # Model Championship
│   │   ├── driver.py          # Model Driver
│   │   └── race.py            # Model Race + RaceEntry
│   └── tests/                 # 32 testes pytest
└── flutter_app/               # Frontend Flutter
    └── lib/
        ├── main.dart
        ├── models/
        ├── screens/
        ├── services/
        └── theme/
```

---

## Testes

```bash
pytest backend/tests/ -v
```

32 testes cobrindo: power score, desgaste, clima, pneus de chuva, campeonato, saves e isolamento entre saves.
