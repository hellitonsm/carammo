/**
 * RL Agent with DQN (Deep Q-Network) for Car AI
 * Uses Replay Buffer, Target Network, and Epsilon-Greedy exploration
 */

class ReplayBuffer {
  constructor(maxSize = 100000) {
    this.maxSize = maxSize;
    this.buffer = [];
    this.position = 0;
  }
  
  push(state, action, reward, nextState, done) {
    const experience = { state, action, reward, nextState, done };
    
    if (this.buffer.length < this.maxSize) {
      this.buffer.push(experience);
    } else {
      this.buffer[this.position] = experience;
    }
    
    this.position = (this.position + 1) % this.maxSize;
  }
  
  sample(batchSize) {
    const len = this.buffer.length;
    const n = Math.min(batchSize, len);
    const batch = new Array(n);
    for (let i = 0; i < n; i++) {
      batch[i] = this.buffer[(Math.random() * len) | 0];
    }
    return batch;
  }
  
  get length() {
    return this.buffer.length;
  }
  
  clear() {
    this.buffer = [];
    this.position = 0;
  }
}

class RLAgent {
  constructor(
    inputSize = 12,
    hiddenSizes = [32, 24, 16],
    outputSize = 2,
    options = {}
  ) {
    // Hyperparameters
    this.learningRate = options.learningRate || 0.001;
    this.gamma = options.gamma || 0.99;          // Discount factor
    this.epsilon = options.epsilon || 1.0;       // Exploration rate
    this.epsilonMin = options.epsilonMin || 0.01;
    this.epsilonDecay = options.epsilonDecay || 0.9995;
    this.batchSize = options.batchSize || 32;
    this.targetUpdateFreq = options.targetUpdateFreq || 500;
    
    // Networks
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes;
    this.outputSize = outputSize;
    
    this.qNetwork = new NeuralNetwork(inputSize, hiddenSizes, outputSize);
    this.targetNetwork = this.qNetwork.clone();
    
    // Replay buffer
    this.replayBuffer = new ReplayBuffer(options.bufferSize || 100000);
    
    // Training stats
    this.trainSteps = 0;
    this.episodeRewards = [];
    this.currentEpisodeReward = 0;
    this.losses = [];
    this.avgReward = 0;
    
    // Action discretization for steering
    this.steeringActions = [-1, -0.5, -0.25, 0, 0.25, 0.5, 1];
    this.throttleActions = [0, 0.25, 0.5, 0.75, 1.0];
  }
  
  // Select action using epsilon-greedy policy
  selectAction(state, explore = true) {
    if (explore && Math.random() < this.epsilon) {
      // Biased random: favor throttle > 0 so the car actually moves
      const steeringIdx = Math.floor(Math.random() * this.steeringActions.length);
      // 70% chance of picking throttle >= 0.5, 30% chance of any value
      let throttleIdx;
      if (Math.random() < 0.7) {
        // Pick from [0.5, 0.75, 1.0] (indices 2, 3, 4)
        throttleIdx = 2 + Math.floor(Math.random() * 3);
      } else {
        throttleIdx = Math.floor(Math.random() * this.throttleActions.length);
      }
      return {
        steering: this.steeringActions[steeringIdx],
        throttle: this.throttleActions[throttleIdx]
      };
    }
    
    // Greedy action from Q-network
    const output = this.qNetwork.predict(state);
    
    // Discretize continuous outputs
    const steering = this.discretize(output[0], this.steeringActions);
    // Ensure minimum throttle when exploiting learned policy
    let throttle = this.discretize(output[1], this.throttleActions);
    if (throttle < 0.25) throttle = 0.25; // minimum forward drive
    return { steering, throttle };
  }
  
  // Discretize continuous value to nearest action
  discretize(value, actions) {
    let closest = actions[0];
    let minDist = Math.abs(value - actions[0]);
    
    for (let i = 1; i < actions.length; i++) {
      const dist = Math.abs(value - actions[i]);
      if (dist < minDist) {
        minDist = dist;
        closest = actions[i];
      }
    }
    
    return closest;
  }
  
  // Store experience in replay buffer
  remember(state, action, reward, nextState, done) {
    this.replayBuffer.push(state, action, reward, nextState, done);
    this.currentEpisodeReward += reward;
    
    if (done) {
      this.episodeRewards.push(this.currentEpisodeReward);
      this.avgReward = this.episodeRewards.slice(-100).reduce((a, b) => a + b, 0) / 
                       Math.min(100, this.episodeRewards.length);
      this.currentEpisodeReward = 0;
    }
  }
  
