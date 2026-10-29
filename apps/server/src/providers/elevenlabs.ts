import type { TextToSpeech } from "./types.js";

/** Streaming TTS from ElevenLabs as raw 16 kHz PCM. */
export class ElevenLabsTts implements TextToSpeech {
  readonly sampleRate = 16000;

  constructor(private apiKey: string, private voiceId: string, private model = "eleven_flash_v2_5") {}

  async *synthesize(text: string) {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}/stream?output_format=pcm_16000`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": this.apiKey, "content-type": "application/json" },
      body: JSON.stringify({ text, model_id: this.model }),
    });
    if (!res.ok || !res.body) throw new Error(`TTS failed: ${res.status} ${await res.text()}`);
    for await (const chunk of res.body) yield Buffer.from(chunk);
  }
}
