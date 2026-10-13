export class CharacterPlayer {
  constructor(character) {
    this.character = character;
    this.swimmer = character.closest(".kern-swimmer") || character;
    this.celebration = null;
    this.motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reducedMotion = this.motionPreference.matches;
    this.motionFrame = null;
    this.motionStart = null;

    this.motionPreference.addEventListener?.("change", (event) => {
      this.reducedMotion = event.matches;
      if (event.matches) this.stopSwimming();
      else this.startSwimming();
    });
  }

  async start() {
    if (this.character.complete && this.character.naturalWidth > 0) {
      await this.character.decode?.();
    } else {
      await new Promise((resolve, reject) => {
        this.character.addEventListener("load", resolve, { once: true });
        this.character.addEventListener("error", reject, { once: true });
      });
    }

    if (!this.reducedMotion) this.startSwimming();
  }

  startSwimming() {
    if (this.motionFrame) return;

    const swim = (now) => {
      this.motionStart ??= now;
      const elapsed = now - this.motionStart;

      // Layered waves keep the route from feeling like a short repeated tween.
      const horizontal = Math.sin(elapsed * 0.00032) * 13 + Math.sin(elapsed * 0.00071) * 4;
      const vertical = Math.sin(elapsed * 0.00043) * 8 + Math.cos(elapsed * 0.00019) * 4;
      const pitch = Math.cos(elapsed * 0.00043) * 0.72 + Math.cos(elapsed * 0.00071) * 0.2;

      this.swimmer.style.transform =
        `translate3d(${horizontal.toFixed(2)}px, ${vertical.toFixed(2)}px, 0) rotate(${pitch.toFixed(2)}deg)`;
      this.motionFrame = window.requestAnimationFrame(swim);
    };

    this.motionFrame = window.requestAnimationFrame(swim);
  }

  stopSwimming() {
    if (this.motionFrame) window.cancelAnimationFrame(this.motionFrame);
    this.motionFrame = null;
    this.motionStart = null;
    this.swimmer.style.removeProperty("transform");
  }

  celebrate() {
    if (this.celebration || this.reducedMotion) return Promise.resolve();
    this.character.classList.remove("is-celebrating");
    void this.character.offsetWidth;
    this.character.classList.add("is-celebrating");

    this.celebration = new Promise((resolve) => {
      const finish = () => {
        this.character.classList.remove("is-celebrating");
        this.celebration = null;
        resolve();
      };
      this.character.addEventListener("animationend", finish, { once: true });
      window.setTimeout(finish, 1_600);
    });
    return this.celebration;
  }
}
