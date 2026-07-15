/**
 * Neural Network for Car AI - Pure JavaScript Implementation
 * Architecture: 3 hidden layers (32 → 24 → 16)
 * Inputs: 12 features (speed, track angle, distance to center, etc.)
 * Outputs: 2 actions (steering, throttle)
 */

class NeuralNetwork {
  constructor(inputSize = 12, hiddenSizes = [32, 24, 16], outputSize = 2) {
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes;
    this.outputSize = outputSize;
    
    // Initialize weights and biases
    this.weights = [];
    this.biases = [];
    
    // Layer sizes: [input, hidden1, hidden2, hidden3, output]
    const layerSizes = [inputSize, ...hiddenSizes, outputSize];
    
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const rows = layerSizes[i + 1];
      const cols = layerSizes[i];
      
      // He initialization for ReLU layers
      const scale = Math.sqrt(2.0 / cols);
      const weight = [];
      for (let r = 0; r < rows; r++) {
        weight[r] = [];
        for (let c = 0; c < cols; c++) {
          weight[r][c] = this.randn() * scale;
        }
      }
      this.weights.push(weight);
      
      const bias = new Array(rows).fill(0);
      this.biases.push(bias);
    }
    
    // Cache for backpropagation
    this.lastInputs = [];
    this.lastOutputs = [];
    this.lastActivations = [];
  }
  
  // Random normal distribution (Box-Muller)
  randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
  
  // Activation functions
  relu(x) {
    return Math.max(0, x);
  }
  
  reluDerivative(x) {
    return x > 0 ? 1 : 0;
  }
  
  tanh(x) {
    return Math.tanh(x);
  }
  
  tanhDerivative(x) {
    const t = Math.tanh(x);
    return 1 - t * t;
  }
  
  sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }
  
  sigmoidDerivative(x) {
    const s = this.sigmoid(x);
    return s * (1 - s);
  }
  
  // Forward pass
  predict(input) {
    if (input.length !== this.inputSize) {
      throw new Error(`Input size mismatch: expected ${this.inputSize}, got ${input.length}`);
    }
    
    this.lastInputs = [input.slice()];
    this.lastOutputs = [];
    this.lastActivations = [];
    
    let current = input.slice();
    
    // Hidden layers with ReLU
    for (let l = 0; l < this.weights.length - 1; l++) {
      const next = [];
      this.lastActivations.push([]);
      
      for (let i = 0; i < this.weights[l].length; i++) {
        let sum = this.biases[l][i];
        for (let j = 0; j < current.length; j++) {
          sum += this.weights[l][i][j] * current[j];
        }
        next.push(this.relu(sum));
        this.lastActivations[l].push(sum); // Pre-activation for derivative
      }
      
      this.lastOutputs.push(next.slice());
      this.lastInputs.push(next.slice());
      current = next;
    }
    
    // Output layer: tanh for steering, sigmoid for throttle
    const output = [];
    const outputActivations = [];
    const lastLayer = this.weights.length - 1;
    
    for (let i = 0; i < this.outputSize; i++) {
      let sum = this.biases[lastLayer][i];
      for (let j = 0; j < current.length; j++) {
        sum += this.weights[lastLayer][i][j] * current[j];
      }
      outputActivations.push(sum);
      
      if (i === 0) {
        // Steering: tanh → [-1, 1]
        output.push(this.tanh(sum));
      } else {
        // Throttle: sigmoid → [0, 1]
        output.push(this.sigmoid(sum));
      }
    }
    
    this.lastActivations.push(outputActivations);
    this.lastOutputs.push(output);
    
    return output;
  }
  
  // Train with a single sample (returns loss)
  trainSingle(target, learningRate = 0.001) {
    const output = this.lastOutputs[this.lastOutputs.length - 1];
    
    // Calculate output layer error
    const outputErrors = [];
    for (let i = 0; i < this.outputSize; i++) {
      const error = target[i] - output[i];
      outputErrors.push(error);
    }
    
    // Backpropagate through layers
    let deltas = [];
    
    // Output layer deltas
    const outputDeltas = [];
    for (let i = 0; i < this.outputSize; i++) {
      const act = this.lastActivations[this.lastActivations.length - 1][i];
      let deriv;
      if (i === 0) {
        deriv = this.tanhDerivative(act);
      } else {
        deriv = this.sigmoidDerivative(act);
      }
      outputDeltas.push(outputErrors[i] * deriv);
    }
    deltas.unshift(outputDeltas);
    
    // Hidden layer deltas (backwards)
    for (let l = this.weights.length - 2; l >= 0; l--) {
      const hiddenDeltas = [];
      for (let i = 0; i < this.weights[l].length; i++) {
        let error = 0;
        for (let j = 0; j < this.weights[l + 1].length; j++) {
          error += deltas[0][j] * this.weights[l + 1][j][i];
        }
        const deriv = this.reluDerivative(this.lastActivations[l][i]);
        hiddenDeltas.push(error * deriv);
      }
      deltas.unshift(hiddenDeltas);
    }
    
    // Update weights and biases
    let loss = 0;
    for (let l = 0; l < this.weights.length; l++) {
      for (let i = 0; i < this.weights[l].length; i++) {
        for (let j = 0; j < this.weights[l][i].length; j++) {
          this.weights[l][i][j] += learningRate * deltas[l][j] * this.lastInputs[l][j];
        }
        this.biases[l][i] += learningRate * deltas[l][i];
      }
    }
    
    // Calculate MSE loss
    for (let i = 0; i < this.outputSize; i++) {
      loss += outputErrors[i] * outputErrors[i];
    }
    return loss / this.outputSize;
  }
  
  // Clone the network (for target network in DQN)
  clone() {
    const copy = new NeuralNetwork(this.inputSize, this.hiddenSizes.slice(), this.outputSize);
    for (let l = 0; l < this.weights.length; l++) {
      for (let i = 0; i < this.weights[l].length; i++) {
        copy.weights[l][i] = this.weights[l][i].slice();
      }
      copy.biases[l] = this.biases[l].slice();
    }
    return copy;
  }
  
  // Soft update towards another network (for DQN target network)
  softUpdate(other, tau = 0.005) {
    for (let l = 0; l < this.weights.length; l++) {
      for (let i = 0; i < this.weights[l].length; i++) {
        for (let j = 0; j < this.weights[l][i].length; j++) {
          this.weights[l][i][j] = (1 - tau) * this.weights[l][i][j] + tau * other.weights[l][i][j];
        }
        this.biases[l][i] = (1 - tau) * this.biases[l][i] + tau * other.biases[l][i];
      }
    }
  }
  
  // Save weights to JSON
  toJSON() {
    return {
      inputSize: this.inputSize,
      hiddenSizes: this.hiddenSizes,
      outputSize: this.outputSize,
      weights: this.weights,
      biases: this.biases
    };
  }
  
  // Load weights from JSON
  static fromJSON(data) {
    const nn = new NeuralNetwork(data.inputSize, data.hiddenSizes, data.outputSize);
    nn.weights = data.weights;
    nn.biases = data.biases;
    return nn;
  }
  
  // Save to localStorage
  save(name = 'car-ai-network') {
    const data = JSON.stringify(this.toJSON());
    localStorage.setItem(name, data);
    return data.length;
  }
  
  // Load from localStorage
  static load(name = 'car-ai-network') {
    const data = localStorage.getItem(name);
    if (!data) return null;
    return NeuralNetwork.fromJSON(JSON.parse(data));
  }
  
  // Get total number of parameters
  getParamCount() {
    let count = 0;
    for (let l = 0; l < this.weights.length; l++) {
      for (let i = 0; i < this.weights[l].length; i++) {
        count += this.weights[l][i].length;
      }
      count += this.biases[l].length;
    }
    return count;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeuralNetwork;
}
