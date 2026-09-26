# 🌌 SimuVerse: High-Performance Multi-Physics Simulation Suite

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-cyan.svg)](https://github.com/Lunar-Entertainment/SimuVerse)
[![Vite](https://img.shields.io/badge/Vite-6.x-646CFF.svg)](https://vitejs.dev/)
[![JavaScript: ESNext](https://img.shields.io/badge/ESNext-TypedArrays-f59e0b.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Typed_arrays)

> **SimuVerse** is a modern, GPU/CPU-accelerated scientific simulation workstation running at 60 FPS in real time. Designed for fluid dynamics, astrophysics, elastic continuum mechanics, wave optics, and biological morphogenesis.

---

## ⚡ Computational Physics Engines

### 1. 🪐 Celestial N-Body Gravitational Dynamics
- **Barnes-Hut $O(N \log N)$ QuadTree**: Hierarchical spatial partitioning with center-of-mass clustering and multipole expansion ($\theta = 0.65$).
- **Direct All-Pairs $O(N^2)$ Mode**: Vectorized loop with numerical softening length $\epsilon$ to eliminate infinite acceleration singularities.
- **Symplectic Integrators**: Velocity-Verlet and Runge-Kutta 4th Order (RK4) conserving angular momentum and mechanical energy.
- **Relativistic Features**: Black hole event horizons, photon rings, gravitational lensing distortion, and inelastic collision mergers with linear momentum conservation ($m_1 v_1 + m_2 v_2 = (m_1+m_2)v_{\text{new}}$).
- **Presets**: Milky Way & Andromeda Galaxy Collision, Keplerian Solar System with Asteroid Belt, Figure-8 3-Body Choreography.

### 2. 💧 Smoothed Particle Hydrodynamics (SPH)
- **Lagrangian Formulation**: Dual-phase fluid mechanics solving Navier-Stokes equations in real time.
- **Smoothing Kernels**:
  - Density: Müller Poly6 kernel $W_{\text{poly6}}(r, h) = \frac{315}{64\pi h^9} (h^2 - r^2)^3$
  - Pressure Gradient: Spiky kernel $\nabla W_{\text{spiky}}(r, h)$ with Tait Equation of State $P = k((\rho/\rho_0)^\gamma - 1)$
  - Viscosity: Monaghan Laplacian kernel $\nabla^2 W_{\text{visc}}(r, h)$
- **Spatial Acceleration**: $O(1)$ grid hash table for neighbor queries.
- **Presets**: Dam break surge wave, Obstacle wake vortex separation.

### 3. 🧵 Soft-Body & Cloth Continuum Mechanics
- **Position-Based Dynamics (PBD)**: Mass-spring-damper lattice with Gauss-Seidel constraint projection.
- **Constraint Types**: Structural, diagonal shear, and bending/flexion springs.
- **Interactive Knife Tool**: Real-time line-intersection cloth slicing and stress-induced tearing.
- **Aerodynamics**: Sinusoidal and turbulent wind vector field with aero-drag.
- **Obstacles**: Spherical rigid collision bodies and reaction planes.
- **Presets**: Silk flag billowing in wind, Deformable bouncing jello soft body.

### 4. 🌊 FDTD 2D Wave Optics & Acoustics
- **PDE Formulation**: Finite-Difference Time-Domain solving $\frac{\partial^2 u}{\partial t^2} = c(x,y)^2 \nabla^2 u - \gamma \frac{\partial u}{\partial t}$.
- **Features**:
  - Inhomogeneous refractive index maps $n(x,y)$ demonstrating Snell's Law and optical lenses.
  - Absorbing sponge boundary layer (PML approximation) eliminating artificial wall reflections.
  - Rigid barrier aperture masks for diffraction and interference experiments.
- **Presets**: Young's Double-Slit interference fringes, Supersonic Mach shock cone ($v > c$), Biconvex refractive lens.

### 5. 🧬 Turing Morphogenesis & Reaction-Diffusion
- **PDE Formulation**: Gray-Scott nonlinear reaction-diffusion system:
  $$\frac{\partial u}{\partial t} = D_u \nabla^2 u - u v^2 + F(1-u)$$
  $$\frac{\partial v}{\partial t} = D_v \nabla^2 v + u v^2 - (F + k)v$$
- **Convolution**: 9-point Laplacian stencil on $200 \times 150$ dual-buffer grid.
- **Presets**: Mitosis (self-dividing spots), Coral fractal growth, Soliton waves.

---

## 🖥️ Workstation UI & Features

- **Glassmorphism Design**: Deep obsidian workspace with frosted panels (`backdrop-filter: blur(16px)`), CSS tokens, and Google Fonts (`Inter`, `JetBrains Mono`, `Orbitron`).
- **Real-Time Profiler**: Live FPS, frame timing (ms), estimated GFLOPs, active entity counts, and physical conservation metrics.
- **Oscilloscope**: Dual-trace canvas chart plotting Kinetic Energy ($K$) and Total Mechanical Energy ($E$) with auto-scaling.
- **Interactive Tool Palette**: Pan/Zoom, Particle Emitter, Gravitational/Fluid Vortex Well, Knife Slicing, and Wall Brush.
- **Time Controls**: Play/Pause (`Space`), Single-step (`.`), Reset (`R`), Time Scaling ($0.1\times - 4.0\times$), and Sub-stepping ($1 - 10$ steps/frame).
- **Snapshot Camera Tool**: Instant 4K PNG export of simulation states.
- **In-App Updates Log**: Built-in changelog modal tracking version history.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (tested on Node.js v24)
- npm or pnpm

### Installation & Launch
```bash
# Clone repository
git clone https://github.com/Lunar-Entertainment/SimuVerse.git
cd SimuVerse

# Install dependencies
npm install

# Start local workstation dev server
npm run dev
```

Open `http://localhost:3000/` in any modern web browser (Chrome, Edge, Firefox, Safari).

### Production Build
```bash
npm run build
npm run preview
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` | Play / Pause Simulation |
| `.` (Period) | Advance Single Step Forward |
| `R` | Reset Current Preset |
| `P` | Open Presets Browser |
| `Mouse Drag` | Pan Viewport / Interact with Tool |
| `Scroll Wheel` | Zoom Camera in/out (N-Body) |

---

## 📄 License
MIT License © 2026 Lunar-Entertainment
