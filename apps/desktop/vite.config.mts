import { spawn, type ChildProcess } from "node:child_process";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/**
 * In `npm run dev`, start Electron once the dev server is listening and point it at the URL
 * Vite actually bound. Waiting on a fixed port instead either hangs (Vite moved to another
 * port) or loads someone else's dev server that already holds it.
 */
function launchElectron(): Plugin {
  let app: ChildProcess | undefined;
  return {
    name: "omonginaja:launch-electron",
    apply: "serve",
    configureServer(server) {
      if (!process.env.OMONGIN_LAUNCH_ELECTRON) return;
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        if (!address || typeof address === "string" || app) return;
        const url = `http://localhost:${address.port}/`;
        // npm scripts put node_modules/.bin on PATH, so "electron" resolves to the local binary.
        app = spawn("electron", ["."], {
          stdio: "inherit",
          shell: process.platform === "win32",
          env: { ...process.env, VITE_DEV_SERVER_URL: url },
        });
        app.on("exit", (code) => {
          void server.close();
          process.exit(code ?? 0);
        });
      });
    },
  };
}

export default defineConfig({
  root: "src/renderer",
  base: "./",
  plugins: [react(), launchElectron()],
  build: { outDir: "../../dist/renderer", emptyOutDir: true },
  // Not the Vite default (5173); if it is taken anyway, Vite picks the next free port and Electron follows.
  server: { port: 5317 },
});
