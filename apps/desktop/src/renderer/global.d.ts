interface SubtitleLine {
  original: string;
  translated: string;
}

interface Window {
  omongin: {
    showSubtitle(line: SubtitleLine): void;
    onSubtitle(cb: (line: SubtitleLine) => void): void;
  };
}

interface AudioContext {
  setSinkId(sinkId: string): Promise<void>;
}
