export class WaveEquationEngine {
  constructor(options = {}) {
    this.name = 'FDTD Wave Optics & Acoustics';
    this.type = 'wave';

    // Grid dimensions
    this.cols = options.cols ?? 240;
    this.rows = options.rows ?? 180;
    this.totalCells = this.cols * this.rows;

    // Physical simulation parameters
    this.c0 = 1.0;            // Base wave speed
    this.damping = 0.002;     // Medium damping
    this.spongeWidth = 15;    // Absorbing boundary layer depth
    this.time = 0;

    // Grid buffers (Float32Array for high performance)
    this.uCurr = new Float32Array(this.totalCells); // u(t)
    this.uPrev = new Float32Array(this.totalCells); // u(t - dt)
    this.uNext = new Float32Array(this.totalCells); // u(t + dt)
    this.cMap = new Float32Array(this.totalCells);  // Wave speed map c(x,y)
    this.dampMap = new Float32Array(this.totalCells); // Damping map (including sponge layer)
    this.obstacles = new Uint8Array(this.totalCells); // 1 = rigid barrier / mirror

    // Active wave sources
    this.sources = [];

    // Pre-allocate ImageData buffer for fast pixel rendering
    this.imageData = null;

    // Telemetry
    this.stats = {
      totalCells: this.totalCells,
      totalEnergy: 0,
      peakAmplitude: 0
    };

    this.initDefaultField();
  }

