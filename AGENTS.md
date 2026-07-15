# Racer Manager — Metas de Desenvolvimento

## Regra: Comando `goal`
Sempre que o usuário digitar `goal`, implemente a próxima meta pendente (menor número, não completo) em ordem crescente de fase/número. Comece imediatamente a implementação sem perguntar qual. Se todas as metas estiverem completas, informe que o projeto está 100% finalizado.

# Racer Manager — Metas de Desenvolvimento

## Fase 1: Protótipo CLI

### F1.1 — Criar AGENTS.md
**Status:** ✅ Completo
**Descrição:** Este arquivo. Metas de todas as fases documentadas.
**Critério:** Arquivo criado e aprovado.

### F1.2 — Criar RTK.md
**Status:** ✅ Completo
**Descrição:** Documento de referência técnica com especificação matemática do motor de simulação.
**Critério:** Arquivo RTK.md criado com fórmulas, pesos e regras de negócio.

### F1.3 — Estruturar projeto Python
**Status:** ✅ Completo
**Descrição:** Criar diretórios `backend/models/`, `backend/engine/`, `backend/database/`, `backend/tests/` com `__init__.py`.
**Critério:** `python -c "from backend import models, engine, database"` funciona.

### F1.4 — Schema SQLite
**Status:** ✅ Completo
**Descrição:** Tabelas: `team`, `driver`, `car`, `car_part`, `race`, `race_result`.
**Critério:** Schema criado via script Python, tabelas existem no banco.

### F1.5 — Model CarPart
**Status:** ✅ Completo
**Descrição:** Classe `CarPart` com atributos: tipo (motor/aero/pneu), nivel (1-10), desgaste (0-100).
**Critério:** Teste unitário passa para criação e upgrade de CarPart.

### F1.6 — Model Car
**Status:** ✅ Completo
**Descrição:** Classe `Car` que agrega 3 CarPart (motor, aero, pneu) e calcula Poder do Carro.
**Critério:** `Car.power_score()` retorna: (motor*0.5)+(aero*0.3)+(pneus*0.2), considerando desgaste.

### F1.7 — Model Driver
**Status:** ✅ Completo
**Descrição:** Classe `Driver` com atributos: nome, habilidade_base, nivel_xp, multiplicador.
**Critério:** `Driver.power_score()` retorna: habilidade_base + (nivel_xp * multiplicador).

### F1.8 — Model Race
**Status:** ✅ Completo
**Descrição:** Classe `Race` que gerencia participantes, simulação e resultados.
**Critério:** Race.run() executa a simulação completa.

### F1.9 — Engine PowerScore
**Status:** ✅ Completo
**Descrição:** Função `calculate_final_score(car, driver) -> float`: (PoderCarro - Penalidade + PoderPiloto) * random(0.90, 1.10).
**Critério:** Score calculado corretamente em múltiplos cenários.

### F1.10 — CLI main.py race
**Status:** ✅ Completo
**Descrição:** Comando `python main.py race` que simula uma corrida com 20+ participantes e exibe grid.
**Critério:** Corrida executada via terminal, grid do 1º ao último lugar exibido.

### F1.11 — Seed de NPCs
**Status:** ✅ Completo
**Descrição:** Popular banco com 15-20 pilotos/carros NPC com stats variados (nivel 1-10).
**Critério:** Banco populado, NPCs disponíveis para corrida.

### F1.12 — CLI menu interativo
**Status:** ✅ Completo
**Descrição:** Menu: `[1] Correr [2] Status [0] Sair`.
**Critério:** Navegação funcional via terminal.

### F1.13 — Testes unitários (Power Score)
**Status:** ✅ Completo
**Descrição:** 1000 simulações: melhor carro + melhor piloto vence >80% das vezes.
**Critério:** `pytest tests/` passa.

### F1.14 — Teste de desgaste
**Status:** ✅ Completo
**Descrição:** Corridas consecutivas reduzem performance (desgaste acumula).
**Critério:** Teste mostra degradação ao longo de 5+ corridas.

---

## Fase 2: Economia

