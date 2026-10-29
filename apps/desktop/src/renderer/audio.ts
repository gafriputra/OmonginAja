import { AUDIO_SAMPLE_RATE } from "@omonginaja/shared";

/** Converts the context's float samples to 16-bit PCM in ~100 ms chunks. */
const PCM_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(${AUDIO_SAMPLE_RATE / 10}); this.len = 0; }
  process(inputs) {
    const ch = inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.len === this.buf.length) {
        this.port.postMessage(this.buf.buffer.slice(0));
        this.len = 0;
      }
    }
    return true;
  }
}
registerProcessor("pcm-capture", PcmCapture);
`;

export async function listDevices() {
  // Labels are only exposed once the user has granted microphone access.
  await navigator.mediaDevices.getUserMedia({ audio: true }).then((s) => s.getTracks().forEach((t) => t.stop()));
  const devices = await navigator.mediaDevices.enumerateDevices();
  return {
    inputs: devices.filter((d) => d.kind === "audioinput"),
    outputs: devices.filter((d) => d.kind === "audiooutput"),
  };
}

/** Captures an input device as 16 kHz mono PCM. Returns a stop function. */
export async function captureDevice(deviceId: string, onChunk: (pcm: ArrayBuffer) => void) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: { exact: deviceId }, channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
  const url = URL.createObjectURL(new Blob([PCM_WORKLET], { type: "text/javascript" }));
  await ctx.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(ctx, "pcm-capture");
  node.port.onmessage = (e) => onChunk(e.data as ArrayBuffer);
  ctx.createMediaStreamSource(stream).connect(node);

  return () => {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}

/**
 * Plays PCM chunks gaplessly on a chosen output device.
 * For outgoing speech this is the virtual cable (e.g. "BlackHole 2ch" / "CABLE Input"),
 * which the meeting app then hears as the "OmonginAja" microphone.
 */
export class PcmPlayer {
  private ctx?: AudioContext;
  private playhead = 0;

  async open(sinkId: string, sampleRate: number) {
    if (this.ctx?.sampleRate !== sampleRate) {
      await this.ctx?.close();
      this.ctx = new AudioContext({ sampleRate });
    }
    await this.ctx.setSinkId(sinkId);
  }

  play(pcm: ArrayBuffer) {
    if (!this.ctx) return;
    const ints = new Int16Array(pcm);
    const buffer = this.ctx.createBuffer(1, ints.length, this.ctx.sampleRate);
    const floats = buffer.getChannelData(0);
    for (let i = 0; i < ints.length; i++) floats[i] = ints[i] / 0x8000;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.ctx.destination);
    this.playhead = Math.max(this.playhead, this.ctx.currentTime);
    src.start(this.playhead);
    this.playhead += buffer.duration;
  }

  async close() {
    await this.ctx?.close();
    this.ctx = undefined;
  }
}
