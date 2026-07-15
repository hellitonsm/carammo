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
    const batch = [];
    const indices = new Set();
    
    while (indices.size < Math.min(batchSize, this.buffer.length)) {
      indices.add(Math.floor(Math.random() * this.buffer.length));
    }
    
    for (const idx of indices) {
      batch.push(this.buffer[idx]);
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
    this.batchSize = options.batchSize || 64;
    this.targetUpdateFreq = options.targetUpdateFreq || 1000;
    
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
      // Random action
      const steeringIdx = Math.floor(Math.random() * this.steeringActions.length);
      const throttleIdx = Math.floor(Math.random() * this.throttleActions.length);
      return {
        steering: this.steeringActions[steeringIdx],
        throttle: this.throttleActions[throttleIdx]
      };
    }
    
    // Greedy action from Q-network
    const output = this.qNetwork.predict(state);
    
    // Discretize continuous outputs
    const steering = this.discretize(output[0], this.steeringActions);
    const throttle = this.discretize(output[1], this.throttleActions);
    
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
      // Current Q-values
      const currentOutput = this.qNetwork.predict(exp.state);
      
      // Target Q-values
      let target;
      if (exp.done) {
        target = exp.reward;
      } else {
        const nextOutput = this.targetNetwork.predict(exp.nextState);
        const maxNextQ = Math.max(nextOutput[0], nextOutput[1]);
        target = exp.reward + this.gamma * maxNextQ;
      }
      
      // Create target vector (only update the taken action's Q-value)
      const targetVector = currentOutput.slice();
      const steeringIdx = this.steeringActions.indexOf(exp.action.steering);
      const throttleIdx = this.throttleActions.indexOf(exp.action.throttle);
      
      // Update Q-value for the taken action
      if (steeringIdx !== -1) {
        targetVector[0] = target;
      }
      if (throttleIdx !== -1) {
        targetVector[1] = target;
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
  
  // Save agent state
  save(name = 'car-ai-agent') {
    const data = {
      qNetwork: this.qNetwork.toJSON(),
      epsilon: this.epsilon,
      trainSteps: this.trainSteps,
      episodeRewards: this.episodeRewards.slice(-1000),
      losses: this.losses.slice(-1000),
      hyperparams: {
        learningRate: this.learningRate,
        gamma: this.gamma,
        epsilonMin: this.epsilonMin,
        epsilonDecay: this.epsilonDecay,
        batchSize: this.batchSize,
        targetUpdateFreq: this.targetUpdateFreq
      }
    };
    localStorage.setItem(name, JSON.stringify(data));
    return JSON.stringify(data).length;
  }
  
  // Load agent state
  static load(name = 'car-ai-agent') {
    const raw = localStorage.getItem(name);
    if (!raw) return null;
    
    const data = JSON.parse(raw);
    const agent = new RLAgent(data.qNetwork.inputSize, data.qNetwork.hiddenSizes, data.qNetwork.outputSize);
    agent.qNetwork = NeuralNetwork.fromJSON(data.qNetwork);
    agent.targetNetwork = agent.qNetwork.clone();
    agent.epsilon = data.epsilon;
    agent.trainSteps = data.trainSteps;
    agent.episodeRewards = data.episodeRewards || [];
    agent.losses = data.losses || [];
    
    if (data.hyperparams) {
      Object.assign(agent, data.hyperparams);
    }
    
    return agent;
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
