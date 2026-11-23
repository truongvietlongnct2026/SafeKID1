// Web Audio API synthesizer tailored for iOS Safari autoplay restrictions.
// Must call unlockAudioContext() inside a user interaction (click/touchend) before
// asynchronous distance alerts can emit audio.

class SafariAudioAlertManager {
  private ctx: AudioContext | null = null;
  private loopTimer: number | null = null;
  private isLooping = false;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  public async unlockAudioContext(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Play a 1-sample silent buffer to unlock WebKit audio pipeline on iPhone Safari
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  public playWarningTone(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Two-pulse attention chime (880 Hz -> 660 Hz) clear on iPhone speakers
    const playBeep = (startTime: number, freq: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.32, startTime + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };

    playBeep(now, 880, 0.18);
    playBeep(now + 0.22, 660, 0.24);
  }

  public playRecoverySuccessTone(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.09;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  public startAlertLoop(): void {
    if (this.isLooping) return;
    this.isLooping = true;
    this.playWarningTone();
    this.loopTimer = window.setInterval(() => {
      if (this.isLooping) {
        this.playWarningTone();
      }
    }, 1450);
  }

  public stopAlertLoop(): void {
    this.isLooping = false;
    if (this.loopTimer !== null) {
      window.clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }
}

export const audioAlert = new SafariAudioAlertManager();
