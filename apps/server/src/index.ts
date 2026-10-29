import "dotenv/config";
import { createApp } from "./app.js";
import { createProviders } from "./providers/index.js";

const port = Number(process.env.PORT ?? 8787);
const mode = process.env.PIPELINE_MODE ?? "mock";

createApp(createProviders(mode)).listen(port, () => {
  console.log(`OmonginAja server on :${port} (pipeline: ${mode}), WebSocket at /realtime`);
});
