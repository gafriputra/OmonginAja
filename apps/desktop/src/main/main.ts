import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";
import type { SessionRequest } from "@omonginaja/shared";
import { S2SConnection } from "./s2s";

const devServer = process.env.VITE_DEV_SERVER_URL;
let overlay: BrowserWindow | undefined;
const connections = new Map<string, S2SConnection>();

function load(win: BrowserWindow, hash = "") {
  if (devServer) win.loadURL(`${devServer}#${hash}`);
  else win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 760,
    title: "OmonginAja",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  load(win);
}

/** Always-on-top, click-through subtitle bar that sits above the meeting window. */
function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const overlayWidth = Math.min(900, width - 40);
  overlay = new BrowserWindow({
    width: overlayWidth,
    height: 140,
    x: Math.round((width - overlayWidth) / 2),
    y: height - 180,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  overlay.setIgnoreMouseEvents(true);
  overlay.setAlwaysOnTop(true, "screen-saver");
  load(overlay, "overlay");
}

ipcMain.on("subtitle", (_e, line: unknown) => overlay?.webContents.send("subtitle", line));

ipcMain.handle("s2s:start", async (e, id: string, serverUrl: string, req: SessionRequest) => {
  connections.get(id)?.close();
  const conn = new S2SConnection(req, (event) => {
    if (!e.sender.isDestroyed()) e.sender.send("s2s:event", id, event);
    if (event.type === "closed") connections.delete(id);
  });
  connections.set(id, conn);
  await conn.open(serverUrl);
  return conn.sampleRates;
});
ipcMain.on("s2s:audio", (_e, id: string, pcm: Uint8Array) => connections.get(id)?.sendAudio(pcm));
ipcMain.on("s2s:stop", (_e, id: string) => connections.get(id)?.close());

app.whenReady().then(() => {
  createMainWindow();
  createOverlay();
});

app.on("window-all-closed", () => app.quit());
