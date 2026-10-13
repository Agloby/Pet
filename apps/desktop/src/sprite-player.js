export class CharacterPlayer {
  constructor(character) {
    this.character = character;
    this.celebration = null;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  async start() {
    if (this.character.complete && this.character.naturalWidth > 0) {
      await this.character.decode?.();
      return;
    }
    await new Promise((resolve, reject) => {
      this.character.addEventListener("load", resolve, { once: true });
      this.character.addEventListener("error", reject, { once: true });
    });
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
