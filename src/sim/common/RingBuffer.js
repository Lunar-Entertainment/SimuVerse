/**
 * Fixed-capacity Ring Buffer for zero-allocation telemetry tracking
 * and time-travel simulation rewind.
 */
export class RingBuffer {
  constructor(capacity = 300) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  get(index) {
    if (index < 0 || index >= this.size) return null;
    const actualIdx = (this.head - this.size + index + this.capacity) % this.capacity;
    return this.buffer[actualIdx];
  }

  last() {
    if (this.size === 0) return null;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  popLast() {
    if (this.size === 0) return null;
    this.head = (this.head - 1 + this.capacity) % this.capacity;
    const item = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.size--;
    return item;
  }

  clear() {
    this.head = 0;
    this.size = 0;
    this.buffer.fill(null);
  }

  toArray() {
    const res = new Array(this.size);
    for (let i = 0; i < this.size; i++) {
      res[i] = this.get(i);
    }
    return res;
  }
}
