# Correções Realizadas na IA dos Carros

## 🔴 Problema Principal: Carros Parados no Início

### Causa Raiz
No arquivo `js/ai.js`, o código acessava `action[0]` e `action[1]`, mas o método `selectAction()` do `rl-agent.js` retorna um **objeto** `{steering, throttle}`, não um array.

```javascript
// ❌ ANTES (quebrado)
const steerVal = (action[0] * 2 - 1) * CFG.maxSteer;  // action[0] = undefined → NaN
const throttle = action[1];                             // action[1] = undefined → NaN
```

### Correção Aplicada
```javascript
// ✅ DEPOIS (funciona)
const steerVal = action.steering * CFG.maxSteer;
const throttle = Math.max(0, Math.min(1, action.throttle));
```

---

## 🟡 Problema Secundário: Sistema de Recompensa Fraco

### Recompensas Antigas
- `progressGain * 100` → valor muito pequeno (progress é 0-1 por volta)
- `speedMs * 0.1` → bônus insignificante
- Sem penalidade por ficar parado
- Sem recompensa por estar alinhado com a pista

### Novo Sistema de Recompensa
```javascript
// Progresso na pista (incentivo principal)
reward += progressGain * 5000;  // 50x mais forte

// Bônus por completar volta
if (v.lap > (v.lastLap || 0)) reward += 2000;  // 4x mais forte

// Velocidade (encoraja movimento)
reward += speedKmh * 0.5;  // 5x mais forte

// Penalidade pesada por ficar parado
if (speedKmh < 3) reward -= 20;
else if (speedKmh < 10) reward -= 5;

// Bônus por alinhamento com a pista
reward += alignment * 5;

// Bônus/penalidade por posição na pista
if (distFromTrack < trackHalf) reward += 2;      // na pista
else if (distFromTrack < trackWidth) reward -= 3; // borda
else reward -= 15;                                 // fora da pista

// Penalidade por movimento reverso
if (progressGain < -0.005) reward -= 30;
```

---

## 🟢 Problema Terciário: Exploração Aleatória Ruim

### Antes
- Epsilon começava em 1.0 (100% aleatório)
- 20% de chance de throttle = 0 na exploração aleatória
- Carros ficavam parados com frequência

### Depois
- Epsilon começa em **0.6** (60% aleatório, 40% aprendido)
- **70% de chance** de throttle ≥ 0.5 na exploração
- Throttle mínimo de **0.25** ao explorar política aprendida
- Detecção de travamento funciona desde o início (não depende de `prevSpeed > 5`)

```javascript
// Exploração enviesada
if (Math.random() < 0.7) {
  // 70% das vezes: throttle alto [0.5, 0.75, 1.0]
  throttleIdx = 2 + Math.floor(Math.random() * 3);
} else {
  throttleIdx = Math.floor(Math.random() * this.throttleActions.length);
}

// Política aprendida: throttle mínimo garantido
if (throttle < 0.25) throttle = 0.25;
```

---

## 💾 Persistência de Pesos (WebStorage)

### Sistema de Salvamento
Os pesos da rede neural são salvos automaticamente no **localStorage** do navegador:

1. **Salvamento periódico**: a cada 1000 frames (≈16 segundos)
2. **Salvamento ao sair**: evento `beforeunload`
3. **Salvamento ao mudar de aba**: evento `visibilitychange`
4. **Salvamento ao finalizar corrida**: em `finishRace()`

### Estrutura dos Dados Salvos
```javascript
{
  version: 2,
  qNetwork: {
    inputSize: 12,
    hiddenSizes: [32, 24, 16],
    outputSize: 2,
    weights: [...],  // 1642 parâmetros
    biases: [...]
  },
  epsilon: 0.6,
  trainSteps: 12345,
  episodeRewards: [...],
  losses: [...],
  avgReward: 123.45,
  hyperparams: {...},
  savedAt: 1234567890
}
```

### Recuperação Automática
Ao iniciar o jogo, se houver pesos salvos, eles são carregados automaticamente:
```javascript
const loaded = RLAgent.load('car-ai-agent');
if (loaded) {
  setRlAgent(loaded);
  console.log(`[AI] Loaded saved agent — ε=${loaded.epsilon.toFixed(3)}`);
}
```

---

## 🎮 Novos Controles no Menu

### Checkbox "IA Neural (aprende)"
- Permite ativar/desativar a IA neural
- Quando desativado, usa a IA baseada em regras (mais previsível)

### Botão "Resetar pesos da IA"
- Apaga os pesos salvos no localStorage
- Útil se a IA aprendeu comportamentos ruins
- Mostra status: "✓ Pesos apagados!" ou "💾 12345 passos (8.5 KB)"

---

