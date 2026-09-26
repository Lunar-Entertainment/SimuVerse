/**
 * Barnes-Hut QuadTree for O(N log N) Gravitational N-Body Simulation.
 * Hierarchically partitions 2D space into quadrants with mass & center-of-mass aggregation.
 */
export class QuadTreeNode {
  constructor(x, y, size) {
    this.x = x;          // Top-left x
    this.y = y;          // Top-left y
    this.size = size;    // Width/height of square quadrant
    this.half = size * 0.5;

    this.mass = 0;
    this.comX = 0;       // Center of mass X
    this.comY = 0;       // Center of mass Y

    this.bodyIndex = -1; // -1 if internal or empty, >= 0 if leaf containing single body
    this.isLeaf = true;

    // Children: 0: NW, 1: NE, 2: SW, 3: SE
    this.nw = null;
    this.ne = null;
    this.sw = null;
    this.se = null;
  }

  reset(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.half = size * 0.5;
    this.mass = 0;
    this.comX = 0;
    this.comY = 0;
    this.bodyIndex = -1;
    this.isLeaf = true;
    this.nw = null;
    this.ne = null;
    this.sw = null;
    this.se = null;
  }
}

export class QuadTreePool {
  constructor(initialCapacity = 20000) {
    this.nodes = [];
    this.index = 0;
    for (let i = 0; i < initialCapacity; i++) {
      this.nodes.push(new QuadTreeNode(0, 0, 0));
    }
  }

  getNode(x, y, size) {
    if (this.index >= this.nodes.length) {
      this.nodes.push(new QuadTreeNode(x, y, size));
    }
    const node = this.nodes[this.index++];
    node.reset(x, y, size);
    return node;
  }

  reset() {
    this.index = 0;
  }
}

export class BarnesHutTree {
  constructor(poolSize = 30000) {
    this.pool = new QuadTreePool(poolSize);
    this.root = null;
    this.theta = 0.6; // Accuracy threshold (0.5 = high precision, 0.7 = high speed)
  }

  build(bodies, count, bounds) {
    this.pool.reset();
    const size = Math.max(bounds.width, bounds.height);
    this.root = this.pool.getNode(bounds.minX, bounds.minY, size);

    for (let i = 0; i < count; i++) {
      const b = bodies[i];
      if (b.mass <= 0) continue;
      this._insert(this.root, i, bodies);
    }
  }

  _insert(node, bodyIdx, bodies) {
    const b = bodies[bodyIdx];
    const bx = b.x;
    const by = b.y;
    const bm = b.mass;

    // Check bounds
    if (bx < node.x || bx > node.x + node.size || by < node.y || by > node.y + node.size) {
      return;
    }

    if (node.isLeaf) {
      if (node.bodyIndex === -1) {
        // Empty leaf: place body here
        node.bodyIndex = bodyIdx;
        node.mass = bm;
        node.comX = bx;
        node.comY = by;
        return;
      }

      // Leaf already has a body: subdivide
      const existingIdx = node.bodyIndex;
      node.isLeaf = false;
      node.bodyIndex = -1;

      this._subdivide(node);

      // Re-insert existing body into appropriate child
      this._insert(node, existingIdx, bodies);
    }

    // Update center of mass and total mass
    const totalMass = node.mass + bm;
    if (totalMass > 0) {
      node.comX = (node.comX * node.mass + bx * bm) / totalMass;
      node.comY = (node.comY * node.mass + by * bm) / totalMass;
      node.mass = totalMass;
    }

    // Insert new body into child
    const child = this._getChild(node, bx, by);
    if (child) {
      this._insert(child, bodyIdx, bodies);
    }
  }

  _subdivide(node) {
    const h = node.half;
    node.nw = this.pool.getNode(node.x, node.y, h);
    node.ne = this.pool.getNode(node.x + h, node.y, h);
    node.sw = this.pool.getNode(node.x, node.y + h, h);
    node.se = this.pool.getNode(node.x + h, node.y + h, h);
  }

  _getChild(node, x, y) {
    const midX = node.x + node.half;
    const midY = node.y + node.half;
    if (y < midY) {
      return x < midX ? node.nw : node.ne;
    } else {
      return x < midX ? node.sw : node.se;
    }
  }

  computeForce(node, body, G, softeningSq, outForce) {
    if (!node || node.mass <= 0) return;

    const dx = node.comX - body.x;
    const dy = node.comY - body.y;
    const distSq = dx * dx + dy * dy + softeningSq;
    const dist = Math.sqrt(distSq);

    // If leaf containing this same body, skip self-interaction
    if (node.isLeaf && node.bodyIndex === body.id) {
      return;
    }

    // Barnes-Hut criteria: node size / distance < theta
    if (node.isLeaf || (node.size / dist) < this.theta) {
      const f = (G * body.mass * node.mass) / (distSq * dist);
      outForce.x += dx * f;
      outForce.y += dy * f;
    } else {
      // Recurse into children
      if (node.nw) this.computeForce(node.nw, body, G, softeningSq, outForce);
      if (node.ne) this.computeForce(node.ne, body, G, softeningSq, outForce);
      if (node.sw) this.computeForce(node.sw, body, G, softeningSq, outForce);
      if (node.se) this.computeForce(node.se, body, G, softeningSq, outForce);
    }
  }
}