  initDefaultField() {
    this.uCurr.fill(0);
    this.uPrev.fill(0);
    this.uNext.fill(0);
    this.obstacles.fill(0);
    this.cMap.fill(this.c0);

    // Initialize absorbing boundary sponge layer
    const w = this.spongeWidth;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const idx = r * this.cols + c;
        let d = this.damping;

        // Calculate distance to boundary
        const distLeft = c;
        const distRight = this.cols - 1 - c;
        const distTop = r;
        const distBottom = this.rows - 1 - r;
        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        if (minDist < w) {
          const factor = (w - minDist) / w;
          d += 0.08 * factor * factor; // Quadratic absorption
        }
        this.dampMap[idx] = d;
      }
    }
  }

  reset() {
    this.uCurr.fill(0);
    this.uPrev.fill(0);
    this.uNext.fill(0);
    this.sources = [];
  }

  addSource(config) {
    this.sources.push({
      x: config.x ?? Math.floor(this.cols * 0.3),
      y: config.y ?? Math.floor(this.rows * 0.5),
      freq: config.freq ?? 0.35,
      amplitude: config.amplitude ?? 1.5,
      phase: 0,
      moving: config.moving ?? false,
      vx: config.vx ?? 0,
      vy: config.vy ?? 0
    });
  }

  setupDoubleSlit() {
    this.reset();
    this.obstacles.fill(0);
    this.cMap.fill(this.c0);

    // Vertical barrier at 35% width
    const barrierCol = Math.floor(this.cols * 0.35);
    const slitSize = 4;
    const slitSeparation = 24;
    const midY = Math.floor(this.rows * 0.5);

    const s1 = midY - Math.floor(slitSeparation * 0.5);
    const s2 = midY + Math.floor(slitSeparation * 0.5);

    for (let r = 0; r < this.rows; r++) {
      // Leave two slits open
      const inSlit1 = r >= s1 - slitSize && r <= s1 + slitSize;
      const inSlit2 = r >= s2 - slitSize && r <= s2 + slitSize;
      if (!inSlit1 && !inSlit2) {
        this.obstacles[r * this.cols + barrierCol] = 1;
        this.obstacles[r * this.cols + barrierCol + 1] = 1;
      }
    }

    // Source upstream
    this.addSource({
      x: Math.floor(this.cols * 0.15),
      y: midY,
      freq: 0.38,
      amplitude: 2.0
    });
  }

  setupDopplerEffect(mach = 1.2) {
    this.reset();
    this.obstacles.fill(0);
    this.cMap.fill(this.c0);

    // Emitter traveling rightward at mach * c0
    this.addSource({
      x: 20,
      y: Math.floor(this.rows * 0.5),
      freq: 0.35,
      amplitude: 2.0,
      moving: true,
      vx: mach * 0.45,
      vy: 0
    });
  }

  setupConvexLens() {
    this.reset();
    this.obstacles.fill(0);
    this.cMap.fill(this.c0);

    // Optical/acoustic lens in middle: lower wave speed (high refractive index)
    const midX = Math.floor(this.cols * 0.5);
    const midY = Math.floor(this.rows * 0.5);
    const lensRadius = 50;

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const dx = c - midX;
        const dy = r - midY;
        if (dx * dx * 4 + dy * dy < lensRadius * lensRadius) {
          // Biconvex lens profile
          this.cMap[r * this.cols + c] = this.c0 * 0.5; // Half speed = index 2.0
        }
      }
    }

    // Plane wave or point source
    this.addSource({
      x: Math.floor(this.cols * 0.15),
      y: midY,
      freq: 0.32,
      amplitude: 2.0
    });
  }

  triggerPulse(cx, cy, radius = 6, amp = 2.5) {
    for (let r = -radius; r <= radius; r++) {
      for (let c = -radius; c <= radius; c++) {
        const gx = Math.floor(cx) + c;
        const gy = Math.floor(cy) + r;
        if (gx >= 0 && gx < this.cols && gy >= 0 && gy < this.rows) {
          const distSq = c * c + r * r;
          if (distSq <= radius * radius) {
            const val = amp * Math.cos((Math.PI * Math.sqrt(distSq)) / (2 * radius));
            this.uCurr[gy * this.cols + gx] += val;
            this.uPrev[gy * this.cols + gx] += val;
          }
        }
      }
    }
  }

  step(dt, subSteps = 2) {
    const subDt = 0.5; // Courant-Friedrichs-Lewy (CFL) stability factor: c*dt/dx <= 1/sqrt(2)
    for (let s = 0; s < subSteps; s++) {
      this._subStep(subDt);
    }
    this._calculateTelemetry();
  }

  _subStep(dt) {
    const cols = this.cols;
    const rows = this.rows;
    const curr = this.uCurr;
    const prev = this.uPrev;
    const next = this.uNext;
    const cMap = this.cMap;
    const dampMap = this.dampMap;
    const obs = this.obstacles;

    this.time += dt;

    // Apply sources
    for (let s = 0; s < this.sources.length; s++) {
      const src = this.sources[s];
      if (src.moving) {
        src.x += src.vx * dt;
        if (src.x >= cols - this.spongeWidth - 5) {
          src.x = this.spongeWidth + 5;
        }
      }
      const gx = Math.floor(src.x);
      const gy = Math.floor(src.y);
      if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) {
        const val = Math.sin(this.time * src.freq) * src.amplitude;
        curr[gy * cols + gx] = val;
      }
    }

    // FDTD 2D Wave Stencil calculation
    const dtSq = dt * dt;

    for (let r = 1; r < rows - 1; r++) {
      const rowOffset = r * cols;
      for (let c = 1; c < cols - 1; c++) {
        const idx = rowOffset + c;

        if (obs[idx] === 1) {
          next[idx] = 0;
          continue;
        }

        const uVal = curr[idx];
        const uPast = prev[idx];
        const damping = dampMap[idx];
        const cVal = cMap[idx];

        // 5-point discrete Laplacian
        const laplacian = (
          curr[idx - 1] +
          curr[idx + 1] +
          curr[idx - cols] +
          curr[idx + cols] -
          4.0 * uVal
        );

        // Wave propagation PDE discretization with damping
        const cSqDtSq = (cVal * cVal) * dtSq;
        const halfDamp = damping * 0.5;

        const valNext = (2.0 * uVal - uPast * (1.0 - halfDamp) + cSqDtSq * laplacian) / (1.0 + halfDamp);
        next[idx] = valNext;
      }
    }

    // Ping-pong buffers
    this.uPrev.set(this.uCurr);
    this.uCurr.set(this.uNext);
  }

  _calculateTelemetry() {
    let energy = 0;
    let peak = 0;
    const n = this.totalCells;
    for (let i = 0; i < n; i++) {
      const amp = Math.abs(this.uCurr[i]);
      if (amp > peak) peak = amp;
      energy += amp * amp;
    }
    this.stats.peakAmplitude = peak;
    this.stats.totalEnergy = energy * 0.05;
  }

  render(ctx, width, height) {
    if (!this.imageData || this.imageData.width !== this.cols || this.imageData.height !== this.rows) {
      this.imageData = ctx.createImageData(this.cols, this.rows);
    }

    const data = this.imageData.data;
    const curr = this.uCurr;
    const obs = this.obstacles;
    const cMap = this.cMap;
    const n = this.totalCells;

    for (let i = 0; i < n; i++) {
      const pIdx = i * 4;

      if (obs[i] === 1) {
        // Barrier / obstacle: solid silver/slate
        data[pIdx] = 100;
        data[pIdx + 1] = 116;
        data[pIdx + 2] = 139;
        data[pIdx + 3] = 255;
        continue;
      }

      const val = curr[i];
      const isLens = cMap[i] < this.c0 * 0.9;

      // Color mapping: Positive wave peaks cyan, negative troughs magenta
      const clampVal = Math.max(-2.5, Math.min(2.5, val)) / 2.5;

      let r = 10, g = 14, b = 23; // Dark background base

      if (isLens) {
        // Tint refractive medium slightly amber
        r += 25; g += 20; b += 5;
      }

      if (clampVal > 0) {
        // Cyan / Blue peak
        r += Math.floor(clampVal * 20);
        g += Math.floor(clampVal * 220);
        b += Math.floor(clampVal * 255);
      } else {
        // Magenta / Purple trough
        const neg = -clampVal;
        r += Math.floor(neg * 225);
        g += Math.floor(neg * 50);
        b += Math.floor(neg * 240);
      }

      data[pIdx] = Math.min(255, r);
      data[pIdx + 1] = Math.min(255, g);
      data[pIdx + 2] = Math.min(255, b);
      data[pIdx + 3] = 255;
    }

    // Scale onto target canvas
    createImageBitmap(this.imageData).then(bitmap => {
      ctx.drawImage(bitmap, 0, 0, width, height);
    });
  }
}
