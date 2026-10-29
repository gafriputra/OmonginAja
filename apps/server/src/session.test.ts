import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import WebSocket from "ws";
import { AUDIO_SAMPLE_RATE, type ServerMessage } from "@omonginaja/shared";
import { createApp } from "./app.js";
import { mockProviders } from "./providers/mock.js";

test("outgoing session turns audio into transcript, translation and speech", async () => {
  const server = createApp(mockProviders()).listen(0);
  await once(server, "listening");
  const { port } = server.address() as AddressInfo;
  const ws = new WebSocket(`ws://localhost:${port}/realtime`);
  await once(ws, "open");

  const messages: ServerMessage[] = [];
  let audioBytes = 0;
  const done = new Promise<void>((resolve) => {
    ws.on("message", (data, isBinary) => {
      if (isBinary) return void (audioBytes += (data as Buffer).length);
      const msg = JSON.parse(data.toString()) as ServerMessage;
      messages.push(msg);
      if (msg.type === "speech_end") resolve();
    });
  });

  ws.send(JSON.stringify({ type: "start", direction: "outgoing", sourceLang: "id", targetLang: "en", speak: true }));
  ws.send(Buffer.alloc(AUDIO_SAMPLE_RATE * 2 * 2)); // 2 seconds of silence
  await done;

  assert.deepEqual(messages.map((m) => m.type), ["ready", "transcript", "translation", "speech_start", "speech_end"]);
  const translation = messages.find((m) => m.type === "translation");
  assert.equal(translation?.type === "translation" && translation.text, "[en] ucapan contoh nomor 1");
  assert.ok(audioBytes > 0);

  ws.close();
  server.close();
});
