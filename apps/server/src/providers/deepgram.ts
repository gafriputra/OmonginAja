import WebSocket from "ws";
import type { LanguageCode } from "@omonginaja/shared";
import { AUDIO_SAMPLE_RATE } from "@omonginaja/shared";
import type { SpeechToText, Transcript } from "./types.js";

/** Streaming STT over Deepgram's live WebSocket API. */
export class DeepgramStt implements SpeechToText {
  constructor(private apiKey: string, private model = "nova-3") {}

  open(lang: LanguageCode | "auto", onTranscript: (t: Transcript) => void, onError: (e: Error) => void) {
    const params = new URLSearchParams({
      model: this.model,
      encoding: "linear16",
      sample_rate: String(AUDIO_SAMPLE_RATE),
      channels: "1",
      interim_results: "true",
      endpointing: "300",
      smart_format: "true",
      language: lang === "auto" ? "multi" : lang,
    });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });
    const pending: Buffer[] = [];

    ws.on("open", () => {
      for (const chunk of pending.splice(0)) ws.send(chunk);
    });
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type !== "Results") return;
      const alt = msg.channel?.alternatives?.[0];
      if (!alt?.transcript) return;
      onTranscript({
        text: alt.transcript,
        lang: alt.languages?.[0] ?? (lang === "auto" ? "unknown" : lang),
        final: Boolean(msg.is_final && msg.speech_final),
      });
    });
    ws.on("error", onError);

    return {
      write(chunk: Buffer) {
        if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
        else if (ws.readyState === WebSocket.CONNECTING) pending.push(chunk);
      },
      close() {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "CloseStream" }));
        ws.close();
      },
    };
  }
}
