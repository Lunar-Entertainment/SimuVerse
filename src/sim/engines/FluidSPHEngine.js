import { SpatialHash } from '../common/SpatialHash.js';

export class FluidSPHEngine {
  constructor(options = {}) {
    this.name = 'Hydrodynamics & SPH Fluid';
    this.type = 'fluid';

    // Physical constants
    this.gravity = options.gravity ?? 180.0;
    this.restDensity = options.restDensity ?? 1000.0;
    this.gasConstant = options.gasConstant ?? 2000.0; // Stiffness k
    this.viscosity = options.viscosity ?? 250.0;
    this.surfaceTension = options.surfaceTension ?? 0.05;
    this.h = options.h ?? 16.0; // Kernel smoothing radius
    this.hSq = this.h * this.h;
    this.particleMass = options.particleMass ?? 65.0;
    this.restitution = 0.4; // Wall bounce damping

    // Spatial hash for O(1) neighbor lookups
    this.spatialHash = new SpatialHash(this.h);
    this.neighborBuffer = [];

    // Kernel coefficients precomputed
    this.poly6Coeff = 315.0 / (64.0 * Math.PI * Math.pow(this.h, 9));
    this.spikyGradCoeff = -45.0 / (Math.PI * Math.pow(this.h, 6));
    this.viscLapCoeff = 45.0 / (Math.PI * Math.pow(this.h, 6));

    // Particle storage with TypedArrays for max speed
    this.maxParticles = 6000;
    this.count = 0;
    this.x = new Float32Array(this.maxParticles);
    this.y = new Float32Array(this.maxParticles);
    this.vx = new Float32Array(this.maxParticles);
    this.vy = new Float32Array(this.maxParticles);
    this.fx = new Float32Array(this.maxParticles);
    this.fy = new Float32Array(this.maxParticles);
    this.density = new Float32Array(this.maxParticles);
    this.pressure = new Float32Array(this.maxParticles);

    // Obstacles (circles / walls)
    this.obstacles = [
      { x: 400, y: 350, radius: 45, type: 'circle' }
    ];

    // Simulation bounds
    this.bounds = {
      minX: 50,
      maxX: 750,
      minY: 50,
      maxY: 550
    };

    // Telemetry
    this.stats = {
      particleCount: 0,
      kineticEnergy: 0,
      avgDensity: 0,
      maxVelocity: 0
    };
  }

  setBounds(minX, minY, maxX, maxY) {
    this.bounds.minX = minX;
    this.bounds.minY = minY;
    this.bounds.maxX = maxX;
    this.bounds.maxY = maxY;
  }

  reset() {
    this.count = 0;
    this.stats.particleCount = 0;
  }

  addParticle(px, py, pvx = 0, pvy = 0) {
    if (this.count >= this.maxParticles) return -1;
    const i = this.count++;
    this.x[i] = px;
    this.y[i] = py;
    this.vx[i] = pvx;
    this.vy[i] = pvy;
    this.fx[i] = 0;
    this.fy[i] = 0;
    this.density[i] = this.restDensity;
    this.pressure[i] = 0;
    this.stats.particleCount = this.count;
    return i;
  }

