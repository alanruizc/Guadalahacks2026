const BEEP_INTERVAL_MS = 550;
const BEEP_DURATION_SEC = 0.18;
const BEEP_VOLUME = 0.28;
const BEEP_FREQ_HZ = 880;
const BEAT_COUNT = 4;

class AlertSoundService {
  private ctx: AudioContext | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private starting = false;
  private unlocked = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx || this.unlocked) return;

    const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    void ctx.resume();
    this.unlocked = true;
  }

  private playBeep(): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'square';
    osc.frequency.value = BEEP_FREQ_HZ;
    gain.gain.setValueAtTime(BEEP_VOLUME, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + BEEP_DURATION_SEC);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + BEEP_DURATION_SEC);
  }

  start(): void {
    if (this.intervalId != null || this.starting) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.starting = true;
    void ctx.resume().then(() => {
      this.starting = false;
      if (this.intervalId != null) return;

      let beatsPlayed = 0;
      const tick = () => {
        if (beatsPlayed >= BEAT_COUNT) {
          this.stop();
          return;
        }
        this.playBeep();
        beatsPlayed += 1;
        if (beatsPlayed >= BEAT_COUNT) {
          this.stop();
        }
      };

      tick();
      this.intervalId = setInterval(tick, BEEP_INTERVAL_MS);
    });
  }

  stop(): void {
    this.starting = false;
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const alertSoundService = new AlertSoundService();
