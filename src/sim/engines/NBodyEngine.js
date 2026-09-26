import { Vector2 } from '../common/Vector2.js';
import { BarnesHutTree } from '../common/QuadTree.js';

export class NBodyEngine {
  constructor(options = {}) {
    this.name = 'Celestial N-Body Dynamics';
    this.type = 'nbody';

    // Physics constants
    this.G = options.G ?? 1.5;
    this.softening = options.softening ?? 12.0; // Softening length to prevent infinity
    this.softeningSq = this.softening * this.softening;
    this.collisionMerge = options.collisionMerge ?? true;
    this.useBarnesHut = options.useBarnesHut ?? true;
    this.barnesHut = new BarnesHutTree();
    this.barnesHut.theta = options.theta ?? 0.65;
    this.integrator = options.integrator ?? 'verlet'; // 'verlet', 'euler', 'rk4'
    this.trailLength = options.trailLength ?? 32;

    // Body storage
    this.maxBodies = 25000;
    this.bodies = [];
    this.tempForce = new Vector2();

    // Camera / viewport state
    this.viewport = {
      x: 0,
      y: 0,
      zoom: 1.0
    };

    // Telemetry
    this.stats = {
      bodyCount: 0,
      kineticEnergy: 0,
      potentialEnergy: 0,
      totalEnergy: 0,
      centerOfMass: { x: 0, y: 0 }
    };
  }

  reset() {
    this.bodies = [];
    this.stats.bodyCount = 0;
  }

  addBody(config) {
    const body = {
      id: this.bodies.length,
      x: config.x ?? 0,
      y: config.y ?? 0,
      vx: config.vx ?? 0,
      vy: config.vy ?? 0,
      ax: 0,
      ay: 0,
      mass: config.mass ?? 1.0,
      radius: config.radius ?? Math.max(2, Math.cbrt(config.mass ?? 1.0) * 2.5),
      color: config.color ?? '#00f0ff',
      glow: config.glow ?? '#00f0ff',
      type: config.type ?? 'planet', // 'star', 'planet', 'blackhole', 'debris'
      fixed: config.fixed ?? false,
      trail: [],
      alive: true
    };
    this.bodies.push(body);
    this.stats.bodyCount = this.bodies.length;
    return body;
  }

  setBarnesHut(enabled) {
    this.useBarnesHut = enabled;
  }

  setIntegrator(type) {
    this.integrator = type;
  }

  step(dt, subSteps = 2) {
    if (this.bodies.length === 0) return;
    const subDt = dt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      this._subStep(subDt);
    }

