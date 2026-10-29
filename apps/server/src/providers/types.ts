import type { LanguageCode } from "@omonginaja/shared";

export interface Transcript {
  text: string;
  lang: string;
  final: boolean;
}

export interface SttStream {
  /** 16-bit PCM, mono, 16 kHz. */
  write(chunk: Buffer): void;
  close(): void;
}

export interface SpeechToText {
  open(lang: LanguageCode | "auto", onTranscript: (t: Transcript) => void, onError: (e: Error) => void): SttStream;
}

export interface Translator {
  translate(text: string, from: string, to: LanguageCode): Promise<string>;
}

export interface TextToSpeech {
  /** Yields 16-bit PCM, mono, at `sampleRate`. */
  synthesize(text: string, lang: LanguageCode): AsyncIterable<Buffer>;
  readonly sampleRate: number;
}

export interface Providers {
  stt: SpeechToText;
  translator: Translator;
  tts: TextToSpeech;
}
