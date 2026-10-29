import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { createApp } from "./app.js";
import type { Fetch } from "./tokens.js";

async function withServer(fetchFn: Fetch, run: (url: string, calls: { url: string; body: any }[]) => Promise<void>) {
  const calls: { url: string; body: any }[] = [];
  const recording: Fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
    return fetchFn(url, init);
  };
  const server = createApp({ GEMINI_API_KEY: "g-key", OPENAI_API_KEY: "o-key" }, recording).listen(0);
  await once(server, "listening");
  try {
    await run(`http://localhost:${(server.address() as AddressInfo).port}`, calls);
  } finally {
    server.close();
  }
}

const post = (url: string, body: unknown) =>
  fetch(`${url}/session`, { method: "POST", body: JSON.stringify(body) });

test("gemini session returns an ephemeral token locked to the target language", async () => {
  await withServer(async () => Response.json({ name: "auth_tokens/abc" }), async (url, calls) => {
    const res = await post(url, { provider: "gemini", targetLang: "ja" });
    assert.equal(res.status, 200);
    const grant = await res.json();
    assert.equal(grant.token, "auth_tokens/abc");
    assert.equal(calls[0].body.liveConnectConstraints.config.translationConfig.targetLanguageCode, "ja");
  });
});

test("openai session returns the client secret", async () => {
  await withServer(async () => Response.json({ value: "ek_1", expires_at: 1_900_000_000 }), async (url, calls) => {
    const grant = await (await post(url, { provider: "openai", targetLang: "en" })).json();
    assert.equal(grant.token, "ek_1");
    assert.equal(grant.expiresAt, new Date(1_900_000_000_000).toISOString());
    assert.equal(calls[0].body.session.audio.output.language, "en");
  });
});

test("invalid requests and provider failures are reported", async () => {
  await withServer(async () => new Response("nope", { status: 401 }), async (url) => {
    assert.equal((await post(url, { provider: "deepl", targetLang: "en" })).status, 400);
    const res = await post(url, { provider: "openai", targetLang: "en" });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /401/);
  });
});
