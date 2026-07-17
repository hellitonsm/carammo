/**
 * Pure JS neural network using Float64Array storage with RMSProp Optimizer.
 * Architecture: input 12 → hidden [32, 24, 16] → output 2
 */
class NeuralNetwork {
  constructor(inputSize = 12, hiddenSizes = [32, 24, 16], outputSize = 2) {
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes.slice();
    this.outputSize = outputSize;
    this.layerSizes = [inputSize, ...hiddenSizes, outputSize];
    this.numLayers = this.layerSizes.length - 1;

    this.weights = [];
    this.biases = [];
    this._activations = [];
    this._preActivations = [];

    // RMSProp cache
    this._vWeights = [];
    this._vBiases = [];

    for (let i = 0; i < this.numLayers; i++) {
      const rows = this.layerSizes[i + 1];
      const cols = this.layerSizes[i];
      const scale = Math.sqrt(2 / cols); // He init
      const w = new Float64Array(rows * cols);
      for (let j = 0; j < w.length; j++) w[j] = (Math.random() * 2 - 1) * scale;

      this.weights.push(w);
      this.biases.push(new Float64Array(rows));
      this._activations.push(new Float64Array(rows));
      this._preActivations.push(new Float64Array(rows));

      this._vWeights.push(new Float64Array(rows * cols));
      this._vBiases.push(new Float64Array(rows));
    }

    this._input = new Float64Array(inputSize);
    this._deltas = [];
    for (let i = 0; i < this.numLayers; i++) {
      this._deltas.push(new Float64Array(this.layerSizes[i + 1]));
    }
  }

  predict(input) {
    const inp = this._input;
    for (let i = 0; i < this.inputSize; i++) inp[i] = input[i] || 0;

    let prev = inp;
    let prevSize = this.inputSize;

    for (let L = 0; L < this.numLayers; L++) {
      const rows = this.layerSizes[L + 1];
      const cols = prevSize;
      const w = this.weights[L];
      const b = this.biases[L];
      const act = this._activations[L];
      const pre = this._preActivations[L];
      const isOutput = L === this.numLayers - 1;

      for (let r = 0; r < rows; r++) {
        let sum = b[r];
        const off = r * cols;
        for (let c = 0; c < cols; c++) sum += w[off + c] * prev[c];
        pre[r] = sum;
        if (isOutput) {
          if (r === 0) {
            act[r] = Math.tanh(sum); // steering
          } else {
            act[r] = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, sum)))); // throttle
          }
        } else {
          act[r] = sum > 0 ? sum : 0; // ReLU
        }
      }
      prev = act;
      prevSize = rows;
    }
    const out = this._activations[this.numLayers - 1];
    return [out[0], out[1]];
  }

  trainSingle(target, lr) {
    const last = this.numLayers - 1;
    const outAct = this._activations[last];
    const outDelta = this._deltas[last];

    const e0 = outAct[0] - target[0];
    outDelta[0] = e0 * (1 - outAct[0] * outAct[0]); // d/dx tanh

    const e1 = outAct[1] - target[1];
    outDelta[1] = e1 * outAct[1] * (1 - outAct[1]); // d/dx sigmoid

    const mse = (e0 * e0 + e1 * e1) / 2;

    // Backpropagation
    for (let L = last - 1; L >= 0; L--) {
      const rows = this.layerSizes[L + 1];
      const nextRows = this.layerSizes[L + 2];
      const nextW = this.weights[L + 1];
      const delta = this._deltas[L];
      const nextDelta = this._deltas[L + 1];
      const pre = this._preActivations[L];

      for (let r = 0; r < rows; r++) {
        let sum = 0;
        for (let nr = 0; nr < nextRows; nr++) {
          sum += nextW[nr * rows + r] * nextDelta[nr];
        }
        delta[r] = pre[r] > 0 ? sum : 0; // ReLU derivative
      }
    }

    // RMSProp optimizer
    const decay = 0.9;
    const eps = 1e-8;

    for (let L = 0; L < this.numLayers; L++) {
      const rows = this.layerSizes[L + 1];
      const cols = this.layerSizes[L];
      const w = this.weights[L];
      const b = this.biases[L];
      const delta = this._deltas[L];
      const prevAct = L === 0 ? this._input : this._activations[L - 1];

      const vW = this._vWeights[L];
      const vB = this._vBiases[L];

      for (let r = 0; r < rows; r++) {
        vB[r] = decay * vB[r] + (1 - decay) * delta[r] * delta[r];
        b[r] -= (lr / (Math.sqrt(vB[r]) + eps)) * delta[r];

        const off = r * cols;
        for (let c = 0; c < cols; c++) {
          const idx = off + c;
          const gradW = delta[r] * prevAct[c];
          vW[idx] = decay * vW[idx] + (1 - decay) * gradW * gradW;
          w[idx] -= (lr / (Math.sqrt(vW[idx]) + eps)) * gradW;
        }
      }
    }
    return mse;
  }

  clone() {
    const nn = new NeuralNetwork(this.inputSize, this.hiddenSizes, this.outputSize);
    for (let i = 0; i < this.numLayers; i++) {
      nn.weights[i].set(this.weights[i]);
      nn.biases[i].set(this.biases[i]);
    }
    return nn;
  }

  softUpdate(other, tau = 0.005) {
    for (let i = 0; i < this.numLayers; i++) {
      const w = this.weights[i];
      const ow = other.weights[i];
      const b = this.biases[i];
      const ob = other.biases[i];
      for (let j = 0; j < w.length; j++) w[j] = (1 - tau) * w[j] + tau * ow[j];
      for (let j = 0; j < b.length; j++) b[j] = (1 - tau) * b[j] + tau * ob[j];
    }
  }

  toJSON() {
    return {
      inputSize: this.inputSize,
      hiddenSizes: this.hiddenSizes,
      outputSize: this.outputSize,
      weights: this.weights.map((w) => Array.from(w)),
      biases: this.biases.map((b) => Array.from(b)),
    };
  }

  static fromJSON(data) {
    const nn = new NeuralNetwork(data.inputSize, data.hiddenSizes, data.outputSize);
    for (let i = 0; i < nn.numLayers; i++) {
      nn.weights[i].set(data.weights[i]);
      nn.biases[i].set(data.biases[i]);
    }
    return nn;
  }

  save(name) {
    try {
      localStorage.setItem(name, JSON.stringify(this.toJSON()));
      return true;
    } catch (e) {
      console.warn('NeuralNetwork.save failed', e);
      return false;
    }
  }

  static load(name) {
    try {
      const raw = localStorage.getItem(name);
      if (!raw) return null;
      return NeuralNetwork.fromJSON(JSON.parse(raw));
    } catch (e) {
      console.warn('NeuralNetwork.load failed', e);
      return null;
    }
  }
}

window.NeuralNetwork = NeuralNetwork;
