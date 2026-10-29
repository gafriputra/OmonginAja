import WebSocket from "ws";
import { S2S_ADAPTERS, type S2SEvent, type SessionGrant, type SessionRequest } from "@omonginaja/shared";

/**
 * One live connection to a translation provider. Runs in the main process so it can
 * authenticate with headers, which browser WebSockets cannot set.
 */
export class S2SConnection {
  private ws?: WebSocket;
  private pending: string[] = [];
  private adapter;

  constructor(private req: SessionRequest, private onEvent: (e: S2SEvent | { type: "closed" }) => void) {
    this.adapter = S2S_ADAPTERS[req.provider];
  }

  get sampleRates() {
    return { input: this.adapter.inputSampleRate, output: this.adapter.outputSampleRate };
  }

  async open(serverUrl: string) {
    const res = await fetch(`${serverUrl.replace(/\/$/, "")}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(this.req),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
    const grant = body as SessionGrant;

    const { url, headers } = this.adapter.connect(grant);
    const ws = new WebSocket(url, { headers });
    this.ws = ws;
    for (const msg of this.adapter.setup(this.req.targetLang)) this.pending.push(JSON.stringify(msg));

    ws.on("open", () => {
      for (const msg of this.pending.splice(0)) ws.send(msg);
    });
    ws.on("message", (raw) => {
      for (const event of this.adapter.parse(JSON.parse(raw.toString()))) this.onEvent(event);
    });
    ws.on("error", (e) => this.onEvent({ type: "error", message: e.message }));
    ws.on("close", (code, reason) => {
      if (code !== 1000) this.onEvent({ type: "error", message: `Koneksi provider ditutup (${code}) ${reason}` });
      this.onEvent({ type: "closed" });
    });
  }

  sendAudio(pcm: Uint8Array) {
    const msg = JSON.stringify(this.adapter.audio(pcm));
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(msg);
    else if (this.ws?.readyState === WebSocket.CONNECTING) this.pending.push(msg);
  }

  close() {
    this.ws?.close(1000);
  }
}
