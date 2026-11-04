import { config } from "dotenv";
import { createApp } from "./app.js";

// apps/server/.env first, then the repo root .env, so either location works.
config({ path: [".env", "../../.env"] });

const port = Number(process.env.PORT ?? 8787);

createApp().listen(port, () => {
  console.log(`OmonginAja token server on :${port} (POST /session)`);
  if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn("Peringatan: GEMINI_API_KEY dan OPENAI_API_KEY kosong. Isi di apps/server/.env atau .env di root repo.");
  }
});