## 📊 Melhorias no Treinamento

### Método de Treinamento Antigo (DQN Quebrado)
```javascript
// Tentava usar Q-values para ações discretas
const maxNextQ = Math.max(nextOutput[0], nextOutput[1]);
target = exp.reward + this.gamma * maxNextQ;  // reward pode ser 5000!
// Mas outputs são [-1,1] e [0,1] → target não faz sentido
```

### Novo Método (REINFORCE-style)
```javascript
// Normaliza reward para [-1, 1]
const normalizedReward = Math.tanh(exp.reward * 0.001);

// Reforça a ação tomada baseada no resultado
const reinforceStrength = Math.min(1, Math.abs(normalizedReward)) * Math.sign(normalizedReward);
const alpha = 0.3;

// Move output em direção à ação tomada se reward > 0
const targetSteering = currentOutput[0] + alpha * reinforceStrength * (takenSteering - currentOutput[0]);
const targetThrottle = currentOutput[1] + alpha * reinforceStrength * (takenThrottle - currentOutput[1]);
```

---

## ⚙️ Hiperparâmetros Otimizados

| Parâmetro | Antes | Depois | Motivo |
|-----------|-------|--------|--------|
| `epsilon` | 1.0 | 0.6 | Menos exploração aleatória inicial |
| `epsilonMin` | 0.01 | 0.05 | Mantém alguma exploração |
| `epsilonDecay` | 0.9995 | 0.9997 | Decay mais lento |
| `learningRate` | 0.001 | 0.003 | Aprendizado mais rápido |
| `gamma` | 0.99 | 0.95 | Menos foco em futuro distante |
| `batchSize` | 64 | 64 | Mantido |
| `bufferSize` | 100000 | 50000 | Menos memória, suficiente |
| Save interval | 3000 frames | 1000 frames | Salvamento mais frequente |

---

## 🔧 Detecção de Travamento Melhorada

### Antes
```javascript
// Só resetava se prevSpeed > 5 (nunca verdade no início)
else if (v.aiState.stuckTimer > 2.5 && speedMs < 1.5 && v.aiState.prevSpeed > 5) {
  resetVehicle(v, false);
}
```

### Depois
```javascript
// Reset após 4 segundos com velocidade < 2.0 (funciona sempre)
else if (v.aiState.stuckTimer > 4.0 && speedMs < 2.0) {
  const badReward = -200;
  rlAgent.remember(state, action, badReward, collectCarState(v), true);
  resetVehicle(v, false);
}
```

---

## 📝 Resumo das Mudanças

### Arquivos Modificados
1. **`js/ai.js`**
   - Corrigido acesso a `action.steering` e `action.throttle`
   - Recompensa completamente reescrita
   - Detecção de travamento melhorada
   - Inicialização com hiperparâmetros otimizados
   - Adicionados event listeners para salvar ao sair

2. **`rl-agent.js`**
   - Exploração aleatória enviesada para throttle > 0
   - Throttle mínimo de 0.25 na política aprendida
   - Método de treinamento reescrito (REINFORCE-style)
   - Save/load com tratamento de erros robusto
   - Validação de dados carregados

3. **`index.html`**
   - Adicionado checkbox "IA Neural (aprende)"
   - Adicionado botão "Resetar pesos da IA"
   - Status showing saved data info

4. **`style.css`**
   - Estilos para `.menu-ai-actions`
   - Estilos para `.ai-reset` button
   - Estilos para `.ai-status-text`

5. **`main.js`**
   - Handler para checkbox de IA neural
   - Handler para botão de reset
   - Display de status dos pesos salvos

---

## 🚀 Como Testar

1. **Iniciar servidor local**:
   ```bash
   cd carammo
   python3 -m http.server 8000
   ```

2. **Abrir no navegador**:
   ```
   http://localhost:8000
   ```

3. **Verificar no console**:
   - `[AI] Created new agent with improved exploration`
   - `[AI] Saved agent (X.X KB, ε=0.XXX)` a cada ~16 segundos

4. **Observar comportamento**:
   - Carros devem começar a se mover imediatamente
   - Exploração inicial com movimentos variados mas sempre acelerando
   - Após várias corridas, carros devem melhorar (menos travamentos)

5. **Verificar localStorage**:
   ```javascript
   // No console do navegador:
   localStorage.getItem('car-ai-agent')
   ```

---

## 🎯 Resultado Esperado

- ✅ Carros se movem desde o primeiro frame
- ✅ Exploração variada mas sempre com aceleração
- ✅ Aprendizado progressivo ao longo das corridas
- ✅ Pesos salvos automaticamente (persistem entre sessões)
- ✅ Recuperação automática de travamentos
- ✅ Opção de resetar IA se necessário
