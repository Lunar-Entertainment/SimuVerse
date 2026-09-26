import { NBodyEngine } from './engines/NBodyEngine.js';
import { FluidSPHEngine } from './engines/FluidSPHEngine.js';
import { ClothSoftBodyEngine } from './engines/ClothSoftBodyEngine.js';
import { WaveEquationEngine } from './engines/WaveEquationEngine.js';
import { ReactionDiffusionEngine } from './engines/ReactionDiffusionEngine.js';
import { RingBuffer } from './common/RingBuffer.js';

export class SimulationManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Initialize simulation engines
    this.engines = {
      nbody: new NBodyEngine(),
      fluid: new FluidSPHEngine(),
      cloth: new ClothSoftBodyEngine(),
      wave: new WaveEquationEngine(),
      reaction: new ReactionDiffusionEngine()
    };

    this.activeEngineId = 'nbody';
    this.activeEngine = this.engines.nbody;

    // Simulation Execution State
    this.isRunning = true;
    this.timeScale = 1.0;
    this.subSteps = 3;
    this.stepCount = 0;
    this.simTime = 0;

    // Rewind / Time travel ring buffer
    this.rewindBuffer = new RingBuffer(200);

    // Performance Profiler metrics
    this.profiler = {
      fps: 60,
      frameTimeMs: 16.6,
      computeTimeMs: 0,
      renderTimeMs: 0,
      gflopsEstimate: 0,
      lastTimestamp: performance.now(),
      frameCount: 0,
      fpsTimer: performance.now()
    };

    // Render options
    this.renderOptions = {
      showGrid: true,
      showTrails: true,
      showVelocityVectors: false,
      highContrast: false
    };

    // Auto-resize canvas
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || window.innerWidth;
    const h = rect.height || window.innerHeight;

    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.scale(dpr, dpr);

    this.width = w;
    this.height = h;

    // Update bounds on engines that require boundary boxes
    this.engines.fluid.setBounds(40, 40, w - 40, h - 40);
  }

  setEngine(engineId) {
    if (!this.engines[engineId]) return;
    this.activeEngineId = engineId;
    this.activeEngine = this.engines[engineId];
    this.rewindBuffer.clear();
  }

  play() {
    this.isRunning = true;
  }

  pause() {
    this.isRunning = false;
  }

  togglePlay() {
    this.isRunning = !this.isRunning;
    return this.isRunning;
  }

  setTimeScale(scale) {
    this.timeScale = Math.max(0.05, Math.min(10.0, scale));
  }

  setSubSteps(steps) {
    this.subSteps = Math.max(1, Math.min(15, steps));
  }

  stepOnce(dt = 0.016) {
    this._computeStep(dt * this.timeScale);
    this._renderFrame();
  }

  _computeStep(dt) {
    const t0 = performance.now();

    this.activeEngine.step(dt, this.subSteps);
    this.simTime += dt;
    this.stepCount++;

    const t1 = performance.now();
    this.profiler.computeTimeMs = (t1 - t0);

    // Approximate FLOPs based on engine complexity
    if (this.activeEngineId === 'nbody') {
      const n = this.activeEngine.bodies.length;
      const flopsPerStep = this.activeEngine.useBarnesHut ? n * Math.log2(n + 1) * 45 : n * n * 20;
      this.profiler.gflopsEstimate = (flopsPerStep * this.subSteps / Math.max(0.001, t1 - t0)) / 1e6;
    } else if (this.activeEngineId === 'fluid') {
      const n = this.activeEngine.count;
      this.profiler.gflopsEstimate = (n * 150 * this.subSteps / Math.max(0.001, t1 - t0)) / 1e6;
    } else if (this.activeEngineId === 'wave' || this.activeEngineId === 'reaction') {
      const cells = this.activeEngine.totalCells;
      this.profiler.gflopsEstimate = (cells * 18 * this.subSteps / Math.max(0.001, t1 - t0)) / 1e6;
    }
  }

  _renderFrame() {
    const t0 = performance.now();
    this.activeEngine.render(this.ctx, this.width, this.height, this.renderOptions);
    const t1 = performance.now();
    this.profiler.renderTimeMs = (t1 - t0);
  }

  tick(timestamp) {
    const elapsed = timestamp - this.profiler.lastTimestamp;
    this.profiler.lastTimestamp = timestamp;
    this.profiler.frameTimeMs = elapsed;

    // Calculate FPS
    this.profiler.frameCount++;
    if (timestamp - this.profiler.fpsTimer >= 500) {
      this.profiler.fps = Math.round((this.profiler.frameCount * 1000) / (timestamp - this.profiler.fpsTimer));
      this.profiler.frameCount = 0;
      this.profiler.fpsTimer = timestamp;
    }

    if (this.isRunning) {
      const baseDt = 0.016;
      this._computeStep(baseDt * this.timeScale);
    }

    this._renderFrame();
  }

  getTelemetry() {
    return {
      engineId: this.activeEngineId,
      engineName: this.activeEngine.name,
      stats: this.activeEngine.stats,
      profiler: this.profiler,
      simTime: this.simTime,
      isRunning: this.isRunning,
      timeScale: this.timeScale
    };
  }

  captureSnapshot() {
    return this.canvas.toDataURL('image/png');
  }
}
