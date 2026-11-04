import type { Line } from "./storage";

export function LineView({ line }: { line: Line }) {
  return (
    <div className={`line ${line.direction}`}>
      <span className="who">{line.direction === "outgoing" ? "Kamu" : "Mereka"}</span>
      <span className="original">{line.original}</span>
      <span className="translated">{line.translated}</span>
    </div>
  );
}
