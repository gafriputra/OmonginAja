import assert from "node:assert/strict";
import { test } from "node:test";
import { geminiAdapter, openaiAdapter } from "./s2s.js";

const pcm = new Uint8Array([1, 2, 3, 250]);
const b64 = Buffer.from(pcm).toString("base64");

test("gemini: audio is sent as base64 16 kHz PCM and server content becomes events", () => {
  assert.deepEqual(geminiAdapter.audio(pcm), { realtimeInput: { audio: { data: b64, mimeType: "audio/pcm;rate=16000" } } });
  const events = geminiAdapter.parse({
    serverContent: {
      inputTranscription: { text: "halo" },
      outputTranscription: { text: "hello" },
      modelTurn: { parts: [{ inlineData: { data: b64 } }] },
    },
  });
  assert.deepEqual(events, [
    { type: "source_text", text: "halo" },
    { type: "translated_text", text: "hello" },
    { type: "audio", pcm },
  ]);
});

test("gemini: setup locks the target language", () => {
  const [setup] = geminiAdapter.setup("ja") as { setup: { generationConfig: { translationConfig: { targetLanguageCode: string } } } }[];
  assert.equal(setup.setup.generationConfig.translationConfig.targetLanguageCode, "ja");
});

test("openai: audio deltas and transcripts become events", () => {
  assert.deepEqual(openaiAdapter.audio(pcm), { type: "session.input_audio_buffer.append", audio: b64 });
  assert.deepEqual(openaiAdapter.parse({ type: "session.output_audio.delta", delta: b64 }), [{ type: "audio", pcm }]);
  assert.deepEqual(openaiAdapter.parse({ type: "session.input_transcript.delta", delta: "halo" }), [{ type: "source_text", text: "halo" }]);
  assert.deepEqual(openaiAdapter.parse({ type: "session.output_transcript.delta", delta: "hello" }), [{ type: "translated_text", text: "hello" }]);
  assert.deepEqual(openaiAdapter.parse({ type: "session.created" }), []);
});

test("openai: client secret is sent as a bearer token", () => {
  const { headers } = openaiAdapter.connect({ provider: "openai", targetLang: "en", token: "ek_123", expiresAt: "" });
  assert.equal(headers.Authorization, "Bearer ek_123");
});
