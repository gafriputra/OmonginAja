import { app, BrowserWindow, ipcMain, screen } from "electron";
import path from "node:path";

const devServer = process.env.VITE_DEV_SERVER_URL;
let overlay: BrowserWindow | undefined;

function load(win: BrowserWindow, hash = "") {
  if (devServer) win.loadURL(`${devServer}#${hash}`);
  else win.loadFile(path.join(__dirname, "../renderer/index.html"), { hash });
}

function createMainWindow() {
  const win = new BrowserWindow({
    width: 460,
    height: 720,
    title: "OmonginAja",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  load(win);
}

/** Always-on-top, click-through subtitle bar that sits above the meeting window. */
function createOverlay() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlay = new BrowserWindow({
    width: Math.min(900, width - 40),
    height: 140,
    x: Math.round((width - Math.min(900, width - 40)) / 2),
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

app.whenReady().then(() => {
  createMainWindow();
  createOverlay();
});

app.on("window-all-closed", () => app.quit());
