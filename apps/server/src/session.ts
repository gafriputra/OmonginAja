import { randomUUID } from "node:crypto";
import type { WebSocket } from "ws";
import { isLanguageCode, type ClientMessage, type LanguageCode, type ServerMessage } from "@omonginaja/shared";
import type { Providers } from "./providers/index.js";
import type { SttStream } from "./providers/types.js";

/**
 * One WebSocket connection = one audio direction.
 * Binary frames in: PCM audio. JSON + binary frames out: transcripts, translations, speech.
 */
export class TranslationSession {
  readonly id = randomUUID();
  private stt?: SttStream;
  /** Utterances are translated and spoken in the order they were heard. */
  private queue: Promise<void> = Promise.resolve();

  constructor(private ws: WebSocket, private providers: Providers) {
    ws.on("message", (data, isBinary) => {
      if (isBinary) this.stt?.write(data as Buffer);
      else this.handle(JSON.parse(data.toString()) as ClientMessage);
    });
    ws.on("close", () => this.stop());
  }

  private send(msg: ServerMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  private handle(msg: ClientMessage) {
    if (msg.type === "stop") return this.stop();
    if (msg.type !== "start") return;
    if (!isLanguageCode(msg.targetLang) || (msg.sourceLang !== "auto" && !isLanguageCode(msg.sourceLang))) {
      return this.send({ type: "error", message: "Unsupported language" });
    }

    this.stop();
    const speak = msg.direction === "outgoing" || msg.speak;
    this.stt = this.providers.stt.open(
      msg.sourceLang,
      (t) => {
        this.send({ type: "transcript", ...t });
        if (t.final && t.text.trim()) {
          const heardAt = Date.now();
          this.queue = this.queue.then(() => this.translate(t.text, t.lang, msg.targetLang, speak, heardAt));
        }
      },
      (e) => this.send({ type: "error", message: e.message }),
    );
    this.send({ type: "ready", sessionId: this.id });
  }

  private async translate(text: string, from: string, to: LanguageCode, speak: boolean, heardAt: number) {
    try {
      const translated = await this.providers.translator.translate(text, from, to);
      this.send({ type: "translation", text: translated, lang: to, latencyMs: Date.now() - heardAt });
      if (!speak) return;
      const utteranceId = randomUUID();
      this.send({ type: "speech_start", utteranceId, sampleRate: this.providers.tts.sampleRate });
      for await (const chunk of this.providers.tts.synthesize(translated, to)) this.ws.send(chunk);
      this.send({ type: "speech_end", utteranceId });
    } catch (e) {
      this.send({ type: "error", message: (e as Error).message });
    }
  }

  stop() {
    this.stt?.close();
    this.stt = undefined;
  }
}
