import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react()],
  build: { outDir: "../../dist/renderer", emptyOutDir: true },
  // Not the Vite default (5173), so another project's dev server is never loaded by mistake.
  server: { port: 5317, strictPort: true },
});
