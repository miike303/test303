export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  setMuted(muted) { this.muted = muted; }

  unlock() {
    if (this.ctx) return;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    this.ctx = new Context();
  }

  tone({ type = 'sine', frequency = 440, duration = 0.08, gain = 0.03, slide = null }) {
    if (this.muted) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slide), now + duration);
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  jump() { this.tone({ type: 'triangle', frequency: 520, duration: 0.07, gain: 0.04, slide: 760 }); }
  wall() { this.tone({ type: 'square', frequency: 280, duration: 0.05, gain: 0.025, slide: 180 }); }
  coin() { this.tone({ type: 'sine', frequency: 800, duration: 0.08, gain: 0.03, slide: 1080 }); }
  shield() { this.tone({ type: 'triangle', frequency: 320, duration: 0.16, gain: 0.03, slide: 620 }); }
  combo() { this.tone({ type: 'triangle', frequency: 640, duration: 0.05, gain: 0.024, slide: 900 }); }
  powerup() { this.tone({ type: 'sawtooth', frequency: 420, duration: 0.12, gain: 0.03, slide: 720 }); }
  death() { this.tone({ type: 'sawtooth', frequency: 260, duration: 0.28, gain: 0.04, slide: 70 }); }
  click() { this.tone({ type: 'triangle', frequency: 600, duration: 0.05, gain: 0.02, slide: 780 }); }
}
