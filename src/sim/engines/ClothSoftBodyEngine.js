export class ClothSoftBodyEngine {
  constructor(options = {}) {
    this.name = 'Soft-Body & Cloth Continuum';
    this.type = 'cloth';

    // Physics parameters
    this.gravity = options.gravity ?? 400.0;
    this.damping = options.damping ?? 0.992;
    this.constraintIterations = options.iterations ?? 8;
    this.tearDistanceFactor = options.tearFactor ?? 4.0; // Break spring if stretched > factor * restLength
    this.windEnabled = true;
    this.windSpeed = 120.0;
    this.time = 0;

    // Simulation objects
    this.nodes = [];       // Array of particles { x, y, oldX, oldY, mass, pinned, color }
    this.constraints = []; // Array of springs { p1, p2, restLength, stiffness, alive, type }
    this.obstacles = [
      { x: 420, y: 340, radius: 65, type: 'sphere' }
    ];

    // Stats
    this.stats = {
      nodeCount: 0,
      springCount: 0,
      kineticEnergy: 0,
      elasticPotential: 0
    };
  }

  reset() {
    this.nodes = [];
    this.constraints = [];
    this.stats.nodeCount = 0;
    this.stats.springCount = 0;
  }

  addNode(x, y, pinned = false, mass = 1.0) {
    const node = {
      id: this.nodes.length,
      x: x,
      y: y,
      oldX: x,
      oldY: y,
      vx: 0,
      vy: 0,
      mass: mass,
      invMass: pinned ? 0 : 1.0 / mass,
      pinned: pinned,
      color: '#38bdf8'
    };
    this.nodes.push(node);
    this.stats.nodeCount = this.nodes.length;
    return node;
  }

  addConstraint(p1, p2, stiffness = 1.0, type = 'structural') {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const restLength = Math.sqrt(dx * dx + dy * dy);

    const c = {
      p1: p1,
      p2: p2,
      restLength: restLength,
      stiffness: stiffness,
      tearLength: restLength * this.tearDistanceFactor,
      alive: true,
      type: type,
      currentStress: 0
    };
    this.constraints.push(c);
    this.stats.springCount = this.constraints.length;
    return c;
  }

  spawnClothGrid(startX, startY, cols = 35, rows = 25, spacing = 16) {
    this.reset();
    const grid = [];

    // Create particles
    for (let r = 0; r < rows; r++) {
      grid[r] = [];
      for (let c = 0; c < cols; c++) {
        const pinned = (r === 0 && (c % 4 === 0 || c === cols - 1));
        const node = this.addNode(startX + c * spacing, startY + r * spacing, pinned);
        grid[r][c] = node;
      }
    }

    // Create Structural Constraints (horizontal & vertical)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) {
          this.addConstraint(grid[r][c], grid[r][c + 1], 1.0, 'structural');
        }
        if (r < rows - 1) {
          this.addConstraint(grid[r][c], grid[r + 1][c], 1.0, 'structural');
        }
      }
    }

    // Create Shear Constraints (diagonals for realistic wrinkling)
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        this.addConstraint(grid[r][c], grid[r + 1][c + 1], 0.7, 'shear');
        this.addConstraint(grid[r + 1][c], grid[r][c + 1], 0.7, 'shear');
      }
    }

    // Create Bending Constraints (skip one node)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 2) {
          this.addConstraint(grid[r][c], grid[r][c + 2], 0.5, 'bend');
        }
        if (r < rows - 2) {
          this.addConstraint(grid[r][c], grid[r + 2][c], 0.5, 'bend');
        }
      }
    }
  }

  spawnJelloBody(startX, startY, size = 120, divisions = 6) {
    this.reset();
    const spacing = size / divisions;
    const grid = [];

    for (let r = 0; r <= divisions; r++) {
      grid[r] = [];
      for (let c = 0; c <= divisions; c++) {
        const node = this.addNode(startX + c * spacing, startY + r * spacing, false, 0.8);
        grid[r][c] = node;
      }
    }

    for (let r = 0; r <= divisions; r++) {
      for (let c = 0; c <= divisions; c++) {
        if (c < divisions) {
          this.addConstraint(grid[r][c], grid[r][c + 1], 1.0, 'structural');
        }
        if (r < divisions) {
          this.addConstraint(grid[r][c], grid[r + 1][c], 1.0, 'structural');
        }
        if (r < divisions && c < divisions) {
          this.addConstraint(grid[r][c], grid[r + 1][c + 1], 0.9, 'shear');
          this.addConstraint(grid[r + 1][c], grid[r][c + 1], 0.9, 'shear');
        }
      }
    }
  }

  cutConstraintsIntersecting(x1, y1, x2, y2) {
    let severed = 0;
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      if (!c.alive) continue;
      if (this._linesIntersect(x1, y1, x2, y2, c.p1.x, c.p1.y, c.p2.x, c.p2.y)) {
        c.alive = false;
        severed++;
      }
    }
    return severed;
  }

  _linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 1e-8) return false;
    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  step(dt, subSteps = 3) {
    if (this.nodes.length === 0) return;
    const subDt = Math.min(dt / subSteps, 0.016);
    this.time += dt;

    for (let s = 0; s < subSteps; s++) {
      this._subStep(subDt);
    }

    this._calculateTelemetry();
  }

  _subStep(dt) {
    const nodes = this.nodes;
    const constraints = this.constraints;
    const dtSq = dt * dt;
    const damp = this.damping;

    // Wind force computation
    let windForceX = 0;
    if (this.windEnabled) {
      windForceX = Math.sin(this.time * 2.5) * this.windSpeed + Math.cos(this.time * 7.1) * (this.windSpeed * 0.3);
    }

    // 1. Verlet Particle Integration
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i];
      if (p.pinned) continue;

      const vx = (p.x - p.oldX) * damp;
      const vy = (p.y - p.oldY) * damp;

      p.oldX = p.x;
      p.oldY = p.y;

      const ax = windForceX * 0.5;
      const ay = this.gravity;

      p.x += vx + ax * dtSq;
      p.y += vy + ay * dtSq;
    }

    // 2. Constraint Relaxation (Gauss-Seidel PBD iterations)
    for (let iter = 0; iter < this.constraintIterations; iter++) {
      for (let i = 0; i < constraints.length; i++) {
        const c = constraints[i];
        if (!c.alive) continue;

        const p1 = c.p1;
        const p2 = c.p2;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check tear condition
        if (dist > c.tearLength) {
          c.alive = false;
          continue;
        }

        c.currentStress = (dist - c.restLength) / c.restLength;

        if (dist > 1e-6) {
          const diff = (dist - c.restLength) / dist;
          const totalInvMass = p1.invMass + p2.invMass;
          if (totalInvMass === 0) continue;

          const factor = diff * c.stiffness / totalInvMass;
          const offsetX = dx * factor;
          const offsetY = dy * factor;

          if (!p1.pinned) {
            p1.x += offsetX * p1.invMass;
            p1.y += offsetY * p1.invMass;
          }
          if (!p2.pinned) {
            p2.x -= offsetX * p2.invMass;
            p2.y -= offsetY * p2.invMass;
          }
        }
      }

      // Obstacle collisions
      for (let i = 0; i < nodes.length; i++) {
        const p = nodes[i];
        if (p.pinned) continue;

        // Spherical obstacles
        for (let o = 0; o < this.obstacles.length; o++) {
          const obs = this.obstacles[o];
          const dx = p.x - obs.x;
          const dy = p.y - obs.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < obs.radius * obs.radius) {
            const dist = Math.sqrt(distSq);
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);
            p.x = obs.x + nx * obs.radius;
            p.y = obs.y + ny * obs.radius;
          }
        }

        // Floor collision
        if (p.y > 600) {
          p.y = 600;
        }
      }
    }
  }

  _calculateTelemetry() {
    let ke = 0;
    let pe = 0;

    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodes[i];
      const vx = p.x - p.oldX;
      const vy = p.y - p.oldY;
      ke += 0.5 * p.mass * (vx * vx + vy * vy);
    }

    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      if (!c.alive) continue;
      const dx = c.p1.x - c.p2.x;
      const dy = c.p1.y - c.p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist - c.restLength;
      pe += 0.5 * c.stiffness * delta * delta;
    }

    this.stats.kineticEnergy = ke * 1000;
    this.stats.elasticPotential = pe;
  }

  render(ctx, width, height, options = {}) {
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Draw Obstacles
    for (let o = 0; o < this.obstacles.length; o++) {
      const obs = this.obstacles[o];
      const grad = ctx.createRadialGradient(obs.x - obs.radius * 0.3, obs.y - obs.radius * 0.3, obs.radius * 0.1, obs.x, obs.y, obs.radius);
      grad.addColorStop(0, '#38bdf8');
      grad.addColorStop(0.8, '#0369a1');
      grad.addColorStop(1, '#082f49');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw Constraints (Springs) with Stress Heatmap
    ctx.lineWidth = 1.5;
    for (let i = 0; i < this.constraints.length; i++) {
      const c = this.constraints[i];
      if (!c.alive) continue;

      // Color based on tension stress
      const stress = Math.max(0, c.currentStress);
      if (stress > 0.5) {
        ctx.strokeStyle = '#ef4444'; // High stress - red
      } else if (stress > 0.2) {
        ctx.strokeStyle = '#f59e0b'; // Moderate - amber
      } else {
        ctx.strokeStyle = c.type === 'structural' ? 'rgba(56, 189, 248, 0.7)' : 'rgba(168, 85, 247, 0.3)';
      }

      ctx.beginPath();
      ctx.moveTo(c.p1.x, c.p1.y);
      ctx.lineTo(c.p2.x, c.p2.y);
      ctx.stroke();
    }

    // Draw pinned nodes & active vertices
    for (let i = 0; i < this.nodes.length; i++) {
      const p = this.nodes[i];
      if (p.pinned) {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Floor
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 600);
    ctx.lineTo(width, 600);
    ctx.stroke();

    ctx.restore();
  }
}
