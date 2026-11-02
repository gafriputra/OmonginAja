import { createServer, type Server } from "node:http";
import { isLanguageCode, isS2SProvider, type SessionRequest } from "@omonginaja/shared";
import { mintToken, type Fetch } from "./tokens.js";

export function createApp(env = process.env, fetchFn: Fetch = fetch): Server {
  return createServer(async (req, res) => {
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "GET" && req.url === "/health") return json(200, { ok: true });
    if (req.method !== "POST" || req.url !== "/session") return json(404, { error: "Not found" });

    let body: Partial<SessionRequest>;
    try {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: "Body harus JSON" });
    }
    if (!isS2SProvider(body.provider) || typeof body.targetLang !== "string" || !isLanguageCode(body.targetLang)) {
      return json(400, { error: "provider atau targetLang tidak valid" });
    }

    try {
      json(200, await mintToken({ provider: body.provider, targetLang: body.targetLang }, env, fetchFn));
    } catch (e) {
      json(502, { error: (e as Error).message });
    }
  });
}
