import type { LanguageCode } from "./languages.js";

/** Simultaneous speech-to-speech translation models OmonginAja can use. */
export const S2S_PROVIDERS = {
  gemini: "Gemini 3.5 Live Translate",
  openai: "OpenAI gpt-realtime-translate",
} as const;

export type S2SProvider = keyof typeof S2S_PROVIDERS;

export function isS2SProvider(value: unknown): value is S2SProvider {
  return typeof value === "string" && value in S2S_PROVIDERS;
}

/**
 * Each direction is its own provider session:
 * - "outgoing": the user's mic -> translated speech played into the virtual mic
 * - "incoming": meeting audio -> translated subtitles for the user
 */
export type Direction = "outgoing" | "incoming";

/** POST /session body. The server mints a short-lived provider token so API keys never ship in the app. */
export interface SessionRequest {
  provider: S2SProvider;
  targetLang: LanguageCode;
}

export interface SessionGrant {
  provider: S2SProvider;
  targetLang: LanguageCode;
  token: string;
  /** ISO timestamp; the token must be used to connect before then. */
  expiresAt: string;
}
