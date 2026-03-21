export class InputSystem {
  constructor(game) {
    this.game = game;
    this.bind();
  }

  bind() {
    const trigger = (event) => {
      if (event.target.closest('button')) return;
      event.preventDefault();
      this.game.handleJumpInput();
    };
    window.addEventListener('pointerdown', (event) => {
      this.game.audio.unlock();
      trigger(event);
    }, { passive: false });
    window.addEventListener('keydown', (event) => {
      this.game.audio.unlock();
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'w'].includes(key)) {
        event.preventDefault();
        this.game.handleJumpInput();
      }
      if (key === 'p' || key === 'escape') this.game.togglePause();
    });
  }
}
