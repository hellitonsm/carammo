/**
 * RL Agent with Gaussian noise exploration and baseline advantage.
 * Depends on global NeuralNetwork from neural-net.js
 */
class ReplayBuffer {
  constructor(maxSize = 30000) {
    this.maxSize = maxSize;
    this.buf = [];
    this.idx = 0;
  }

  push(state, action, reward, nextState, done) {
    const item = { state, action, reward, nextState, done };
    if (this.buf.length < this.maxSize) {
      this.buf.push(item);
    } else {
      this.buf[this.idx] = item;
    }
    this.idx = (this.idx + 1) % this.maxSize;
  }

  sample(batchSize) {
    const n = this.buf.length;
    const out = [];
    for (let i = 0; i < batchSize; i++) {
      out.push(this.buf[Math.floor(Math.random() * n)]);
    }
    return out;
  }

  get size() {
    return this.buf.length;
  }
}

class RLAgent {
  constructor(
    inputSize = 12,
    hiddenSizes = [32, 24, 16],
    outputSize = 2,
    options = {}
  ) {
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes;
    this.outputSize = outputSize;

    this.learningRate = options.learningRate ?? 0.0005;
    this.gamma = options.gamma ?? 0.98;
    this.epsilon = options.epsilon ?? 0.4;
    this.epsilonMin = options.epsilonMin ?? 0.02;
    this.epsilonDecay = options.epsilonDecay ?? 0.9995;
    this.batchSize = options.batchSize ?? 64;
    this.maxBufferSize = options.bufferSize ?? 30000;

    this.qNetwork = new NeuralNetwork(inputSize, hiddenSizes, outputSize);
    this.buffer = new ReplayBuffer(this.maxBufferSize);

    this.trainSteps = 0;
    this.episodeRewards = [];
    this.losses = [];
    this.avgReward = 0;

    // Running reward average for baseline advantage
    this.runningRewardAvg = 0;

    this.steeringActions = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1];
    this.throttleActions = [0, 0.25, 0.5, 0.75, 1.0];

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.save('car-ai-agent'));
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.save('car-ai-agent');
      });
    }
  }

  get bufferSize() {
    return this.buffer ? this.buffer.size : 0;
  }

  selectAction(state, explore = true) {
    const [rawSteer, rawThrottle] = this.qNetwork.predict(state);

    let steer = rawSteer;
    let throttle = rawThrottle;

    // Gaussian noise exploration (Box-Muller)
    if (explore && Math.random() < this.epsilon) {
      const u1 = Math.random() || 0.0001;
      const u2 = Math.random() || 0.0001;
      const noise = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

      steer += noise * 0.25;
      throttle += noise * 0.15;
    }

    steer = Math.max(-1, Math.min(1, steer));
    throttle = Math.max(0.1, Math.min(1, throttle));

    const finalSteer = this._nearest(this.steeringActions, steer);
    const finalThrottle = this._nearest(this.throttleActions, throttle);

    return { steering: finalSteer, throttle: finalThrottle };
  }

  _nearest(arr, val) {
    let best = arr[0];
    let bestD = Math.abs(val - best);
    for (let i = 1; i < arr.length; i++) {
      const d = Math.abs(val - arr[i]);
      if (d < bestD) {
        bestD = d;
        best = arr[i];
      }
    }
    return best;
  }

  remember(state, action, reward, nextState, done) {
    this.buffer.push(
      state.slice ? state.slice() : Array.from(state),
      { steering: action.steering, throttle: action.throttle },
      reward,
      nextState.slice ? nextState.slice() : Array.from(nextState),
      done
    );
  }

  train() {
    if (this.buffer.size < this.batchSize) return null;

    const batch = this.buffer.sample(this.batchSize);
    let totalLoss = 0;

    // Update running reward average for baseline
    let batchRewardSum = 0;
    for (const exp of batch) batchRewardSum += exp.reward;
    const batchRewardAvg = batchRewardSum / batch.length;
    this.runningRewardAvg = 0.98 * this.runningRewardAvg + 0.02 * batchRewardAvg;

    for (const exp of batch) {
      const currentOutput = this.qNetwork.predict(exp.state);

      // Advantage = reward - running baseline
      const advantage = exp.reward - this.runningRewardAvg;
      const scaledAdvantage = Math.tanh(advantage * 0.05);

      // Move network toward good actions, away from bad ones
      let targetSteering = currentOutput[0] + scaledAdvantage * (exp.action.steering - currentOutput[0]);
      let targetThrottle = currentOutput[1] + scaledAdvantage * (exp.action.throttle - currentOutput[1]);

      targetSteering = Math.max(-1, Math.min(1, targetSteering));
      targetThrottle = Math.max(0, Math.min(1, targetThrottle));

      if (exp.done && exp.reward < -50) {
        targetThrottle = Math.max(0, targetThrottle - 0.2);
      }

      const loss = this.qNetwork.trainSingle([targetSteering, targetThrottle], this.learningRate);
      totalLoss += loss;
    }

    this.trainSteps++;
    const avgLoss = totalLoss / batch.length;
    this.losses.push(avgLoss);
    if (this.losses.length > 500) this.losses.shift();

    this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    return avgLoss;
  }

  save(name = 'car-ai-agent') {
    try {
      const data = {
        version: 3,
        qNetwork: this.qNetwork.toJSON(),
        epsilon: this.epsilon,
        trainSteps: this.trainSteps,
        episodeRewards: this.episodeRewards.slice(-500),
        losses: this.losses.slice(-500),
        avgReward: this.avgReward,
        runningRewardAvg: this.runningRewardAvg,
        hyperparams: {
          learningRate: this.learningRate,
          gamma: this.gamma,
          epsilonMin: this.epsilonMin,
          epsilonDecay: this.epsilonDecay,
          batchSize: this.batchSize,
          bufferSize: this.maxBufferSize,
        },
        savedAt: Date.now(),
      };
      const str = JSON.stringify(data);
      try {
        localStorage.setItem(name, str);
      } catch (e) {
        try {
          localStorage.removeItem(name);
          localStorage.setItem(name, str);
        } catch (e2) {
          console.warn('RLAgent save quota exceeded', e2);
          return false;
        }
      }
      return true;
    } catch (e) {
      console.warn('RLAgent.save failed', e);
      return false;
    }
  }

  static load(name = 'car-ai-agent') {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data.qNetwork || !data.qNetwork.weights) return null;

      const agent = new RLAgent(
        data.qNetwork.inputSize || 12,
        data.qNetwork.hiddenSizes || [32, 24, 16],
        data.qNetwork.outputSize || 2,
        data.hyperparams || {}
      );
      agent.qNetwork = NeuralNetwork.fromJSON(data.qNetwork);
      agent.epsilon = data.epsilon ?? agent.epsilon;
      agent.trainSteps = data.trainSteps || 0;
      agent.episodeRewards = data.episodeRewards || [];
      agent.losses = data.losses || [];
      agent.avgReward = data.avgReward || 0;
      agent.runningRewardAvg = data.runningRewardAvg || 0;
      return agent;
    } catch (e) {
      console.warn('RLAgent.load failed', e);
      return null;
    }
  }

  get statusKB() {
    try {
      const raw = localStorage.getItem('car-ai-agent');
      return raw ? (raw.length / 1024).toFixed(1) : '0';
    } catch {
      return '0';
    }
  }
}

window.RLAgent = RLAgent;
window.RLAgentReplayBuffer = ReplayBuffer;