### F2.1 — Sistema de Dinheiro
**Status:** ✅ Completo
**Descrição:** Saldo inicial $10.000, prêmios por posição, custos de manutenção.
**Critério:** Dinheiro persiste entre corridas, prêmio é creditado ao final.

### F2.2 — Loja de Peças
**Status:** ✅ Completo
**Descrição:** Comprar/upgradear motor, aerodinâmica, pneus. Custos: nível * $1000.
**Critério:** Upgrade altera stats do carro, dinheiro é debitado.

### F2.3 — Desgaste e Reparo
**Status:** ✅ Completo
**Descrição:** Corridas adicionam desgaste (5-15%), reparo a $200 por 10% de desgaste.
**Critério:** Reparo zera desgaste, dinheiro é debitado.

### F2.4 — Evolução do Piloto
**Status:** ✅ Completo
**Descrição:** XP por corrida (10 + 5 bônus Top 3), níveis aumentam performance.
**Critério:** Piloto ganha XP, sobe de nível, XP persiste no banco.

### F2.5 — CLI Menu Expandido
**Status:** ✅ Completo
**Descrição:** Menu: `[1] Correr [2] Loja [3] Reparar [4] Status [0] Sair`.
**Critério:** Todas as opções funcionam.

---

## Fase 3: Interface Visual (Flask + Flutter)

### F3.1 — API Flask
**Status:** ✅ Completo
**Descrição:** Endpoints REST: `POST /race`, `GET /status`, `POST /shop/buy`, `POST /repair`.
**Critério:** Flask serve, endpoints retornam JSON.

### F3.2 — Setup Flutter
**Status:** ✅ Completo
**Descrição:** Projeto Flutter criado, tema de corrida, estrutura de telas.
**Critério:** `flutter run` abre o app.

### F3.3 — Tela Dashboard
**Status:** ✅ Completo
**Descrição:** Status do time, dinheiro, stats do carro e piloto.
**Critério:** Dados reais do backend aparecem na tela.

### F3.4 — Tela Garagem/Oficina
**Status:** ✅ Completo
**Descrição:** Comprar peças, reparar desgaste.
**Critério:** Ações na UI refletem no backend.

### F3.5 — Tela Corrida/Resultado
**Status:** ✅ Completo
**Descrição:** Grid final, prêmios, animação.
**Critério:** Corrida executada via UI, resultado exibido.

### F3.6 — Integração API-Flutter
**Status:** ✅ Completo
**Descrição:** Chamadas HTTP do Flutter para o Flask.
**Critério:** App completamente funcional conectado ao backend.

---

## Fase 4: Expansão

### F4.1 — Patrocinadores
**Status:** ✅ Completo
**Descrição:** Contratos que pagam valor fixo por corrida se ficar no Top 5.
**Critério:** Patrocinador ativo paga prêmio bônus quando condição atendida.

### F4.2 — Clima Dinâmico
**Status:** ✅ Completo
**Descrição:** Sistema de clima (seco, chuva, tempestade) sorteado por corrida.
**Critério:** Clima afeta scores dos participantes.

### F4.3 — Pneus de Chuva
**Status:** ✅ Completo
**Descrição:** Item na loja; sem eles na chuva, score sofre penalidade pesada (-40%).
**Critério:** Penalidade aplicada apenas quando combinado chuva + sem pneus adequados.

### F4.4 — Campeonato
**Status:** ✅ Completo
**Descrição:** Temporada com N corridas, pontuação acumulada, campeão no final.
**Critério:** Múltiplas corridas acumulam pontos, campeão é coroado.

### F4.5 — Salvos Múltiplos
**Status:** ✅ Completo
**Descrição:** Suporte a múltiplos save slots.
**Critério:** Jogador pode criar, carregar e deletar saves.

---

## Fase 5: Overhaul Visual do HTML

### F5.1 — Fontes Premium e Tema Escuro Refinado
**Status:** ✅ Completo
**Descrição:** Importar Google Fonts (Orbitron para títulos, Rajdhani para corpo), variáveis CSS, reset, tema escuro com glassmorphism, sombras, bordas sutis.
**Critério:** Tema aplicado com aparência premium igual ao melhorjogo.html.

