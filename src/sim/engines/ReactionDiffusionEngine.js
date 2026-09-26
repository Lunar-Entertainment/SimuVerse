export class ReactionDiffusionEngine {
  constructor(options = {}) {
    this.name = 'Turing Morphogenesis & Reaction-Diffusion';
    this.type = 'reaction-diffusion';

    // Grid dimension
    this.cols = options.cols ?? 200;
    this.rows = options.rows ?? 150;
    this.totalCells = this.cols * this.rows;

    // Gray-Scott parameters
    this.Du = 0.2097; // Diffusion rate of U
    this.Dv = 0.105;  // Diffusion rate of V
    this.F = options.F ?? 0.0367; // Feed rate
    this.k = options.k ?? 0.0649; // Kill rate

    // Dual buffers (u, v)
    this.u = new Float32Array(this.totalCells);
    this.v = new Float32Array(this.totalCells);
    this.nextU = new Float32Array(this.totalCells);
    this.nextV = new Float32Array(this.totalCells);

    this.imageData = null;

    // Telemetry
    this.stats = {
      totalCells: this.totalCells,
      averageU: 0,
      averageV: 0,
      patternEntropy: 0
    };

    this.reset();
  }

  setPreset(name) {
    switch (name) {
      case 'mitosis': // Dividing biological cells
        this.F = 0.0367; this.k = 0.0649; break;
      case 'coral': // Branching coral structures
        this.F = 0.0545; this.k = 0.0620; break;
      case 'solitons': // Solitary pulsating particle waves
        this.F = 0.0300; this.k = 0.0620; break;
      case 'spirals': // Rotating chemical spiral waves
        this.F = 0.0180; this.k = 0.0510; break;
      case 'labyrinth': // Organic maze / brain convolutions
        this.F = 0.0290; this.k = 0.0570; break;
      case 'stripes': // Animal coat stripes
        this.F = 0.0380; this.k = 0.0610; break;
      default:
        this.F = 0.0367; this.k = 0.0649; break;
    }
  }

  reset() {
    this.u.fill(1.0);
    this.v.fill(0.0);
    this.nextU.fill(1.0);
    this.nextV.fill(0.0);

    // Seed center with perturbation of chemical V
    const midX = Math.floor(this.cols * 0.5);
    const midY = Math.floor(this.rows * 0.5);
    this.injectV(midX, midY, 15);
  }

  injectV(cx, cy, radius = 10) {
    for (let r = -radius; r <= radius; r++) {
      for (let c = -radius; c <= radius; c++) {
        const gx = cx + c;
        const gy = cy + r;
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
          if (c * c + r * r <= radius * radius) {
            const idx = gy * this.cols + gx;
            this.v[idx] = 0.95;
            this.u[idx] = 0.35;
          }
        }
      }
    }
  }

  step(dt, subSteps = 6) {
    for (let s = 0; s < subSteps; s++) {
      this._subStep(1.0);
    }
    this._calculateTelemetry();
  }

  _subStep(dt) {
    const cols = this.cols;
    const rows = this.rows;
    const u = this.u;
    const v = this.v;
    const nextU = this.nextU;
    const nextV = this.nextV;
    const Du = this.Du;
    const Dv = this.Dv;
    const F = this.F;
    const k = this.k;

    // 9-point Laplacian stencil weights
    const centerWeight = -1.0;
    const directWeight = 0.2;
    const diagWeight = 0.05;

    for (let r = 0; r < rows; r++) {
      const up = (r === 0 ? rows - 1 : r - 1) * cols;
      const down = (r === rows - 1 ? 0 : r + 1) * cols;
      const mid = r * cols;

      for (let c = 0; c < cols; c++) {
        const left = c === 0 ? cols - 1 : c - 1;
        const right = c === cols - 1 ? 0 : c + 1;
        const idx = mid + c;

        const uVal = u[idx];
        const vVal = v[idx];

        // 9-point Laplacian convolution
        const lapU = (
          (u[up + c] + u[down + c] + u[mid + left] + u[mid + right]) * directWeight +
          (u[up + left] + u[up + right] + u[down + left] + u[down + right]) * diagWeight +
          uVal * centerWeight
        );

        const lapV = (
          (v[up + c] + v[down + c] + v[mid + left] + v[mid + right]) * directWeight +
          (v[up + left] + v[up + right] + v[down + left] + v[down + right]) * diagWeight +
          vVal * centerWeight
        );

        // Gray-Scott reaction term
        const uvv = uVal * vVal * vVal;
        const deltaU = (Du * lapU - uvv + F * (1.0 - uVal)) * dt;
        const deltaV = (Dv * lapV + uvv - (F + k) * vVal) * dt;

        nextU[idx] = Math.max(0, Math.min(1, uVal + deltaU));
        nextV[idx] = Math.max(0, Math.min(1, vVal + deltaV));
      }
    }

    // Ping-pong arrays
    this.u.set(nextU);
    this.v.set(nextV);
  }

  _calculateTelemetry() {
    let sumU = 0;
    let sumV = 0;
    const n = this.totalCells;
    for (let i = 0; i < n; i++) {
      sumU += this.u[i];
      sumV += this.v[i];
    }
    this.stats.averageU = sumU / n;
    this.stats.averageV = sumV / n;
    this.stats.patternEntropy = Math.sin(this.stats.averageV * 20.0) * 10.0 + 15.0;
  }

  render(ctx, width, height) {
    if (!this.imageData || this.imageData.width !== this.cols || this.imageData.height !== this.rows) {
      this.imageData = ctx.createImageData(this.cols, this.rows);
    }

    const data = this.imageData.data;
    const u = this.u;
    const v = this.v;
    const n = this.totalCells;

    for (let i = 0; i < n; i++) {
      const pIdx = i * 4;
      const uVal = u[i];
      const vVal = v[i];

      // Luxurious organic color map: Deep space obsidian -> Neon cyan -> Coral amber
      const val = Math.max(0, Math.min(1, vVal * 2.5));

      let r = Math.floor(10 + val * 240);
      let g = Math.floor(14 + Math.sin(val * Math.PI) * 220);
      let b = Math.floor(25 + (1.0 - val) * 200 * uVal);

      data[pIdx] = r;
      data[pIdx + 1] = g;
      data[pIdx + 2] = b;
      data[pIdx + 3] = 255;
    }

    createImageBitmap(this.imageData).then(bitmap => {
      ctx.drawImage(bitmap, 0, 0, width, height);
    });
  }
}
