const CELL_WIDTH = 192;
const CELL_HEIGHT = 208;

const idleFrames = [0, 1, 2, 3, 4, 5].map((column) => ({
  row: 0,
  column,
  duration: 190,
}));

const celebrationFrames = [
  ...[0, 1, 2, 3, 4].map((column) => ({ row: 4, column, duration: 125 })),
  ...[0, 1, 2, 3, 2, 1, 0].map((column) => ({ row: 3, column, duration: 150 })),
];

export class SpritePlayer {
  constructor(canvas, atlasUrl) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.atlas = new Image();
    this.atlasUrl = atlasUrl;
    this.frames = idleFrames;
    this.frameIndex = 0;
    this.frameStartedAt = 0;
    this.oneShotResolver = null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.resizeObserver = null;
  }

  async start() {
    await new Promise((resolve, reject) => {
      this.atlas.addEventListener("load", resolve, { once: true });
      this.atlas.addEventListener("error", reject, { once: true });
      this.atlas.src = this.atlasUrl;
    });
    this.resize();
    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.canvas);
    } else {
      window.addEventListener("resize", () => this.resize());
    }
    requestAnimationFrame((timestamp) => this.tick(timestamp));
  }

  resize() {
    const cssWidth = Math.max(1, this.canvas.clientWidth || 384);
    const cssHeight = cssWidth * (CELL_HEIGHT / CELL_WIDTH);
    const density = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
    const width = Math.round(cssWidth * density);
    const height = Math.round(cssHeight * density);
    if (this.canvas.width === width && this.canvas.height === height) return;

    this.canvas.width = width;
    this.canvas.height = height;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = "high";
    this.draw(this.frames[this.frameIndex]);
  }

  celebrate() {
    if (this.oneShotResolver) return Promise.resolve();

    this.frames = this.reducedMotion ? [celebrationFrames.at(-1)] : celebrationFrames;
    this.frameIndex = 0;
    this.frameStartedAt = performance.now();

    return new Promise((resolve) => {
      this.oneShotResolver = resolve;
    });
  }

  tick(timestamp) {
    const frame = this.frames[this.frameIndex];
    if (timestamp - this.frameStartedAt >= frame.duration) {
      this.frameIndex += 1;
      this.frameStartedAt = timestamp;

      if (this.frameIndex >= this.frames.length) {
        if (this.oneShotResolver) {
          const resolve = this.oneShotResolver;
          this.oneShotResolver = null;
          this.frames = idleFrames;
          this.frameIndex = 0;
          resolve();
        } else {
          this.frameIndex = 0;
        }
      }
    }

    this.draw(this.frames[this.frameIndex]);
    requestAnimationFrame((nextTimestamp) => this.tick(nextTimestamp));
  }

  draw(frame) {
    const { context, canvas } = this;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(
      this.atlas,
      frame.column * CELL_WIDTH,
      frame.row * CELL_HEIGHT,
      CELL_WIDTH,
      CELL_HEIGHT,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }
}
