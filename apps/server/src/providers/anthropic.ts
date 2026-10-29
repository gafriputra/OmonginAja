import { LANGUAGES, type LanguageCode } from "@omonginaja/shared";
import type { Translator } from "./types.js";

/** Context-aware translation with a fast Claude model via the Messages API. */
export class ClaudeTranslator implements Translator {
  constructor(private apiKey: string, private model: string) {}

  async translate(text: string, from: string, to: LanguageCode) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 512,
        system:
          `You are a live interpreter in a video call. Translate the speaker's words from ${from} into natural, ` +
          `spoken ${LANGUAGES[to]}. Keep the tone and meaning, resolve slang, and output only the translation.`,
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) throw new Error(`Translation failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
  }
}
