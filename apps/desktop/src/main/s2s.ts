import WebSocket from "ws";
import { S2S_ADAPTERS, type S2SEvent, type SessionGrant, type SessionRequest } from "@omonginaja/shared";

const MAX_RECONNECTS = 5;
/** Audio kept while (re)connecting: about 2 s at 40 ms chunks. */
const MAX_PENDING_AUDIO = 50;

export type ConnectionEvent = S2SEvent | { type: "closed" } | { type: "reconnecting" };

/**
 * One live translation session with a provider. Runs in the main process so it can
 * authenticate with headers, which browser WebSockets cannot set.
 *
 * Providers cap session length (Gemini Live sends goAway before ending a session),
 * while meetings run for an hour or more, so the session transparently reopens
 * with a fresh token instead of stopping the translation.
 */
export class S2SConnection {
  private ws?: WebSocket;
  private pendingAudio: string[] = [];
  private stopped = false;
  private reconnects = 0;
  private adapter;

  constructor(
    private serverUrl: string,
    private req: SessionRequest,
    private onEvent: (e: ConnectionEvent) => void,
  ) {
    this.adapter = S2S_ADAPTERS[req.provider];
  }

  get sampleRates() {
    return { input: this.adapter.inputSampleRate, output: this.adapter.outputSampleRate };
  }

  async open() {
    const grant = await this.fetchGrant();
    if (this.stopped) return;

    const { url, headers } = this.adapter.connect(grant);
    const ws = new WebSocket(url, { headers });
    this.ws = ws;

    ws.on("open", () => {
      for (const msg of this.adapter.setup(this.req)) ws.send(JSON.stringify(msg));
      for (const msg of this.pendingAudio.splice(0)) ws.send(msg);
      this.reconnects = 0;
    });
    ws.on("message", (raw) => {
      for (const event of this.adapter.parse(JSON.parse(raw.toString()))) {
        if (event.type === "go_away") void this.reconnect(ws);
        else this.onEvent(event);
      }
    });
    ws.on("error", (e) => this.onEvent({ type: "error", message: e.message }));
    ws.on("close", (code, reason) => {
      if (this.ws !== ws || this.stopped) return;
      if (code === 1000) return this.finish();
      if (this.reconnects >= MAX_RECONNECTS) {
        this.onEvent({ type: "error", message: `Koneksi provider ditutup (${code}) ${reason}` });
        return this.finish();
      }
      void this.reconnect(ws);
    });
  }

  sendAudio(pcm: Uint8Array) {
    const msg = JSON.stringify(this.adapter.audio(pcm));
    if (this.ws?.readyState === WebSocket.OPEN) return this.ws.send(msg);
    this.pendingAudio.push(msg);
    if (this.pendingAudio.length > MAX_PENDING_AUDIO) this.pendingAudio.shift();
  }

  close() {
    this.stopped = true;
    this.ws?.close(1000);
    this.onEvent({ type: "closed" });
  }

  private async reconnect(old: WebSocket) {
    if (this.ws !== old || this.stopped) return;
    this.reconnects += 1;
    this.ws = undefined;
    old.removeAllListeners("close");
    old.close(1000);
    this.onEvent({ type: "reconnecting" });
    try {
      await this.open();
    } catch (e) {
      this.onEvent({ type: "error", message: (e as Error).message });
      this.finish();
    }
  }

  private finish() {
    if (this.stopped) return;
    this.stopped = true;
    this.onEvent({ type: "closed" });
  }

  private async fetchGrant(): Promise<SessionGrant> {
    const res = await fetch(`${this.serverUrl.replace(/\/$/, "")}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(this.req),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
    return body as SessionGrant;
  }
}