### F5.2 — Sistema de Animações Globais
**Status:** ✅ Completo
**Descrição:** Animações CSS: shimmer, confetti, fadeIn, toastIn/Out, pulse, slide. Sistema de toasts e modal reutilizável.
**Critério:** Animações funcionais em todos os componentes que as utilizam.

### F5.3 — Dashboard com Barras de Progresso
**Status:** ✅ Completo
**Descrição:** Cards com glassmorphism, barras de progresso com gradientes nos stats do carro e piloto, saldo com animação de contagem.
**Critério:** Dashboard visualmente igual ao padrão do melhorjogo.html.

### F5.4 — Garagem com Visual de Peças
**Status:** ✅ Completo
**Descrição:** Visual de peças com níveis exibidos em barras, botões de upgrade/reparo com feedback visual (toast de confirmação).
**Critério:** Aba Garagem funcional com feedback animado.

### F5.5 — Tela de Corrida com Log Animado e Pódio
**Status:** ✅ Completo
**Descrição:** Tela de pré-corrida com clima visual, log animado de eventos em tempo real com rolagem automática, pódio visual (1º/2º/3º com troféus e cores dourado/prata/bronze) no resultado.
**Critério:** Corrida executada com animações, pódio exibido ao final.

### F5.6 — Campeonato com Classificação Visual
**Status:** ✅ Completo
**Descrição:** Tabela de classificação com destaque no líder, calendário visual com pistas e resultados por etapa.
**Critério:** Aba Campeonato com layout informativo e visual.

### F5.7 — Patrocinadores e Salvos Refinados
**Status:** ✅ Completo
**Descrição:** Cards de contratos com status visual (ativo/inativo), grid de slots de save com preview e botões estilizados.
**Critério:** Abas Patrocinadores e Salvos visualmente consistentes com o resto.

---

## Fase 6: Múltiplos Pilotos & Contratação

### F6.1 — Model DriverExpanded
**Status:** ✅ Completo
**Descrição:** Estender modelo de piloto com atributos: salário, idade, contrato (data_inicio, data_fim), moral, estatísticas detalhadas (experiencia em pista molhada, consistencia, adaptabilidade).
**Critério:** Banco com colunas expandidas, migração sem quebrar saves existentes.

### F6.2 — Mercado de Pilotos
**Status:** ✅ Completo
**Descrição:** API endpoint `GET /market/drivers` retorna lista de pilotos disponíveis para contratação com stats e salário.
**Critério:** Pilotos NPC disponíveis no mercado com valores realistas.

### F6.3 — Contratação e Demissão
**Status:** ✅ Completo
**Descrição:** Endpoints `POST /team/hire` e `POST /team/fire`. Contratação custa taxa de transferência, demissão paga multa.
**Critério:** Time pode ter múltiplos pilotos, contratação/demissão reflete no banco e dinheiro.

### F6.4 — Troca de Piloto para Corrida
**Status:** ✅ Completo
**Descrição:** Selecionar qual piloto do time corre cada etapa. Pilotos não usados descansam e podem recuperar moral.
**Critério:** Corrida usa piloto selecionado, moral afeta performance.

### F6.5 — UI de Gerenciamento de Pilotos
**Status:** ✅ Completo
**Descrição:** Aba no frontend para listar pilotos do time, ver stats, contratar/demitir, selecionar para corrida.
**Critério:** Interface funcional conectada à API.

---

## Fase 7: Múltiplos Carros & Loja de Carros

### F7.1 — Model Car com Tiers
**Status:** ✅ Completo
**Descrição:** Estender Car com atributo `tier` (D, C, B, A, S, SS) e `preco`. Cada tier define nivel_base para as partes.
**Critério:** Carro com tier definido, preço compatível com o tier.

### F7.2 — Loja de Carros
**Status:** ✅ Completo
**Descrição:** API `GET /shop/cars` lista carros disponíveis, `POST /shop/buy-car` compra. Time pode ter múltiplos carros.
**Critério:** Compra de carro debita dinheiro e adiciona à garagem do time.

### F7.3 — Troca e Venda de Carros
**Status:** ✅ Completo
**Descrição:** Endpoints `POST /team/select-car` e `POST /team/sell-car`. Seleciona qual carro usar na próxima corrida; venda retorna porcentagem do valor.
**Critério:** Troca de carro funcional, venda com valor de revenda.

