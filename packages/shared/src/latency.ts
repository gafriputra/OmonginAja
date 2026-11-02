/**
 * Measures "mouth to ear" delay: from the moment the speaker starts talking after a pause
 * to the first translated audio that comes back.
 */
export class LatencyMeter {
  private speechStartedAt?: number;
  private lastVoiceAt = -Infinity;
  private samples: number[] = [];

  constructor(private threshold = 0.02, private minPauseMs = 600, private window = 20) {}

  /** Feed each captured 16-bit PCM chunk. */
  onInput(pcm: Int16Array, now: number) {
    if (rms(pcm) < this.threshold) return;
    if (this.speechStartedAt === undefined && now - this.lastVoiceAt >= this.minPauseMs) this.speechStartedAt = now;
    this.lastVoiceAt = now;
  }

  /** Call on every translated audio chunk; returns the latency when this chunk completes a measurement. */
  onOutput(now: number): number | undefined {
    if (this.speechStartedAt === undefined) return undefined;
    const latency = now - this.speechStartedAt;
    this.speechStartedAt = undefined;
    this.samples = [...this.samples.slice(1 - this.window), latency];
    return latency;
  }

  get average(): number | undefined {
    if (!this.samples.length) return undefined;
    return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
  }
}

function rms(pcm: Int16Array): number {
  let sum = 0;
  for (const s of pcm) sum += (s / 0x8000) ** 2;
  return Math.sqrt(sum / Math.max(1, pcm.length));
}
