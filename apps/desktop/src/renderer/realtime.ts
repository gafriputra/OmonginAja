import type { ClientMessage, ServerMessage } from "@omonginaja/shared";

export interface RealtimeHandlers {
  onMessage(msg: ServerMessage): void;
  onAudio(pcm: ArrayBuffer): void;
  onClose(): void;
}

/** One WebSocket per direction (outgoing / incoming). */
export class RealtimeClient {
  private ws: WebSocket;

  constructor(url: string, private handlers: RealtimeHandlers) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = (e) => {
      if (typeof e.data === "string") handlers.onMessage(JSON.parse(e.data) as ServerMessage);
      else handlers.onAudio(e.data as ArrayBuffer);
    };
    this.ws.onclose = () => handlers.onClose();
  }

  opened() {
    return new Promise<void>((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("Tidak bisa terhubung ke server")), { once: true });
    });
  }

  send(msg: ClientMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  sendAudio(pcm: ArrayBuffer) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(pcm);
  }

  close() {
    this.ws.close();
  }
}
