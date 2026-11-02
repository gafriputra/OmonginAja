import { GEMINI_MODEL, OPENAI_MODEL, type LanguageCode, type SessionGrant, type SessionRequest } from "@omonginaja/shared";

const TOKEN_TTL_MS = 30 * 60 * 1000;

export type Fetch = typeof fetch;

/** Mints a short-lived, single-session provider token. Provider API keys stay on the server. */
export async function mintToken(req: SessionRequest, env = process.env, fetchFn: Fetch = fetch): Promise<SessionGrant> {
  if (req.provider === "gemini") return mintGemini(req.targetLang, required(env, "GEMINI_API_KEY"), fetchFn);
  return mintOpenAI(req.targetLang, required(env, "OPENAI_API_KEY"), fetchFn);
}

async function mintGemini(targetLang: LanguageCode, apiKey: string, fetchFn: Fetch): Promise<SessionGrant> {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
  const res = await fetchFn("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
    method: "POST",
    headers: { "x-goog-api-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      uses: 1,
      expireTime: expiresAt,
      liveConnectConstraints: {
        model: `models/${GEMINI_MODEL}`,
        config: {
          responseModalities: ["AUDIO"],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          translationConfig: { targetLanguageCode: targetLang, echoTargetLanguage: false },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { name: string };
  return { provider: "gemini", targetLang, token: data.name, expiresAt };
}

async function mintOpenAI(targetLang: LanguageCode, apiKey: string, fetchFn: Fetch): Promise<SessionGrant> {
  const res = await fetchFn("https://api.openai.com/v1/realtime/translations/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      session: {
        model: OPENAI_MODEL,
        audio: {
          input: { transcription: { model: "gpt-realtime-whisper" }, noise_reduction: { type: "near_field" } },
          output: { language: targetLang },
        },
      },
    }),
  });
  if (!res.ok) throw new Error(`OpenAI token failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { value?: string; expires_at?: number; client_secret?: { value: string; expires_at: number } };
  const secret = data.client_secret ?? { value: data.value!, expires_at: data.expires_at! };
  return { provider: "openai", targetLang, token: secret.value, expiresAt: new Date(secret.expires_at * 1000).toISOString() };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`Server belum dikonfigurasi: ${name} kosong`);
  return value;
}
