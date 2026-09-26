export const SimulationPresets = {
  nbody: [
    {
      id: 'galaxyCollision',
      title: 'Galaxy Collision & Merger',
      description: 'Two rotating disc galaxies (Milky Way & Andromeda) with central supermassive black holes colliding under mutual gravity, producing tidal bridges and stellar tails.',
      load: (engine) => {
        engine.reset();
        engine.G = 1.2;
        engine.softening = 10.0;
        engine.softeningSq = 100.0;

        // Galaxy 1: Center at (-220, 0), moving vy = +0.55
        const bh1 = engine.addBody({
          x: -220, y: 0, vx: 0.15, vy: 0.55,
          mass: 3500, radius: 12, type: 'blackhole', color: '#000000', glow: '#a855f7'
        });

        const starsPerGalaxy = 900;
        for (let i = 0; i < starsPerGalaxy; i++) {
          const r = 25 + Math.random() * 220;
          const theta = Math.random() * Math.PI * 2;
          const speed = Math.sqrt((engine.G * bh1.mass) / (r + 15));
          const vx = -Math.sin(theta) * speed + bh1.vx;
          const vy = Math.cos(theta) * speed + bh1.vy;
          const hue = 180 + Math.random() * 40; // Cyan to blue

          engine.addBody({
            x: bh1.x + Math.cos(theta) * r,
            y: bh1.y + Math.sin(theta) * r,
            vx: vx, vy: vy,
            mass: 0.05, radius: 1.5,
            color: `hsl(${hue}, 100%, 75%)`,
            type: 'debris'
          });
        }

        // Galaxy 2: Center at (+220, 0), moving vy = -0.55
        const bh2 = engine.addBody({
          x: 220, y: 0, vx: -0.15, vy: -0.55,
          mass: 3200, radius: 11, type: 'blackhole', color: '#000000', glow: '#f43f5e'
        });

        for (let i = 0; i < starsPerGalaxy; i++) {
          const r = 25 + Math.random() * 200;
          const theta = Math.random() * Math.PI * 2;
          const speed = Math.sqrt((engine.G * bh2.mass) / (r + 15));
          const vx = -Math.sin(theta) * speed + bh2.vx;
          const vy = Math.cos(theta) * speed + bh2.vy;
          const hue = 320 + Math.random() * 50; // Magenta to amber

          engine.addBody({
            x: bh2.x + Math.cos(theta) * r,
            y: bh2.y + Math.sin(theta) * r,
            vx: vx, vy: vy,
            mass: 0.05, radius: 1.5,
            color: `hsl(${hue}, 100%, 75%)`,
            type: 'debris'
          });
        }
      }
    },
    {
      id: 'solarSystem',
      title: 'Solar System Planetary Orbits',
      description: 'Central Sun orbited by terrestrial planets, gas giant Jupiter, and an asteroid belt with stable Keplerian velocities.',
      load: (engine) => {
        engine.reset();
        engine.G = 2.0;
        engine.softening = 8.0;
        engine.softeningSq = 64.0;

        // The Sun
        const sun = engine.addBody({
          x: 0, y: 0, vx: 0, vy: 0,
          mass: 6000, radius: 20, type: 'star', color: '#fbbf24', glow: '#f59e0b'
        });

        const planets = [
          { name: 'Mercury', r: 70, mass: 2, radius: 3.0, color: '#94a3b8' },
          { name: 'Venus',   r: 120, mass: 6, radius: 4.5, color: '#fbbf24' },
          { name: 'Earth',   r: 180, mass: 8, radius: 5.0, color: '#38bdf8' },
          { name: 'Mars',    r: 250, mass: 4, radius: 4.0, color: '#f87171' },
          { name: 'Jupiter', r: 380, mass: 85, radius: 9.5, color: '#fb923c' }
        ];

        planets.forEach(p => {
          const v = Math.sqrt((engine.G * sun.mass) / p.r);
          engine.addBody({
            x: p.r, y: 0, vx: 0, vy: v,
            mass: p.mass, radius: p.radius, color: p.color, type: 'planet'
          });
        });

        // Asteroid belt between Mars and Jupiter (280 to 330)
        for (let i = 0; i < 450; i++) {
          const r = 280 + Math.random() * 50;
          const theta = Math.random() * Math.PI * 2;
          const v = Math.sqrt((engine.G * sun.mass) / r) * (0.98 + Math.random() * 0.04);
          engine.addBody({
            x: Math.cos(theta) * r, y: Math.sin(theta) * r,
            vx: -Math.sin(theta) * v, vy: Math.cos(theta) * v,
            mass: 0.02, radius: 1.2, color: '#cbd5e1', type: 'debris'
          });
        }
      }
    },
    {
      id: 'figureEight',
      title: 'Figure-8 3-Body Choreography',
      description: 'Famous Moore & Chenciner periodic solution where three equal masses chase each other along a figure-eight curve in planar space.',
      load: (engine) => {
        engine.reset();
        engine.G = 3.0;
        engine.softening = 4.0;
        engine.softeningSq = 16.0;

        const m = 350;
        const scale = 220;
        // Normalized initial conditions for figure-8
        const x1 = -0.97000436 * scale, y1 = 0.24308753 * scale;
        const x2 = -x1, y2 = -y1;
        const x3 = 0, y3 = 0;

        const vx3 = -2.0 * (-0.93240737 / 2.0) * 1.35;
        const vy3 = -2.0 * (-0.86473146 / 2.0) * 1.35;
        const vx1 = (-0.93240737 / 2.0) * 1.35, vy1 = (-0.86473146 / 2.0) * 1.35;
        const vx2 = vx1, vy2 = vy1;

        engine.addBody({ x: x1, y: y1, vx: vx1, vy: vy1, mass: m, radius: 8, color: '#00f0ff', type: 'planet' });
        engine.addBody({ x: x2, y: y2, vx: vx2, vy: vy2, mass: m, radius: 8, color: '#a855f7', type: 'planet' });
        engine.addBody({ x: x3, y: y3, vx: vx3, vy: vy3, mass: m, radius: 8, color: '#f59e0b', type: 'planet' });
      }
    }
  ],

  fluid: [
    {
      id: 'damBreak',
      title: 'Dam Break & Splash Wave',
      description: 'A confined water column suddenly collapses under gravity, surging across the basin and crashing upward against the opposite wall.',
      load: (engine) => {
        engine.reset();
        engine.gravity = 220.0;
        engine.viscosity = 200.0;
        engine.gasConstant = 2400.0;

        // Spawn vertical column of water
        engine.spawnFluidBlock(engine.bounds.minX + 15, engine.bounds.minY + 20, 28, 48, 7.5);
      }
    },
    {
      id: 'obstacleVortex',
      title: 'Obstacle Flow & Eddy Shedding',
      description: 'High-speed fluid cascade splitting around a solid cylinder obstacle, generating dynamic boundary separation and turbulence.',
      load: (engine) => {
        engine.reset();
        engine.gravity = 180.0;
        engine.viscosity = 150.0;
        engine.gasConstant = 2600.0;

        // Position obstacle right in middle
        const midX = (engine.bounds.minX + engine.bounds.maxX) * 0.5;
        const midY = (engine.bounds.minY + engine.bounds.maxY) * 0.5;
        engine.obstacles = [
          { x: midX, y: midY, radius: 55, type: 'circle' }
        ];

        // Fluid block dropped from top
        engine.spawnFluidBlock(midX - 120, engine.bounds.minY + 10, 36, 30, 7.0);
      }
    }
  ],

  cloth: [
    {
      id: 'windFlag',
      title: 'Silk Flag in Turbulent Wind',
      description: 'A continuous cloth mesh anchored by two top corner pins, billowing realistically under an aerodynamic turbulent wind vector field. Use the Knife tool to slice through it!',
      load: (engine) => {
        engine.windEnabled = true;
        engine.windSpeed = 160.0;
        engine.gravity = 350.0;
        engine.spawnClothGrid(180, 80, 36, 26, 15);
      }
    },
    {
      id: 'jelloDrop',
      title: 'Deformable Jello Soft-Body',
      description: 'A high-elasticity continuum cube with internal cross-bracing falling onto a rigid sphere obstacle, showing elastic rebound and stress deformation.',
      load: (engine) => {
        engine.windEnabled = false;
        engine.gravity = 420.0;
        engine.obstacles = [{ x: 420, y: 350, radius: 75, type: 'sphere' }];
        engine.spawnJelloBody(340, 70, 160, 7);
      }
    }
  ],

  wave: [
    {
      id: 'doubleSlit',
      title: "Young's Double-Slit Diffraction",
      description: 'Coherent continuous harmonic wave encountering a dual-slit aperture barrier, producing constructive and destructive interference fringes.',
      load: (engine) => {
        engine.setupDoubleSlit();
      }
    },
    {
      id: 'machShock',
      title: 'Supersonic Doppler & Mach Cone',
      description: 'A harmonic emitter traveling through the medium at v > c (Mach 1.3), creating an acoustic shock cone analogous to Cherenkov radiation.',
      load: (engine) => {
        engine.setupDopplerEffect(1.3);
      }
    },
    {
      id: 'refractionLens',
      title: 'Biconvex Refraction Lens',
      description: 'A region of reduced wave speed (high refractive index) demonstrating Snell’s refraction law and wave focal convergence.',
      load: (engine) => {
        engine.setupConvexLens();
      }
    }
  ],

  reaction: [
    {
      id: 'mitosis',
      title: 'Mitosis & Spot Division',
      description: 'Self-replicating chemical spots that grow, stretch, and divide like living biological cells.',
      load: (engine) => {
        engine.setPreset('mitosis');
        engine.reset();
      }
    },
    {
      id: 'coral',
      title: 'Turing Coral Morphogenesis',
      description: 'Branching fractal coral structures emerging spontaneously from reaction-diffusion instabilities.',
      load: (engine) => {
        engine.setPreset('coral');
        engine.reset();
      }
    },
    {
      id: 'solitons',
      title: 'Solitary Soliton Pulses',
      description: 'Stable solitary particle-like excitation waves that collide and interact without dispersing.',
      load: (engine) => {
        engine.setPreset('solitons');
        engine.reset();
      }
    }
  ]
};
