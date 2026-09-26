import { SimulationManager } from './sim/SimulationManager.js';
import { UIManager } from './ui/UIManager.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('viewport-canvas');
  if (!canvas) {
    console.error('Viewport canvas element not found');
    return;
  }

  // Initialize Core Simulation and UI Manager
  const simManager = new SimulationManager(canvas);
  const uiManager = new UIManager(simManager);

  // Main High-Precision Animation & Simulation Loop
  let lastTime = performance.now();
  let telemetryTimer = 0;

  function loop(timestamp) {
    const delta = timestamp - lastTime;
    lastTime = timestamp;

    simManager.tick(timestamp);

    // Update telemetry display every 80ms to avoid DOM thrashing
    telemetryTimer += delta;
    if (telemetryTimer >= 80) {
      uiManager.updateTelemetry();
      telemetryTimer = 0;
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
  console.log('🌌 SimuVerse: High-Performance Multi-Physics Simulation Suite initialized successfully.');
});
