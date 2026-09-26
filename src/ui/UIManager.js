import { SimulationPresets } from './Presets.js';
import { UpdatesLog, AppVersion } from './UpdatesLog.js';
import { TelemetryChart } from './TelemetryChart.js';

export class UIManager {
  constructor(simManager) {
    this.sim = simManager;
    this.activeTool = 'pan'; // 'pan', 'spawn', 'grab', 'vortex', 'knife', 'erase'
    this.isMouseDown = false;
    this.mouseStart = { x: 0, y: 0 };
    this.mouseCurr = { x: 0, y: 0 };
    this.dragTarget = null;

    // Oscilloscope Chart
    const oscCanvas = document.getElementById('oscilloscope-canvas');
    if (oscCanvas) {
      oscCanvas.width = 300;
      oscCanvas.height = 100;
      this.chart = new TelemetryChart(oscCanvas);
    }

    this._initElements();
    this._bindEvents();
    this._bindCanvasInteractions();
    this._loadInitialPreset();
  }

  _initElements() {
    this.versionBadge = document.getElementById('version-badge');
    if (this.versionBadge) {
      this.versionBadge.textContent = `v${AppVersion}`;
    }

    // Dynamic Parameter Container
    this.paramContainer = document.getElementById('dynamic-parameters');
    this.toolPaletteContainer = document.getElementById('tool-palette');

    // Telemetry display elements
    this.fpsVal = document.getElementById('fps-val');
    this.frameTimeVal = document.getElementById('frame-time-val');
    this.gflopsVal = document.getElementById('gflops-val');
    this.entityCountVal = document.getElementById('entity-count-val');
    this.kineticEnergyVal = document.getElementById('kinetic-energy-val');
    this.totalEnergyVal = document.getElementById('total-energy-val');

    // Time readout
    this.simTimeReadout = document.getElementById('sim-time-readout');
    this.btnPlay = document.getElementById('btn-play');
  }

  _loadInitialPreset() {
    const first = SimulationPresets.nbody[0];
    if (first) {
      first.load(this.sim.activeEngine);
    }
    this.updateControlsForEngine();
  }

