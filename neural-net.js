/**
 * Neural Network for Car AI — Optimized Pure JS Implementation
 * Uses pre-allocated typed arrays, inlined activations, flat weight storage
 * Architecture: 3 hidden layers (32 → 24 → 16)
 * Inputs: 12 features  |  Outputs: 2 actions (steering tanh, throttle sigmoid)
 */

class NeuralNetwork {
  constructor(inputSize = 12, hiddenSizes = [32, 24, 16], outputSize = 2) {
    this.inputSize = inputSize;
    this.hiddenSizes = hiddenSizes;
    this.outputSize = outputSize;

    const layerSizes = [inputSize, ...hiddenSizes, outputSize];
    this.layerSizes = layerSizes;
    this.numLayers = layerSizes.length - 1; // number of weight layers

    // Flat weight storage for cache-friendly access
    this.weights = [];   // weights[l] = flat Float64Array of rows*cols
    this.biases = [];    // biases[l] = Float64Array of rows
    this.shapes = [];    // {rows, cols} for each layer

    for (let l = 0; l < this.numLayers; l++) {
      const rows = layerSizes[l + 1];
      const cols = layerSizes[l];
      const scale = Math.sqrt(2.0 / cols); // He init
      const w = new Float64Array(rows * cols);
      for (let i = 0; i < w.length; i++) w[i] = NeuralNetwork._randn() * scale;
      this.weights.push(w);
      this.biases.push(new Float64Array(rows));
      this.shapes.push({ rows, cols });
    }

    // Pre-allocated buffers for forward/backward pass (avoid GC)
    this._layerOutputs = [];   // post-activation values per layer
    this._layerPreAct = [];    // pre-activation values per layer
    for (let l = 0; l < this.numLayers; l++) {
      this._layerOutputs.push(new Float64Array(layerSizes[l + 1]));
      this._layerPreAct.push(new Float64Array(layerSizes[l + 1]));
    }
    this._inputCopy = new Float64Array(inputSize);

    // Backward pass buffers
    this._deltas = [];
    for (let l = 0; l < this.numLayers; l++) {
      this._deltas.push(new Float64Array(layerSizes[l + 1]));
    }
  }

