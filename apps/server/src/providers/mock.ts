import type { LanguageCode } from "@omonginaja/shared";
import { AUDIO_SAMPLE_RATE } from "@omonginaja/shared";
import type { Providers, SpeechToText, TextToSpeech, Translator } from "./types.js";

const BYTES_PER_SECOND = AUDIO_SAMPLE_RATE * 2;

/** Emits a final transcript for every 2 seconds of audio received. */
class MockStt implements SpeechToText {
  open(lang: LanguageCode | "auto", onTranscript: (t: { text: string; lang: string; final: boolean }) => void) {
    let buffered = 0;
    let count = 0;
    return {
      write(chunk: Buffer) {
        buffered += chunk.length;
        while (buffered >= BYTES_PER_SECOND * 2) {
          buffered -= BYTES_PER_SECOND * 2;
          count += 1;
          onTranscript({ text: `ucapan contoh nomor ${count}`, lang: lang === "auto" ? "id" : lang, final: true });
        }
      },
      close() {},
    };
  }
}

class MockTranslator implements Translator {
  async translate(text: string, _from: string, to: LanguageCode) {
    return `[${to}] ${text}`;
  }
}

/** A short 440 Hz beep in place of real speech. */
class MockTts implements TextToSpeech {
  readonly sampleRate = AUDIO_SAMPLE_RATE;
  async *synthesize() {
    const samples = Math.floor(this.sampleRate * 0.3);
    const buf = Buffer.alloc(samples * 2);
    for (let i = 0; i < samples; i++) {
      buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 440 * i) / this.sampleRate) * 8000), i * 2);
    }
    yield buf;
  }
}

export function mockProviders(): Providers {
  return { stt: new MockStt(), translator: new MockTranslator(), tts: new MockTts() };
}
