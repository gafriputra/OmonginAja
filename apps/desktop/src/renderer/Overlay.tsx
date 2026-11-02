import { useEffect, useState } from "react";

export function Overlay() {
  const [line, setLine] = useState<SubtitleLine | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    window.omongin.onSubtitle((next) => {
      setLine(next);
      clearTimeout(timer);
      timer = setTimeout(() => setLine(null), 8000);
    });
  }, []);

  if (!line) return null;
  return (
    <div className="subtitle">
      <div className="translated">{line.translated}</div>
      <div className="original">{line.original}</div>
    </div>
  );
}