  static _randn() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(6.283185307179586 * v);
  }

  // ---- Forward pass (hot path, zero allocations) ----
  predict(input) {
    const { weights, biases, shapes, numLayers, _layerOutputs, _layerPreAct, _inputCopy } = this;

    // Copy input
    for (let i = 0; i < this.inputSize; i++) _inputCopy[i] = input[i];

    let prevOutput = _inputCopy;

    // Hidden layers: ReLU
    for (let l = 0; l < numLayers - 1; l++) {
      const { rows, cols } = shapes[l];
      const w = weights[l];
      const b = biases[l];
      const out = _layerOutputs[l];
      const pre = _layerPreAct[l];

      for (let i = 0; i < rows; i++) {
        let sum = b[i];
        const offset = i * cols;
        for (let j = 0; j < cols; j++) {
          sum += w[offset + j] * prevOutput[j];
        }
        pre[i] = sum;
        out[i] = sum > 0 ? sum : 0; // inline ReLU
      }
      prevOutput = out;
    }

    // Output layer: tanh for steering, sigmoid for throttle
    {
      const l = numLayers - 1;
      const { rows, cols } = shapes[l];
      const w = weights[l];
      const b = biases[l];
      const out = _layerOutputs[l];
      const pre = _layerPreAct[l];

      for (let i = 0; i < rows; i++) {
        let sum = b[i];
        const offset = i * cols;
        for (let j = 0; j < cols; j++) {
          sum += w[offset + j] * prevOutput[j];
        }
        pre[i] = sum;
        if (i === 0) {
          // tanh
          out[i] = Math.tanh(sum);
        } else {
          // sigmoid
          const x = sum > 500 ? 500 : sum < -500 ? -500 : sum;
          out[i] = 1 / (1 + Math.exp(-x));
        }
      }
    }

    // Return a simple array (small, 2 elements)
    const lastOut = _layerOutputs[numLayers - 1];
    return [lastOut[0], lastOut[1]];
  }

  // ---- Backward pass + weight update (hot path) ----
  trainSingle(target, learningRate = 0.001) {
    const { weights, biases, shapes, numLayers, _layerOutputs, _layerPreAct, _inputCopy, _deltas } = this;

    const lastOut = _layerOutputs[numLayers - 1];
    const lastPre = _layerPreAct[numLayers - 1];

    // Output errors
    const e0 = target[0] - lastOut[0];
    const e1 = target[1] - lastOut[1];

    // Output layer deltas (inline derivatives)
    const outDeltas = _deltas[numLayers - 1];
    {
      // tanh derivative: 1 - tanh²(x)
      const t = lastOut[0];
      outDeltas[0] = e0 * (1 - t * t);

      // sigmoid derivative: s * (1 - s)
      const s = lastOut[1];
      outDeltas[1] = e1 * s * (1 - s);
    }

    // Hidden layer deltas (backwards)
    for (let l = numLayers - 2; l >= 0; l--) {
      const { rows: nextRows } = shapes[l + 1];
      const { rows } = shapes[l];
      const wNext = weights[l + 1];
      const nextCols = shapes[l + 1].cols; // = rows of current layer
      const deltas = _deltas[l];
      const nextDeltas = _deltas[l + 1];
      const pre = _layerPreAct[l];

      for (let i = 0; i < rows; i++) {
        let error = 0;
        // Sum over next layer: delta_next[j] * w_next[j][i]
        for (let j = 0; j < nextRows; j++) {
          error += nextDeltas[j] * wNext[j * nextCols + i];
        }
        // ReLU derivative: 1 if pre > 0, else 0
        deltas[i] = pre[i] > 0 ? error : 0;
      }
    }

    // Weight update
    for (let l = 0; l < numLayers; l++) {
      const { rows, cols } = shapes[l];
      const w = weights[l];
      const b = biases[l];
      const deltas = _deltas[l];
      // Input to this layer is either _inputCopy or previous layer output
      const layerInput = l === 0 ? _inputCopy : _layerOutputs[l - 1];

      for (let i = 0; i < rows; i++) {
        const d = deltas[i] * learningRate;
        const offset = i * cols;
        for (let j = 0; j < cols; j++) {
          w[offset + j] += d * layerInput[j];
        }
        b[i] += d;
      }
    }

    // MSE loss
    return (e0 * e0 + e1 * e1) * 0.5;
  }

  // ---- Clone ----
  clone() {
    const copy = new NeuralNetwork(this.inputSize, this.hiddenSizes.slice(), this.outputSize);
    for (let l = 0; l < this.numLayers; l++) {
      copy.weights[l] = new Float64Array(this.weights[l]);
      copy.biases[l] = new Float64Array(this.biases[l]);
    }
    return copy;
  }

  // ---- Soft update ----
  softUpdate(other, tau = 0.005) {
    const oneMinusTau = 1 - tau;
    for (let l = 0; l < this.numLayers; l++) {
      const w = this.weights[l];
      const ow = other.weights[l];
      for (let i = 0; i < w.length; i++) {
        w[i] = oneMinusTau * w[i] + tau * ow[i];
      }
      const b = this.biases[l];
      const ob = other.biases[l];
      for (let i = 0; i < b.length; i++) {
        b[i] = oneMinusTau * b[i] + tau * ob[i];
      }
    }
  }

  // ---- Serialization (convert flat arrays to nested for JSON compatibility) ----
  toJSON() {
    const weightsNested = [];
    const biasesNested = [];
    for (let l = 0; l < this.numLayers; l++) {
      const { rows, cols } = this.shapes[l];
      const w = this.weights[l];
      const b = this.biases[l];
      const wArr = [];
      for (let i = 0; i < rows; i++) {
        const row = new Array(cols);
        const offset = i * cols;
        for (let j = 0; j < cols; j++) row[j] = w[offset + j];
        wArr.push(row);
      }
      weightsNested.push(wArr);
      biasesNested.push(Array.from(b));
    }
    return {
      inputSize: this.inputSize,
      hiddenSizes: this.hiddenSizes,
      outputSize: this.outputSize,
      weights: weightsNested,
      biases: biasesNested
    };
  }

  static fromJSON(data) {
    const nn = new NeuralNetwork(data.inputSize, data.hiddenSizes, data.outputSize);
    for (let l = 0; l < nn.numLayers; l++) {
      const { rows, cols } = nn.shapes[l];
      const wArr = data.weights[l];
      const w = nn.weights[l];
      for (let i = 0; i < rows; i++) {
        const offset = i * cols;
        const row = wArr[i];
        for (let j = 0; j < cols; j++) w[offset + j] = row[j];
      }
      const bArr = data.biases[l];
      const b = nn.biases[l];
      for (let i = 0; i < rows; i++) b[i] = bArr[i];
    }
    return nn;
  }

  save(name = 'car-ai-network') {
    const data = JSON.stringify(this.toJSON());
    localStorage.setItem(name, data);
    return data.length;
  }

  static load(name = 'car-ai-network') {
    const data = localStorage.getItem(name);
    if (!data) return null;
    return NeuralNetwork.fromJSON(JSON.parse(data));
  }

  getParamCount() {
    let count = 0;
    for (let l = 0; l < this.numLayers; l++) {
      count += this.weights[l].length + this.biases[l].length;
    }
    return count;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NeuralNetwork;
}