  // Train on a batch of experiences
  train() {
    if (this.replayBuffer.length < this.batchSize) {
      return null;
    }
    
    const batch = this.replayBuffer.sample(this.batchSize);
    let totalLoss = 0;
    
    for (const exp of batch) {
      // Forward pass to get current prediction
      const currentOutput = this.qNetwork.predict(exp.state);
      
      // Normalize reward to [-1, 1] range for stable training
      const normalizedReward = Math.tanh(exp.reward * 0.001);
      
      // Target: reinforce the taken action weighted by how good the outcome was
      // If reward > 0 → push outputs closer to the taken action
      // If reward < 0 → push outputs away from the taken action
      const takenSteering = exp.action.steering;  // [-1, 1]
      const takenThrottle = exp.action.throttle;   // [0, 1]
      
      // Blend current prediction towards/away from taken action based on reward
      const reinforceStrength = Math.min(1, Math.abs(normalizedReward)) * Math.sign(normalizedReward);
      const alpha = 0.3; // how much to shift towards the "ideal" action
      
      const targetSteering = currentOutput[0] + alpha * reinforceStrength * (takenSteering - currentOutput[0]);
      const targetThrottle = currentOutput[1] + alpha * reinforceStrength * (takenThrottle - currentOutput[1]);
      
      // Clamp targets to valid ranges
      const targetVector = [
        Math.max(-1, Math.min(1, targetSteering)),
        Math.max(0, Math.min(1, targetThrottle))
      ];
      
      // If done with negative outcome, push throttle down (learn to avoid that state)
      if (exp.done && exp.reward < -50) {
        targetVector[1] = Math.max(0, currentOutput[1] - 0.3);
      }
      
      // Train the network
      const loss = this.qNetwork.trainSingle(targetVector, this.learningRate);
      totalLoss += loss;
    }
    
    // Update target network periodically
    this.trainSteps++;
    if (this.trainSteps % this.targetUpdateFreq === 0) {
      this.targetNetwork = this.qNetwork.clone();
    }
    
    // Decay epsilon
    this.epsilon = Math.max(this.epsilonMin, this.epsilon * this.epsilonDecay);
    
    const avgLoss = totalLoss / this.batchSize;
    this.losses.push(avgLoss);
    
    return avgLoss;
  }
  
  // Get training statistics
  getStats() {
    return {
      epsilon: this.epsilon,
      trainSteps: this.trainSteps,
      bufferSize: this.replayBuffer.length,
      avgReward: this.avgReward,
      totalEpisodes: this.episodeRewards.length,
      recentLosses: this.losses.slice(-100),
      avgLoss: this.losses.length > 0 
        ? this.losses.slice(-100).reduce((a, b) => a + b, 0) / Math.min(100, this.losses.length)
        : 0
    };
  }
  
  // Save agent state to localStorage
  save(name = 'car-ai-agent') {
    try {
      const data = {
        version: 2,
        qNetwork: this.qNetwork.toJSON(),
        epsilon: this.epsilon,
        trainSteps: this.trainSteps,
        episodeRewards: this.episodeRewards.slice(-500),
        losses: this.losses.slice(-500),
        avgReward: this.avgReward,
        hyperparams: {
          learningRate: this.learningRate,
          gamma: this.gamma,
          epsilonMin: this.epsilonMin,
          epsilonDecay: this.epsilonDecay,
          batchSize: this.batchSize,
          targetUpdateFreq: this.targetUpdateFreq
        },
        savedAt: Date.now()
      };
      const json = JSON.stringify(data);
      localStorage.setItem(name, json);
      console.log(`[AI] Saved agent (${(json.length / 1024).toFixed(1)} KB, ε=${this.epsilon.toFixed(3)})`);
      return json.length;
    } catch (e) {
      console.warn('[AI] Save failed:', e.message);
      // If storage is full, try clearing old data
      try {
        localStorage.removeItem(name);
        const data = {
          version: 2,
          qNetwork: this.qNetwork.toJSON(),
          epsilon: this.epsilon,
          trainSteps: this.trainSteps,
          episodeRewards: [],
          losses: [],
          avgReward: this.avgReward,
          hyperparams: {
            learningRate: this.learningRate,
            gamma: this.gamma,
            epsilonMin: this.epsilonMin,
            epsilonDecay: this.epsilonDecay,
            batchSize: this.batchSize,
            targetUpdateFreq: this.targetUpdateFreq
          },
          savedAt: Date.now()
        };
        const json = JSON.stringify(data);
        localStorage.setItem(name, json);
        return json.length;
      } catch (e2) {
        console.error('[AI] Save failed even after cleanup:', e2.message);
        return 0;
      }
    }
  }
  
  // Load agent state from localStorage
  static load(name = 'car-ai-agent') {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      
      const data = JSON.parse(raw);
      
      // Validate data structure
      if (!data.qNetwork || !data.qNetwork.weights) {
        console.warn('[AI] Invalid saved data, starting fresh');
        return null;
      }
      
      const agent = new RLAgent(
        data.qNetwork.inputSize,
        data.qNetwork.hiddenSizes,
        data.qNetwork.outputSize
      );
      agent.qNetwork = NeuralNetwork.fromJSON(data.qNetwork);
      agent.targetNetwork = agent.qNetwork.clone();
      agent.epsilon = data.epsilon != null ? data.epsilon : 0.5;
      agent.trainSteps = data.trainSteps || 0;
      agent.episodeRewards = data.episodeRewards || [];
      agent.losses = data.losses || [];
      agent.avgReward = data.avgReward || 0;
      
      if (data.hyperparams) {
        Object.assign(agent, data.hyperparams);
      }
      
      console.log(`[AI] Loaded agent v${data.version || 1}, ${agent.trainSteps} training steps`);
      return agent;
    } catch (e) {
      console.warn('[AI] Load failed:', e.message);
      return null;
    }
  }
  
  // Reset episode reward tracking
  resetEpisode() {
    this.currentEpisodeReward = 0;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { NeuralNetwork, RLAgent, ReplayBuffer };
}
