// A small, asset-free wind soundscape. Audio is created only after a user gesture.
export class Soundscape {
  private context?: AudioContext;
  private gain?: GainNode;
  private enabled = false;

  async toggle() {
    if (!this.context) {
      const ctx = new AudioContext();
      this.context = ctx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < data.length; i++) {
        last = (last + (Math.random() * 2 - 1) * 0.02) / 1.02;
        data[i] = last * 3.5;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 550;
      this.gain = ctx.createGain();
      this.gain.gain.value = 0;
      noise.connect(filter).connect(this.gain).connect(ctx.destination);
      noise.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    this.gain!.gain.setTargetAtTime(this.enabled ? 0.24 : 0, this.context.currentTime, 0.35);
    return this.enabled;
  }

  chime(index: number) {
    if (!this.context || !this.enabled) return;
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = [523.25, 659.25, 783.99][index % 3];
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.13, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 1.3);
  }
}