### F7.4 — UI Garagem com Grid de Carros
**Status:** ✅ Completo
**Descrição:** Aba Garagem mostra grid de carros do time com tier, stats, botões de selecionar/vender. Loja de carros com cards de compra.
**Critério:** Interface completa com navegação entre carros.

---

## Fase 8: Sistema de Upgrades em Árvore

### F8.1 — Tabela de Upgrades
**Status:** ✅ Completo
**Descrição:** Tabela `upgrade` com colunas: id, nome, descricao, tipo (motor/aero/pneu), nivel_requerido, preco, bonus_atributo, upgrade_requerido_id (FK para si mesma).
**Critério:** Schema criado, upgrades definidos para 3+ níveis por tipo.

### F8.2 — API de Upgrades
**Status:** ✅ Completo
**Descrição:** `GET /shop/upgrades` lista upgrades disponíveis, `POST /shop/buy-upgrade` compra e aplica. Valida pré-requisitos (nível mínimo da parte, upgrade anterior).
**Critério:** Compra de upgrade respeita árvore de pré-requisitos.

### F8.3 — Visual de Árvore no Frontend
**Status:** ✅ Completo
**Descrição:** Interface gráfica de árvore de upgrades com nós, conexões, destaque para disponíveis vs bloqueados.
**Critério:** Árvore visual funcional e intuitiva.

---

## Fase 9: Export/Import, Rivals e Dificuldade

### F9.1 — Export/Import Save JSON
**Status:** ✅ Completo
**Descrição:** Endpoints `GET /save/export` retorna JSON completo do save, `POST /save/import` recebe JSON e recria estado. Botões na UI de Salvos.
**Critério:** Export gera JSON válido, import restaura estado exato.

### F9.2 — Rival Teams
**Status:** ✅ Completo
**Descrição:** 3-5 times rivais fixos que evoluem junto com o jogador (upgrades automáticos, pilotos melhoram). Exibidos na classificação do campeonato.
**Critério:** Rivais aparecem no grid, evoluem ao longo da temporada, são competitivos.

### F9.3 — Sistema de Dificuldade
**Status:** ✅ Completo
**Descrição:** Atributo `dificuldade` no save (facil, medio, dificil). Afeta: premiação, custos, taxa de evolução dos rivais, fator de sorte no cálculo de score.
**Critério:** Dificuldade configurável no início do save, impacta jogabilidade.

### F9.4 — UI de Dificuldade e Seleção de Save
**Status:** ✅ Completo
**Descrição:** Tela inicial com seleção de dificuldade ao criar save. Indicador de dificuldade nos cards de save.
**Critério:** Fluxo completo de criação de save com escolha de dificuldade.

---

## Fase 10: Testes Finais e Polimento

### F10.1 — Testes das Novas Features
**Status:** ✅ Completo
**Descrição:** Testes unitários e de integração para todas as fases 5-9. Mínimo 10 novos testes.
**Critério:** `pytest tests/` passa com todos os testes antigos + novos (49 total).

### F10.2 — Responsividade Mobile
**Status:** ✅ Completo
**Descrição:** Ajustar CSS do template HTML para funcionar bem em mobile (breakpoints, font-size, touch targets).
**Critério:** Interface utilizável em viewport de 360px de largura.

### F10.3 — Performance e SEO
**Status:** ✅ Completo
**Descrição:** Minificar CSS/JS se aplicável, lazy loading, meta tags, favicon.
**Critério:** Lighthouse score > 80 em desktop.

---

## Fase 11: Aprimoramentos do Frontend (melhorjogo.html)

### F11.1 — Histórico de Corridas
**Status:** ✅ Completo
**Descrição:** Nova aba "📜 Histórico" no frontend que lista todas as corridas passadas com: posição final, nome da pista + país, clima, prêmio recebido, pontuação do campeonato. Dados vindos da tabela `race_result`. Também expor endpoint `GET /api/race/history` no backend retornando `raceHistory` completo.
**Critério:** Aba Histórico funcional, exibe lista cronológica de corridas realizadas.

