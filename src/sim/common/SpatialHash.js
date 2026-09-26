/**
 * Spatial Grid Hashing for O(1) neighbor lookups in particle simulations.
 * Critical for SPH fluids, collision detection, and localized force fields.
 */
export class SpatialHash {
  constructor(cellSize = 32) {
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.cells = new Map();
  }

  setCellSize(size) {
    this.cellSize = Math.max(1, size);
    this.invCellSize = 1.0 / this.cellSize;
  }

  clear() {
    this.cells.clear();
  }

  _hash(gridX, gridY) {
    // Spatial hash with large prime numbers to minimize collisions
    return ((gridX * 73856093) ^ (gridY * 19349663));
  }

  insert(id, x, y) {
    const gx = Math.floor(x * this.invCellSize);
    const gy = Math.floor(y * this.invCellSize);
    const key = this._hash(gx, gy);

    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(id);
  }

  queryNeighbors(x, y, radius, outResults = []) {
    outResults.length = 0;
    const r = radius;
    const minGx = Math.floor((x - r) * this.invCellSize);
    const maxGx = Math.floor((x + r) * this.invCellSize);
    const minGy = Math.floor((y - r) * this.invCellSize);
    const maxGy = Math.floor((y + r) * this.invCellSize);

    for (let gy = minGy; gy <= maxGy; gy++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        const key = this._hash(gx, gy);
        const cell = this.cells.get(key);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
            outResults.push(cell[i]);
          }
        }
      }
    }
    return outResults;
  }
}
