/**
 * High-performance real-time canvas oscilloscope for physics telemetry.
 * Displays energy conservation, velocities, and computational metrics.
 */
export class TelemetryChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.historyLength = 90;
    this.history = [];
    this.currentMode = 'energy'; // 'energy', 'fps'
  }

  pushSample(sample) {
    this.history.push(sample);
    if (this.history.length > this.historyLength) {
      this.history.shift();
    }
  }

  setMode(mode) {
    this.currentMode = mode;
  }

  render() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const len = this.history.length;

    ctx.clearRect(0, 0, w, h);

    if (len < 2) return;

    // Draw grid background lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.25); ctx.lineTo(w, h * 0.25);
    ctx.moveTo(0, h * 0.5); ctx.lineTo(w, h * 0.5);
    ctx.moveTo(0, h * 0.75); ctx.lineTo(w, h * 0.75);
    ctx.stroke();

    if (this.currentMode === 'energy') {
      this._renderEnergyCurves(ctx, w, h, len);
    } else {
      this._renderFpsCurves(ctx, w, h, len);
    }
  }

  _renderEnergyCurves(ctx, w, h, len) {
    let maxVal = 1e-5;
    let minVal = 0;

    for (let i = 0; i < len; i++) {
      const s = this.history[i];
      const ke = Math.abs(s.kineticEnergy || 0);
      const pe = Math.abs(s.potentialEnergy || 0);
      const te = Math.abs(s.totalEnergy || 0);
      if (ke > maxVal) maxVal = ke;
      if (pe > maxVal) maxVal = pe;
      if (te > maxVal) maxVal = te;
    }

    const scaleY = (h - 10) / (maxVal - minVal || 1);
    const stepX = w / (this.historyLength - 1);

    // 1. Draw Kinetic Energy (Cyan)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const val = Math.abs(this.history[i].kineticEnergy || 0);
      const x = i * stepX;
      const y = h - 5 - (val - minVal) * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 2. Draw Total Energy (Gold)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.0;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const val = Math.abs(this.history[i].totalEnergy || 0);
      const x = i * stepX;
      const y = h - 5 - (val - minVal) * scaleY;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  _renderFpsCurves(ctx, w, h, len) {
    const stepX = w / (this.historyLength - 1);
    const maxFps = 100;

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < len; i++) {
      const fps = Math.min(maxFps, this.history[i].fps || 60);
      const x = i * stepX;
      const y = h - (fps / maxFps) * (h - 10) - 5;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
