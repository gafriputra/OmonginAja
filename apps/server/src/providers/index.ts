import { ClaudeTranslator } from "./anthropic.js";
import { DeepgramStt } from "./deepgram.js";
import { ElevenLabsTts } from "./elevenlabs.js";
import { mockProviders } from "./mock.js";
import type { Providers } from "./types.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name} (needed when PIPELINE_MODE=live)`);
  return value;
}

export function createProviders(mode = process.env.PIPELINE_MODE ?? "mock"): Providers {
  if (mode === "mock") return mockProviders();
  return {
    stt: new DeepgramStt(required("DEEPGRAM_API_KEY")),
    translator: new ClaudeTranslator(required("ANTHROPIC_API_KEY"), process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5"),
    tts: new ElevenLabsTts(required("ELEVENLABS_API_KEY"), required("ELEVENLABS_VOICE_ID")),
  };
}

export type { Providers } from "./types.js";
