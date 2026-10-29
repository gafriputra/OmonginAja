import type { LanguageCode } from "./languages.js";
import type { S2SProvider, SessionGrant } from "./protocol.js";

/** What the app cares about from a provider stream, whichever provider it is. */
export type S2SEvent =
  | { type: "audio"; pcm: Uint8Array }
  | { type: "source_text"; text: string }
  | { type: "translated_text"; text: string }
  | { type: "error"; message: string };

/** Wire format for one simultaneous translation provider. Pure functions, no I/O. */
export interface S2SAdapter {
  /** 16-bit mono PCM rates the provider expects and returns. */
  inputSampleRate: number;
  outputSampleRate: number;
  connect(grant: SessionGrant): { url: string; headers: Record<string, string> };
  /** Messages to send right after the socket opens. */
  setup(targetLang: LanguageCode): unknown[];
  audio(pcm: Uint8Array): unknown;
  parse(message: unknown): S2SEvent[];
}

export const GEMINI_MODEL = "gemini-3.5-live-translate-preview";
export const OPENAI_MODEL = "gpt-realtime-translate";

export const geminiAdapter: S2SAdapter = {
  inputSampleRate: 16000,
  outputSampleRate: 24000,
  connect: (grant) => ({
    url:
      "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService." +
      `BidiGenerateContentConstrained?access_token=${encodeURIComponent(grant.token)}`,
    headers: {},
  }),
  setup: (targetLang) => [
    {
      setup: {
        model: `models/${GEMINI_MODEL}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: { targetLanguageCode: targetLang, echoTargetLanguage: false },
        },
      },
    },
  ],
  audio: (pcm) => ({ realtimeInput: { audio: { data: toBase64(pcm), mimeType: "audio/pcm;rate=16000" } } }),
  parse: (message) => {
    const msg = message as {
      serverContent?: {
        inputTranscription?: { text?: string };
        outputTranscription?: { text?: string };
        modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
      };
      error?: { message?: string };
    };
    const events: S2SEvent[] = [];
    const content = msg.serverContent;
    if (content?.inputTranscription?.text) events.push({ type: "source_text", text: content.inputTranscription.text });
    if (content?.outputTranscription?.text) events.push({ type: "translated_text", text: content.outputTranscription.text });
    for (const part of content?.modelTurn?.parts ?? []) {
      if (part.inlineData?.data) events.push({ type: "audio", pcm: fromBase64(part.inlineData.data) });
    }
    if (msg.error) events.push({ type: "error", message: msg.error.message ?? "Gemini error" });
    return events;
  },
};

export const openaiAdapter: S2SAdapter = {
  inputSampleRate: 24000,
  outputSampleRate: 24000,
  connect: (grant) => ({
    url: `wss://api.openai.com/v1/realtime/translations?model=${OPENAI_MODEL}`,
    headers: { Authorization: `Bearer ${grant.token}` },
  }),
  setup: (targetLang) => [
    {
      type: "session.update",
      session: {
        audio: {
          input: { transcription: { model: "gpt-realtime-whisper" }, noise_reduction: { type: "near_field" } },
          output: { language: targetLang },
        },
      },
    },
  ],
  audio: (pcm) => ({ type: "session.input_audio_buffer.append", audio: toBase64(pcm) }),
  parse: (message) => {
    const msg = message as { type?: string; delta?: string; error?: { message?: string } };
    switch (msg.type) {
      case "session.output_audio.delta":
        return msg.delta ? [{ type: "audio", pcm: fromBase64(msg.delta) }] : [];
      case "session.input_transcript.delta":
        return msg.delta ? [{ type: "source_text", text: msg.delta }] : [];
      case "session.output_transcript.delta":
        return msg.delta ? [{ type: "translated_text", text: msg.delta }] : [];
      case "error":
        return [{ type: "error", message: msg.error?.message ?? "OpenAI error" }];
      default:
        return [];
    }
  },
};

export const S2S_ADAPTERS: Record<S2SProvider, S2SAdapter> = { gemini: geminiAdapter, openai: openaiAdapter };

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function fromBase64(data: string): Uint8Array {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
