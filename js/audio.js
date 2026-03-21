export class AudioSystem {
  constructor() {
    this.context = null;
    this.enabled = true;
  }

  setMuted(muted) {
    this.enabled = !muted;
  }

  unlock() {
    if (this.context) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.context = new Ctx();
  }

  beep({ type = 'sine', frequency = 440, duration = 0.08, gain = 0.04, ramp = 0.008, slideTo = null }) {
    if (!this.enabled) return;
    if (!this.context) this.unlock();
    if (!this.context) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    const vol = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, now + duration);
    vol.gain.setValueAtTime(0.0001, now);
    vol.gain.exponentialRampToValueAtTime(gain, now + ramp);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(vol);
    vol.connect(this.context.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  ui() { this.beep({ type: 'triangle', frequency: 540, duration: 0.05, gain: 0.03, slideTo: 620 }); }
  hit(power = 1) { this.beep({ type: 'triangle', frequency: 240 + power * 120, duration: 0.06, gain: 0.045, slideTo: 120 }); }
  wall(speed = 1) { this.beep({ type: 'square', frequency: 180 + speed * 60, duration: 0.04, gain: 0.02, slideTo: 150 }); }
  splash() { this.beep({ type: 'sine', frequency: 280, duration: 0.12, gain: 0.03, slideTo: 180 }); }
  success() {
    this.beep({ type: 'triangle', frequency: 560, duration: 0.12, gain: 0.04, slideTo: 840 });
    this.beep({ type: 'sine', frequency: 780, duration: 0.2, gain: 0.03, slideTo: 620 });
  }
}
