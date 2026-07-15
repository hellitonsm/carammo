/**
 * Pure JS neural network using Float64Array storage.
 * Architecture: input 12 → hidden [32, 24, 16] → output 2
 * Hidden: ReLU · Output: tanh (steering), sigmoid (throttle)
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
            // tanh for steering
            act[r] = Math.tanh(sum);
          } else {
            // sigmoid for throttle
            act[r] = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, sum))));
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
    // Forward already stored in _activations / _preActivations from last predict
    // Backprop
    const last = this.numLayers - 1;
    const outAct = this._activations[last];
    const outPre = this._preActivations[last];
    const outDelta = this._deltas[last];

    // Output deltas
    // steering (tanh): d/dx tanh = 1 - t^2
    const e0 = outAct[0] - target[0];
    outDelta[0] = e0 * (1 - outAct[0] * outAct[0]);
    // throttle (sigmoid): d/dx sig = s(1-s)
    const e1 = outAct[1] - target[1];
    outDelta[1] = e1 * outAct[1] * (1 - outAct[1]);

    const mse = (e0 * e0 + e1 * e1) / 2;

    // Hidden deltas (backwards)
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
        // ReLU derivative
        delta[r] = pre[r] > 0 ? sum : 0;
      }
    }

    // Update weights
    for (let L = 0; L < this.numLayers; L++) {
      const rows = this.layerSizes[L + 1];
      const cols = this.layerSizes[L];
      const w = this.weights[L];
      const b = this.biases[L];
      const delta = this._deltas[L];
      const prevAct = L === 0 ? this._input : this._activations[L - 1];

      for (let r = 0; r < rows; r++) {
        b[r] -= lr * delta[r];
        const off = r * cols;
        for (let c = 0; c < cols; c++) {
          w[off + c] -= lr * delta[r] * prevAct[c];
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