    this._updateTrails();
    this._calculateTelemetry();
  }

  _subStep(dt) {
    const n = this.bodies.length;
    if (n === 0) return;

    if (this.integrator === 'rk4') {
      this._integrateRK4(dt);
    } else {
      // Symplectic Velocity-Verlet
      this._integrateVelocityVerlet(dt);
    }

    // Inelastic collisions & coalescing
    if (this.collisionMerge) {
      this._handleCollisions();
    }
  }

  _computeAccelerations() {
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      this.bodies[i].ax = 0;
      this.bodies[i].ay = 0;
    }

    if (this.useBarnesHut && n > 64) {
      // Find bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < n; i++) {
        const b = this.bodies[i];
        if (b.x < minX) minX = b.x;
        if (b.x > maxX) maxX = b.x;
        if (b.y < minY) minY = b.y;
        if (b.y > maxY) maxY = b.y;
      }
      const pad = 50;
      const bounds = {
        minX: minX - pad,
        minY: minY - pad,
        width: Math.max(maxX - minX + pad * 2, 100),
        height: Math.max(maxY - minY + pad * 2, 100)
      };

      this.barnesHut.build(this.bodies, n, bounds);

      const f = this.tempForce;
      for (let i = 0; i < n; i++) {
        const b = this.bodies[i];
        if (b.fixed) continue;
        f.x = 0;
        f.y = 0;
        this.barnesHut.computeForce(this.barnesHut.root, b, this.G, this.softeningSq, f);
        b.ax = f.x / b.mass;
        b.ay = f.y / b.mass;
      }
    } else {
      // Direct All-Pairs O(N^2)
      const G = this.G;
      const epsSq = this.softeningSq;

      for (let i = 0; i < n; i++) {
        const b1 = this.bodies[i];
        for (let j = i + 1; j < n; j++) {
          const b2 = this.bodies[j];
          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const distSq = dx * dx + dy * dy + epsSq;
          const dist = Math.sqrt(distSq);
          const force = (G * b1.mass * b2.mass) / (distSq * dist);

          const fx = dx * force;
          const fy = dy * force;

          if (!b1.fixed) {
            b1.ax += fx / b1.mass;
            b1.ay += fy / b1.mass;
          }
          if (!b2.fixed) {
            b2.ax -= fx / b2.mass;
            b2.ay -= fy / b2.mass;
          }
        }
      }
    }
  }

  _integrateVelocityVerlet(dt) {
    const n = this.bodies.length;
    const halfDt = dt * 0.5;

    // First half step: v(t + dt/2) = v(t) + a(t) * dt/2
    // x(t + dt) = x(t) + v(t + dt/2) * dt
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.fixed) continue;
      b.vx += b.ax * halfDt;
      b.vy += b.ay * halfDt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }

    // Recompute accelerations a(t + dt)
    this._computeAccelerations();

    // Second half step: v(t + dt) = v(t + dt/2) + a(t + dt) * dt/2
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.fixed) continue;
      b.vx += b.ax * halfDt;
      b.vy += b.ay * halfDt;
    }
  }

  _integrateRK4(dt) {
    // Runge-Kutta 4th Order Implementation
    this._computeAccelerations();
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.fixed) continue;
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
  }

  _handleCollisions() {
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const b1 = this.bodies[i];
      if (!b1.alive) continue;

      for (let j = i + 1; j < n; j++) {
        const b2 = this.bodies[j];
        if (!b2.alive) continue;

        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const distSq = dx * dx + dy * dy;
        const minDist = b1.radius + b2.radius;

        if (distSq < minDist * minDist) {
          // Merge: heavier body absorbs lighter body
          const primary = b1.mass >= b2.mass ? b1 : b2;
          const secondary = b1.mass >= b2.mass ? b2 : b1;

          // Conservation of linear momentum: (m1*v1 + m2*v2) / (m1+m2)
          const totalMass = primary.mass + secondary.mass;
          if (!primary.fixed) {
            primary.vx = (primary.vx * primary.mass + secondary.vx * secondary.mass) / totalMass;
            primary.vy = (primary.vy * primary.mass + secondary.vy * secondary.mass) / totalMass;
          }
          primary.mass = totalMass;
          // Volumetric radius scaling
          primary.radius = Math.max(primary.radius, Math.cbrt(Math.pow(primary.radius, 3) + Math.pow(secondary.radius, 3)));

          if (secondary.type === 'blackhole') {
            primary.type = 'blackhole';
            primary.color = '#000000';
            primary.glow = '#a855f7';
          }

          secondary.alive = false;
        }
      }
    }

    // Filter dead bodies
    this.bodies = this.bodies.filter(b => b.alive);
    this.stats.bodyCount = this.bodies.length;
  }

  _updateTrails() {
    const n = this.bodies.length;
    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      if (b.type === 'debris' && this.bodies.length > 500) continue; // Skip trails for debris in huge counts for max FPS
      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > this.trailLength) {
        b.trail.shift();
      }
    }
  }

  _calculateTelemetry() {
    let ke = 0;
    let pe = 0;
    let totalMass = 0;
    let comX = 0;
    let comY = 0;
    const n = this.bodies.length;
    const G = this.G;
    const epsSq = this.softeningSq;

    for (let i = 0; i < n; i++) {
      const b = this.bodies[i];
      const vSq = b.vx * b.vx + b.vy * b.vy;
      ke += 0.5 * b.mass * vSq;
      totalMass += b.mass;
      comX += b.x * b.mass;
      comY += b.y * b.mass;

      // Sample subset of potential energy if too many bodies
      const stepJ = n > 300 ? 5 : 1;
      for (let j = i + 1; j < n; j += stepJ) {
        const b2 = this.bodies[j];
        const dx = b2.x - b.x;
        const dy = b2.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy + epsSq);
        pe -= (G * b.mass * b2.mass) / dist * (n > 300 ? 5 : 1);
      }
    }

    this.stats.kineticEnergy = ke;
    this.stats.potentialEnergy = pe;
    this.stats.totalEnergy = ke + pe;
    if (totalMass > 0) {
      this.stats.centerOfMass = { x: comX / totalMass, y: comY / totalMass };
    }
  }

  render(ctx, width, height, options = {}) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Apply viewport transform
    ctx.translate(width * 0.5 + this.viewport.x, height * 0.5 + this.viewport.y);
    ctx.scale(this.viewport.zoom, this.viewport.zoom);

    // Render deep space background grid
    if (options.showGrid) {
      this._renderSpaceGrid(ctx);
    }

    // Render trails
    if (options.showTrails !== false) {
      ctx.lineWidth = 1.5;
      for (let i = 0; i < this.bodies.length; i++) {
        const b = this.bodies[i];
        if (b.trail.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(b.trail[0].x, b.trail[0].y);
        for (let t = 1; t < b.trail.length; t++) {
          ctx.lineTo(b.trail[t].x, b.trail[t].y);
        }
        ctx.strokeStyle = b.color + '44';
        ctx.stroke();
      }
    }

    // Render velocity vectors
    if (options.showVelocityVectors) {
      ctx.lineWidth = 1.0;
      for (let i = 0; i < this.bodies.length; i++) {
        const b = this.bodies[i];
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x + b.vx * 15, b.y + b.vy * 15);
        ctx.strokeStyle = '#38bdf8aa';
        ctx.stroke();
      }
    }

    // Render bodies
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];

      if (b.type === 'blackhole') {
        // Gravitational lensing photon ring + accretion disk
        const grad = ctx.createRadialGradient(b.x, b.y, b.radius * 0.8, b.x, b.y, b.radius * 4.5);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.25, '#c084fc');
        grad.addColorStop(0.5, '#f43f5e99');
        grad.addColorStop(0.8, '#fbbf2444');
        grad.addColorStop(1, 'transparent');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius * 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Event Horizon
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Star or planet with bloom glow
        if (b.type === 'star' || b.mass > 500) {
          const glowGrad = ctx.createRadialGradient(b.x, b.y, b.radius * 0.2, b.x, b.y, b.radius * 3.5);
          glowGrad.addColorStop(0, b.glow || b.color);
          glowGrad.addColorStop(0.4, (b.glow || b.color) + '66');
          glowGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = glowGrad;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius * 3.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  _renderSpaceGrid(ctx) {
    const gridSize = 100;
    const extent = 3000;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -extent; x <= extent; x += gridSize) {
      ctx.moveTo(x, -extent);
      ctx.lineTo(x, extent);
    }
    for (let y = -extent; y <= extent; y += gridSize) {
      ctx.moveTo(-extent, y);
      ctx.lineTo(extent, y);
    }
    ctx.stroke();
  }
}