### F11.2 — Season Banner no Dashboard
**Status:** ✅ Completo
**Descrição:** Banner no topo do dashboard (`view-dashboard`) com: nome da temporada atual, próxima corrida (nome da pista + bandeira do país), ícone e nome do clima, número de voltas. Similar ao `.season-banner` do `melhorjogo.html`. Dados via `GET /api/status` ou `GET /api/championship`.
**Critério:** Banner exibido no dashboard com informações da corrida atual/next race.

### F11.3 — 5 Tipos de Clima (Nublado + Chuvisco)
**Status:** ✅ Completo
**Descrição:** Expandir o sistema de clima de 3 para 5 tipos: Ensolarado (50%), Nublado (20%), Chuvisco (12%), Chuva (12%), Tempestade (6%). Cada clima com `wetMultiplier`: 0 / 0.1 / 0.4 / 0.7 / 1.0 afetando o score. Atualizar `backend/engine/power_score.py` (função `sortear_clima`), frontend e ícones CSS.
**Critério:** 5 climas sorteados com pesos corretos, wetMultiplier aplicado na simulação.

### F11.4 — Aba de Manutenção Separada
**Status:** ✅ Completo
**Descrição:** Separar manutenção da aba Garagem em aba própria "🔧 Manutenção". Exibir ações individuais: Troca de Óleo ($500, +8% dur), Trocar Pneus ($1200, +12%), Revisar Freios ($800, +10%), Revisão do Motor ($2000, +20%), Manutenção Completa ($4000, +50%), Repintura ($600, +3%). Cada ação debita dinheiro e recupera durabilidade. Manter reparo rápido na garagem.
**Critério:** Aba Manutenção com ações individuais funcionais, cada uma com custo e ganho corretos.

### F11.5 — Efeito Shimmer nas Barras de Progresso
**Status:** ✅ Completo
**Descrição:** Animação `shimmer` (brilho percorrendo a barra) via `::after` com `linear-gradient` já implementada em F5.2.
**Critério:** Já implementado — shimmer visível em todas as progress bars.

### F11.6 — Pódio com Alturas Diferentes
**Status:** ✅ Completo
**Descrição:** Pódio visual com 1º (180px/dourado), 2º (140px/prata), 3º (110px/bronze) com troféus e nomes dos pilotos. Já implementado em F5.5.
**Critério:** Já implementado — pódio exibido ao final de cada corrida.

### F11.7 — 4 Stats de Piloto no Card
**Status:** ✅ Completo
**Descrição:** Card do piloto no dashboard e na aba Pilotos deve mostrar 4 stats individuais: VEL (velocidade), CONS (consistência), CHUVA (experiência em pista molhada), RACE (racecraft) com barras de progresso e valores. Dados do modelo `Driver` expandido (F6.1) que já tem `experiencia_pista_molhada`, `consistencia`, `adaptabilidade`.
**Critério:** Card de piloto exibe 4 stats com barras de progresso individuais.

### F11.8 — Setup Inicial com Seleção de Dificuldade
**Status:** ✅ Completo
**Descrição:** Tela inicial (antes do dashboard) com: input para nome da equipe, seleção visual de dificuldade (cards Fácil/Normal/Difícil com ícones 🟢🟡🔴 e descrições), botão "Iniciar Carreira". Ao iniciar, criar save com a dificuldade escolhida. Opção de carregar save existente via JSON. Similar à `page-setup` do `melhorjogo.html`.
**Critério:** Fluxo de setup inicial funcional: escolher nome + dificuldade → iniciar jogo → redirecionar ao dashboard.

### F11.9 — Standings com Nomes de Pilotos Rivais
**Status:** ✅ Completo
**Descrição:** Tabela de classificação do campeonato deve exibir nome do piloto junto com o nome da equipe rival. Atualmente rivais têm `driverName` aleatório; melhorar para usar nomes reais de pilotos F1 (Hamilton, Verstappen, Leclerc, Norris, Alonso, etc.) persistidos por temporada. Um piloto NPC fixo por equipe rival.
**Critério:** Standings exibem "Equipe — Piloto", rivais com nomes reconhecíveis e consistentes.
