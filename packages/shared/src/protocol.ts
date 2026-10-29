import type { LanguageCode } from "./languages.js";

/**
 * A session has two independent audio directions:
 * - "outgoing": the user's mic -> translated speech played into the virtual mic
 * - "incoming": meeting audio from the virtual speaker -> translated subtitles
 */
export type Direction = "outgoing" | "incoming";

/** Audio frames are sent as binary WebSocket messages: 16-bit PCM, mono, 16 kHz. */
export const AUDIO_SAMPLE_RATE = 16000;

export type ClientMessage =
  | {
      type: "start";
      direction: Direction;
      sourceLang: LanguageCode | "auto";
      targetLang: LanguageCode;
      /** Synthesize translated speech (always true for outgoing). */
      speak: boolean;
    }
  | { type: "stop" };

export type ServerMessage =
  | { type: "ready"; sessionId: string }
  | { type: "transcript"; text: string; lang: string; final: boolean }
  | { type: "translation"; text: string; lang: LanguageCode; latencyMs: number }
  /** Followed by binary frames of PCM audio for this utterance, then "speech_end". */
  | { type: "speech_start"; utteranceId: string; sampleRate: number }
  | { type: "speech_end"; utteranceId: string }
  | { type: "error"; message: string };