  _bindEvents() {
    // Engine switcher tabs
    document.querySelectorAll('.engine-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const engineId = e.currentTarget.dataset.engine;
        document.querySelectorAll('.engine-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');

        this.sim.setEngine(engineId);
        // Load first preset for this engine
        if (SimulationPresets[engineId] && SimulationPresets[engineId][0]) {
          SimulationPresets[engineId][0].load(this.sim.activeEngine);
        }
        this.updateControlsForEngine();
      });
    });

    // Transport buttons
    if (this.btnPlay) {
      this.btnPlay.addEventListener('click', () => {
        const isRunning = this.sim.togglePlay();
        this._updatePlayButton(isRunning);
      });
    }

    const btnStep = document.getElementById('btn-step');
    if (btnStep) {
      btnStep.addEventListener('click', () => this.sim.stepOnce());
    }

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        const engineId = this.sim.activeEngineId;
        if (SimulationPresets[engineId] && SimulationPresets[engineId][0]) {
          SimulationPresets[engineId][0].load(this.sim.activeEngine);
        } else {
          this.sim.activeEngine.reset();
        }
      });
    }

    // Time scale slider
    const timeSlider = document.getElementById('slider-timescale');
    const timeVal = document.getElementById('val-timescale');
    if (timeSlider) {
      timeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        this.sim.setTimeScale(val);
        if (timeVal) timeVal.textContent = `${val.toFixed(2)}x`;
      });
    }

    // Sub-steps slider
    const substepSlider = document.getElementById('slider-substeps');
    const substepVal = document.getElementById('val-substeps');
    if (substepSlider) {
      substepSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.sim.setSubSteps(val);
        if (substepVal) substepVal.textContent = `${val}`;
      });
    }

    // Modals
    this._bindModals();

    // Hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        const isRunning = this.sim.togglePlay();
        this._updatePlayButton(isRunning);
      } else if (e.key === '.') {
        this.sim.stepOnce();
      } else if (e.key.toLowerCase() === 'r') {
        btnReset?.click();
      } else if (e.key.toLowerCase() === 'p') {
        document.getElementById('btn-open-presets')?.click();
      }
    });

    // Snapshot capture button
    const btnSnapshot = document.getElementById('btn-snapshot');
    if (btnSnapshot) {
      btnSnapshot.addEventListener('click', () => {
        const dataUrl = this.sim.captureSnapshot();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `simuverse_${this.sim.activeEngineId}_${Date.now()}.png`;
        a.click();
      });
    }
  }

  _updatePlayButton(isRunning) {
    if (!this.btnPlay) return;
    this.btnPlay.innerHTML = isRunning 
      ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`
      : `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play`;
    this.btnPlay.classList.toggle('active', isRunning);
  }

  _bindModals() {
    const presetModal = document.getElementById('modal-presets');
    const updatesModal = document.getElementById('modal-updates');
    const shortcutsModal = document.getElementById('modal-shortcuts');

    document.getElementById('btn-open-presets')?.addEventListener('click', () => {
      this._populatePresetModal();
      presetModal?.classList.add('open');
    });

    this.versionBadge?.addEventListener('click', () => {
      this._populateUpdatesModal();
      updatesModal?.classList.add('open');
    });

    document.getElementById('btn-open-shortcuts')?.addEventListener('click', () => {
      shortcutsModal?.classList.add('open');
    });

    // Close buttons
    document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.classList.contains('modal-close-btn')) {
          document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
        }
      });
    });
  }

  _populatePresetModal() {
    const grid = document.getElementById('preset-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const engineId = this.sim.activeEngineId;
    const presets = SimulationPresets[engineId] || [];

    presets.forEach(p => {
      const card = document.createElement('div');
      card.className = 'preset-card';
      card.innerHTML = `
        <div class="preset-card-title">${p.title}</div>
        <div class="preset-card-desc">${p.description}</div>
      `;
      card.addEventListener('click', () => {
        p.load(this.sim.activeEngine);
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
        this.updateControlsForEngine();
      });
      grid.appendChild(card);
    });
  }

  _populateUpdatesModal() {
    const list = document.getElementById('updates-list');
    if (!list) return;
    list.innerHTML = '';

    UpdatesLog.forEach(u => {
      const entry = document.createElement('div');
      entry.className = 'update-entry';
      entry.innerHTML = `
        <div class="update-entry-header">
          <span class="update-version">v${u.version}</span>
          <span class="update-date">${u.date}</span>
        </div>
        <div class="update-title">${u.title}</div>
        <ul class="update-highlights">
          ${u.highlights.map(h => `<li>${h}</li>`).join('')}
        </ul>
      `;
      list.appendChild(entry);
    });
  }

  updateControlsForEngine() {
    const engineId = this.sim.activeEngineId;
    const engine = this.sim.activeEngine;

    // 1. Build Tool Palette
    if (this.toolPaletteContainer) {
      this.toolPaletteContainer.innerHTML = '';
      let tools = [];

      if (engineId === 'nbody') {
        tools = [
          { id: 'pan', label: 'Pan / Zoom' },
          { id: 'spawn', label: 'Spawn Body' },
          { id: 'vortex', label: 'Vortex Well' },
          { id: 'erase', label: 'Erase' }
        ];
      } else if (engineId === 'fluid') {
        tools = [
          { id: 'spawn', label: 'Fluid Stream' },
          { id: 'grab', label: 'Push Fluid' },
          { id: 'vortex', label: 'Stirrer' },
          { id: 'erase', label: 'Clear' }
        ];
      } else if (engineId === 'cloth') {
        tools = [
          { id: 'knife', label: 'Knife (Cut)' },
          { id: 'grab', label: 'Drag Cloth' },
          { id: 'spawn', label: 'Pin Point' }
        ];
      } else if (engineId === 'wave') {
        tools = [
          { id: 'spawn', label: 'Pulse Wave' },
          { id: 'drawWall', label: 'Draw Barrier' },
          { id: 'erase', label: 'Clear Barrier' }
        ];
      } else if (engineId === 'reaction') {
        tools = [
          { id: 'spawn', label: 'Perturb (V)' },
          { id: 'erase', label: 'Clear (U)' }
        ];
      }

      this.activeTool = tools[0]?.id || 'pan';

      tools.forEach((t, idx) => {
        const btn = document.createElement('button');
        btn.className = `btn tool-btn ${idx === 0 ? 'active' : ''}`;
        btn.textContent = t.label;
        btn.addEventListener('click', () => {
          this.toolPaletteContainer.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTool = t.id;
        });
        this.toolPaletteContainer.appendChild(btn);
      });
    }

    // 2. Build Engine Dynamic Sliders
    if (this.paramContainer) {
      this.paramContainer.innerHTML = '';

      if (engineId === 'nbody') {
        this._addSlider('Gravity Constant (G)', 0.1, 5.0, 0.1, engine.G, (val) => { engine.G = val; });
        this._addSlider('Softening Length', 2.0, 30.0, 1.0, engine.softening, (val) => { 
          engine.softening = val; 
          engine.softeningSq = val * val; 
        });
        this._addCheckbox('Barnes-Hut O(N log N) Tree', engine.useBarnesHut, (val) => { engine.setBarnesHut(val); });
        this._addCheckbox('Inelastic Body Merger', engine.collisionMerge, (val) => { engine.collisionMerge = val; });
      } else if (engineId === 'fluid') {
        this._addSlider('Viscosity', 10.0, 500.0, 10.0, engine.viscosity, (val) => { engine.viscosity = val; });
        this._addSlider('Gravity Acceleration', 0.0, 400.0, 10.0, engine.gravity, (val) => { engine.gravity = val; });
        this._addSlider('Stiffness (Gas Const)', 500.0, 5000.0, 100.0, engine.gasConstant, (val) => { engine.gasConstant = val; });
      } else if (engineId === 'cloth') {
        this._addCheckbox('Wind Vector Field', engine.windEnabled, (val) => { engine.windEnabled = val; });
        this._addSlider('Wind Gust Speed', 20.0, 300.0, 10.0, engine.windSpeed, (val) => { engine.windSpeed = val; });
        this._addSlider('Gravity', 50.0, 600.0, 10.0, engine.gravity, (val) => { engine.gravity = val; });
        this._addSlider('Constraint Iterations', 2, 16, 1, engine.constraintIterations, (val) => { engine.constraintIterations = val; });
      } else if (engineId === 'wave') {
        this._addSlider('Medium Damping', 0.0, 0.015, 0.001, engine.damping, (val) => { 
          engine.damping = val; 
          engine.initDefaultField();
        });
      } else if (engineId === 'reaction') {
        this._addSlider('Feed Rate (F)', 0.01, 0.08, 0.001, engine.F, (val) => { engine.F = val; });
        this._addSlider('Kill Rate (k)', 0.04, 0.07, 0.001, engine.k, (val) => { engine.k = val; });
      }
    }
  }

  _addSlider(label, min, max, step, initialVal, onChange) {
    const row = document.createElement('div');
    row.className = 'slider-row';
    row.innerHTML = `
      <div class="slider-label-row">
        <span class="slider-label">${label}</span>
        <span class="slider-value">${initialVal}</span>
      </div>
      <input type="range" min="${min}" max="${max}" step="${step}" value="${initialVal}" />
    `;
    const input = row.querySelector('input');
    const valDisplay = row.querySelector('.slider-value');
    input.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      valDisplay.textContent = val;
      onChange(val);
    });
    this.paramContainer.appendChild(row);
  }

  _addCheckbox(label, initialVal, onChange) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.margin = '4px 0';
    row.innerHTML = `
      <input type="checkbox" ${initialVal ? 'checked' : ''} style="cursor:pointer;" />
      <span style="font-size:11px; color:var(--text-muted);">${label}</span>
    `;
    const input = row.querySelector('input');
    input.addEventListener('change', (e) => {
      onChange(e.target.checked);
    });
    this.paramContainer.appendChild(row);
  }

  _bindCanvasInteractions() {
    const canvas = this.sim.canvas;

    canvas.addEventListener('mousedown', (e) => {
      this.isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.mouseStart = { x, y };
      this.mouseCurr = { x, y };

      this._handleInteraction(x, y, 'down');
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isMouseDown) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const prevX = this.mouseCurr.x;
      const prevY = this.mouseCurr.y;
      this.mouseCurr = { x, y };

      this._handleInteraction(x, y, 'move', prevX, prevY);
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.isMouseDown) return;
      this.isMouseDown = false;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this._handleInteraction(x, y, 'up');
    });

    // Zoom on wheel
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.sim.activeEngineId === 'nbody') {
        const factor = e.deltaY < 0 ? 1.1 : 0.9;
        this.sim.activeEngine.viewport.zoom = Math.max(0.1, Math.min(10.0, this.sim.activeEngine.viewport.zoom * factor));
      }
    }, { passive: false });
  }

  _handleInteraction(x, y, eventType, prevX, prevY) {
    const engineId = this.sim.activeEngineId;
    const engine = this.sim.activeEngine;

    if (engineId === 'nbody') {
      const vp = engine.viewport;
      // Convert screen coordinate to simulation space
      const worldX = (x - this.sim.width * 0.5 - vp.x) / vp.zoom;
      const worldY = (y - this.sim.height * 0.5 - vp.y) / vp.zoom;

      if (this.activeTool === 'pan' && eventType === 'move') {
        vp.x += (x - prevX);
        vp.y += (y - prevY);
      } else if (this.activeTool === 'vortex' && (eventType === 'move' || eventType === 'down')) {
        // Apply vortex force around mouse
        for (let i = 0; i < engine.bodies.length; i++) {
          const b = engine.bodies[i];
          const dx = worldX - b.x;
          const dy = worldY - b.y;
          const distSq = dx * dx + dy * dy + 100;
          const dist = Math.sqrt(distSq);
          if (dist < 400) {
            const f = 2000.0 / distSq;
            b.vx += (dx / dist) * f * 0.5 - (dy / dist) * f * 1.2;
            b.vy += (dy / dist) * f * 0.5 + (dx / dist) * f * 1.2;
          }
        }
      } else if (this.activeTool === 'spawn' && eventType === 'up') {
        const startWorldX = (this.mouseStart.x - this.sim.width * 0.5 - vp.x) / vp.zoom;
        const startWorldY = (this.mouseStart.y - this.sim.height * 0.5 - vp.y) / vp.zoom;
        const vx = (worldX - startWorldX) * 0.05;
        const vy = (worldY - startWorldY) * 0.05;

        engine.addBody({
          x: startWorldX,
          y: startWorldY,
          vx: vx,
          vy: vy,
          mass: 5.0,
          radius: 4.5,
          color: '#38bdf8',
          type: 'planet'
        });
      } else if (this.activeTool === 'erase' && (eventType === 'down' || eventType === 'move')) {
        for (let i = 0; i < engine.bodies.length; i++) {
          const b = engine.bodies[i];
          const dist = Math.hypot(b.x - worldX, b.y - worldY);
          if (dist < 35) {
            b.alive = false;
          }
        }
        engine.bodies = engine.bodies.filter(b => b.alive);
      }
    } else if (engineId === 'fluid') {
      if (this.activeTool === 'spawn' && (eventType === 'down' || eventType === 'move')) {
        for (let k = 0; k < 3; k++) {
          engine.addParticle(
            x + (Math.random() - 0.5) * 12,
            y + (Math.random() - 0.5) * 12,
            (Math.random() - 0.5) * 20,
            50 + Math.random() * 30
          );
        }
      } else if (this.activeTool === 'grab' && eventType === 'move') {
        const pushDx = x - prevX;
        const pushDy = y - prevY;
        for (let i = 0; i < engine.count; i++) {
          const dist = Math.hypot(engine.x[i] - x, engine.y[i] - y);
          if (dist < 60) {
            engine.vx[i] += pushDx * 5;
            engine.vy[i] += pushDy * 5;
          }
        }
      } else if (this.activeTool === 'vortex' && (eventType === 'move' || eventType === 'down')) {
        for (let i = 0; i < engine.count; i++) {
          const dx = x - engine.x[i];
          const dy = y - engine.y[i];
          const dist = Math.hypot(dx, dy);
          if (dist < 120 && dist > 5) {
            engine.vx[i] += (-dy / dist) * 120;
            engine.vy[i] += (dx / dist) * 120;
          }
        }
      } else if (this.activeTool === 'erase' && eventType === 'down') {
        engine.reset();
      }
    } else if (engineId === 'cloth') {
      if (this.activeTool === 'knife' && eventType === 'move') {
        engine.cutConstraintsIntersecting(prevX, prevY, x, y);
      } else if (this.activeTool === 'grab' && (eventType === 'move' || eventType === 'down')) {
        // Drag nearest node
        let closest = null;
        let minDist = 40;
        for (let i = 0; i < engine.nodes.length; i++) {
          const n = engine.nodes[i];
          const d = Math.hypot(n.x - x, n.y - y);
          if (d < minDist) {
            minDist = d;
            closest = n;
          }
        }
        if (closest) {
          closest.x = x;
          closest.y = y;
          closest.oldX = x;
          closest.oldY = y;
        }
      } else if (this.activeTool === 'spawn' && eventType === 'down') {
        // Pin or unpin nearest node
        let closest = null;
        let minDist = 30;
        for (let i = 0; i < engine.nodes.length; i++) {
          const n = engine.nodes[i];
          const d = Math.hypot(n.x - x, n.y - y);
          if (d < minDist) {
            minDist = d;
            closest = n;
          }
        }
        if (closest) {
          closest.pinned = !closest.pinned;
          closest.invMass = closest.pinned ? 0 : 1.0 / closest.mass;
        }
      }
    } else if (engineId === 'wave') {
      // Scale from canvas to grid
      const gx = Math.floor((x / this.sim.width) * engine.cols);
      const gy = Math.floor((y / this.sim.height) * engine.rows);

      if (this.activeTool === 'spawn' && (eventType === 'down' || eventType === 'move')) {
        engine.triggerPulse(gx, gy, 6, 2.5);
      } else if (this.activeTool === 'drawWall' && (eventType === 'down' || eventType === 'move')) {
        if (gx >= 0 && gx < engine.cols && gy >= 0 && gy < engine.rows) {
          engine.obstacles[gy * engine.cols + gx] = 1;
        }
      } else if (this.activeTool === 'erase' && (eventType === 'down' || eventType === 'move')) {
        if (gx >= 0 && gx < engine.cols && gy >= 0 && gy < engine.rows) {
          engine.obstacles[gy * engine.cols + gx] = 0;
        }
      }
    } else if (engineId === 'reaction') {
      const gx = Math.floor((x / this.sim.width) * engine.cols);
      const gy = Math.floor((y / this.sim.height) * engine.rows);
      if (this.activeTool === 'spawn' && (eventType === 'down' || eventType === 'move')) {
        engine.injectV(gx, gy, 8);
      } else if (this.activeTool === 'erase' && eventType === 'down') {
        engine.reset();
      }
    }
  }

  updateTelemetry() {
    const tele = this.sim.getTelemetry();
    const profiler = tele.profiler;
    const stats = tele.stats;

    if (this.fpsVal) this.fpsVal.textContent = profiler.fps;
    if (this.frameTimeVal) this.frameTimeVal.textContent = `${profiler.frameTimeMs.toFixed(1)} ms`;
    if (this.gflopsVal) this.gflopsVal.textContent = profiler.gflopsEstimate.toFixed(2);

    let countStr = '0';
    if (tele.engineId === 'nbody') countStr = `${stats.bodyCount || 0} bodies`;
    else if (tele.engineId === 'fluid') countStr = `${stats.particleCount || 0} particles`;
    else if (tele.engineId === 'cloth') countStr = `${stats.nodeCount || 0} nodes`;
    else if (tele.engineId === 'wave' || tele.engineId === 'reaction') countStr = `${stats.totalCells?.toLocaleString() || 0} cells`;

    if (this.entityCountVal) this.entityCountVal.textContent = countStr;

    if (this.kineticEnergyVal) {
      const ke = stats.kineticEnergy || stats.totalEnergy || stats.averageV || 0;
      this.kineticEnergyVal.textContent = ke > 1000 ? (ke / 1000).toFixed(1) + 'k' : ke.toFixed(1);
    }

    if (this.totalEnergyVal) {
      const te = stats.totalEnergy || stats.elasticPotential || stats.peakAmplitude || 0;
      this.totalEnergyVal.textContent = te > 1000 ? (te / 1000).toFixed(1) + 'k' : te.toFixed(1);
    }

    if (this.simTimeReadout) {
      this.simTimeReadout.textContent = `T = ${tele.simTime.toFixed(2)}s`;
    }

    // Oscilloscope update
    if (this.chart) {
      this.chart.pushSample({
        kineticEnergy: stats.kineticEnergy || stats.totalEnergy || 0,
        potentialEnergy: stats.potentialEnergy || 0,
        totalEnergy: stats.totalEnergy || 0,
        fps: profiler.fps
      });
      this.chart.render();
    }
  }
}
