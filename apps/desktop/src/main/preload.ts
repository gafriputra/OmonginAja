import { contextBridge, ipcRenderer } from "electron";
import type { SessionRequest } from "@omonginaja/shared";
import type { ConnectionEvent } from "./s2s";

export interface SubtitleLine {
  original: string;
  translated: string;
}

contextBridge.exposeInMainWorld("omongin", {
  showSubtitle: (line: SubtitleLine) => ipcRenderer.send("subtitle", line),
  onSubtitle: (cb: (line: SubtitleLine) => void) => {
    ipcRenderer.on("subtitle", (_e, line: SubtitleLine) => cb(line));
  },
  s2s: {
    start: (id: string, serverUrl: string, req: SessionRequest): Promise<{ input: number; output: number }> =>
      ipcRenderer.invoke("s2s:start", id, serverUrl, req),
    audio: (id: string, pcm: Uint8Array) => ipcRenderer.send("s2s:audio", id, pcm),
    stop: (id: string) => ipcRenderer.send("s2s:stop", id),
    onEvent: (cb: (id: string, event: ConnectionEvent) => void) => {
      ipcRenderer.on("s2s:event", (_e, id, event) => cb(id, event));
    },
  },
});