  spawnFluidBlock(startX, startY, cols, rows, spacing = 8) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (this.count >= this.maxParticles) break;
        const jitter = (Math.random() - 0.5) * 1.5;
        this.addParticle(startX + c * spacing + jitter, startY + r * spacing + jitter);
      }
    }
  }

  step(dt, subSteps = 3) {
    if (this.count === 0) return;
    const subDt = Math.min(dt / subSteps, 0.008);

    for (let s = 0; s < subSteps; s++) {
      this._subStep(subDt);
    }

    this._calculateTelemetry();
  }

  _subStep(dt) {
    const n = this.count;
    const h = this.h;
    const hSq = this.hSq;
    const mass = this.particleMass;

    // 1. Build spatial hash
    this.spatialHash.clear();
    for (let i = 0; i < n; i++) {
      this.spatialHash.insert(i, this.x[i], this.y[i]);
    }

    // 2. Compute Density and Pressure via Poly6 Kernel
    let totalDensity = 0;
    for (let i = 0; i < n; i++) {
      const px = this.x[i];
      const py = this.y[i];
      const neighbors = this.spatialHash.queryNeighbors(px, py, h, this.neighborBuffer);

      let rho = 0;
      for (let k = 0; k < neighbors.length; k++) {
        const j = neighbors[k];
        const dx = px - this.x[j];
        const dy = py - this.y[j];
        const rSq = dx * dx + dy * dy;

        if (rSq < hSq) {
          const diff = hSq - rSq;
          rho += mass * this.poly6Coeff * diff * diff * diff;
        }
      }

      this.density[i] = Math.max(rho, this.restDensity * 0.1);
      // State equation (Tait / ideal gas)
      this.pressure[i] = this.gasConstant * (this.density[i] - this.restDensity);
      totalDensity += this.density[i];
    }
    this.stats.avgDensity = totalDensity / n;

    // 3. Compute Pressure Gradient, Viscosity, and External Forces
    for (let i = 0; i < n; i++) {
      const px = this.x[i];
      const py = this.y[i];
      const pvx = this.vx[i];
      const pvy = this.vy[i];
      const rho_i = this.density[i];
      const p_i = this.pressure[i];

      let fPressX = 0;
      let fPressY = 0;
      let fViscX = 0;
      let fViscY = 0;

      const neighbors = this.spatialHash.queryNeighbors(px, py, h, this.neighborBuffer);

      for (let k = 0; k < neighbors.length; k++) {
        const j = neighbors[k];
        if (i === j) continue;

        const dx = px - this.x[j];
        const dy = py - this.y[j];
        const rSq = dx * dx + dy * dy;

        if (rSq < hSq && rSq > 1e-6) {
          const r = Math.sqrt(rSq);
          const rho_j = this.density[j];
          const p_j = this.pressure[j];
          const invR = 1.0 / r;

          // Spiky pressure force
          const pressTerm = (p_i + p_j) / (2.0 * rho_j);
          const spikyGrad = this.spikyGradCoeff * (h - r) * (h - r) * invR;
          fPressX -= mass * pressTerm * spikyGrad * dx;
          fPressY -= mass * pressTerm * spikyGrad * dy;

          // Viscosity force
          const viscLap = this.viscLapCoeff * (h - r);
          fViscX += this.viscosity * mass * ((this.vx[j] - pvx) / rho_j) * viscLap;
          fViscY += this.viscosity * mass * ((this.vy[j] - pvy) / rho_j) * viscLap;
        }
      }

      // External gravity
      this.fx[i] = fPressX + fViscX;
      this.fy[i] = fPressY + fViscY + (this.gravity * rho_i);
    }

    // 4. Time integration (Symplectic Euler / Velocity Verlet) & Boundary Enforcement
    const b = this.bounds;
    const rest = this.restitution;

    for (let i = 0; i < n; i++) {
      // a = F / rho
      const ax = this.fx[i] / this.density[i];
      const ay = this.fy[i] / this.density[i];

      this.vx[i] += ax * dt;
      this.vy[i] += ay * dt;

      // Position update
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;

      // Boundary Collisions
      if (this.x[i] < b.minX) {
        this.x[i] = b.minX;
        this.vx[i] = -this.vx[i] * rest;
      } else if (this.x[i] > b.maxX) {
        this.x[i] = b.maxX;
        this.vx[i] = -this.vx[i] * rest;
      }

      if (this.y[i] < b.minY) {
        this.y[i] = b.minY;
        this.vy[i] = -this.vy[i] * rest;
      } else if (this.y[i] > b.maxY) {
        this.y[i] = b.maxY;
        this.vy[i] = -this.vy[i] * rest;
      }

      // Circular obstacles
      for (let o = 0; o < this.obstacles.length; o++) {
        const obs = this.obstacles[o];
        const odx = this.x[i] - obs.x;
        const ody = this.y[i] - obs.y;
        const oDistSq = odx * odx + ody * ody;
        if (oDistSq < obs.radius * obs.radius) {
          const oDist = Math.sqrt(oDistSq);
          const nx = odx / (oDist || 1);
          const ny = ody / (oDist || 1);
          this.x[i] = obs.x + nx * obs.radius;
          this.y[i] = obs.y + ny * obs.radius;

          // Reflect velocity along normal
          const dot = this.vx[i] * nx + this.vy[i] * ny;
          this.vx[i] = (this.vx[i] - 1.8 * dot * nx) * rest;
          this.vy[i] = (this.vy[i] - 1.8 * dot * ny) * rest;
        }
      }
    }
  }

  _calculateTelemetry() {
    let ke = 0;
    let maxV = 0;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      const vSq = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i];
      ke += 0.5 * this.particleMass * vSq;
      if (vSq > maxV) maxV = vSq;
    }
    this.stats.kineticEnergy = ke;
    this.stats.maxVelocity = Math.sqrt(maxV);
  }

  render(ctx, width, height, options = {}) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Draw simulation container tank
    const b = this.bounds;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY);

    // Draw obstacles
    for (let o = 0; o < this.obstacles.length; o++) {
      const obs = this.obstacles[o];
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Render fluid particles
    const n = this.count;
    const particleRadius = 4.5;

    for (let i = 0; i < n; i++) {
      const px = this.x[i];
      const py = this.y[i];
      const speed = Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);

      // Velocity-based color mapping: deep ocean blue -> electric cyan -> neon white
      const t = Math.min(speed / 180.0, 1.0);
      let r = Math.floor(10 + t * 240);
      let g = Math.floor(120 + t * 135);
      let blue = Math.floor(255);

      ctx.fillStyle = `rgb(${r}, ${g}, ${blue})`;
      ctx.beginPath();
      ctx.arc(px, py, particleRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
