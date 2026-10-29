import { contextBridge, ipcRenderer } from "electron";

export interface SubtitleLine {
  original: string;
  translated: string;
}

contextBridge.exposeInMainWorld("omongin", {
  showSubtitle: (line: SubtitleLine) => ipcRenderer.send("subtitle", line),
  onSubtitle: (cb: (line: SubtitleLine) => void) => {
    ipcRenderer.on("subtitle", (_e, line: SubtitleLine) => cb(line));
  },
});
