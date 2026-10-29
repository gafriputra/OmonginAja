import { createServer, type Server } from "node:http";
import { WebSocketServer } from "ws";
import type { Providers } from "./providers/index.js";
import { TranslationSession } from "./session.js";

export function createApp(providers: Providers): Server {
  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ server, path: "/realtime" });
  wss.on("connection", (ws) => new TranslationSession(ws, providers));
  return server;
}
