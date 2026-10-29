interface SubtitleLine {
  original: string;
  translated: string;
}

interface Window {
  omongin: {
    showSubtitle(line: SubtitleLine): void;
    onSubtitle(cb: (line: SubtitleLine) => void): void;
    s2s: {
      start(
        id: string,
        serverUrl: string,
        req: import("@omonginaja/shared").SessionRequest,
      ): Promise<{ input: number; output: number }>;
      audio(id: string, pcm: Uint8Array): void;
      stop(id: string): void;
      onEvent(cb: (id: string, event: import("@omonginaja/shared").S2SEvent | { type: "closed" }) => void): void;
    };
  };
}

interface AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}
