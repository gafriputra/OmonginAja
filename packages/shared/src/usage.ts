import type { S2SProvider } from "./protocol.js";

/** Seconds of provider streaming per provider per local day ("YYYY-MM-DD"). */
export type UsageLog = Record<string, Partial<Record<S2SProvider, number>>>;

/**
 * Providers don't expose remaining realtime quota through the API, so the app counts what it
 * streams itself. Each direction is its own session, so with subtitles on a meeting minute costs two.
 */
export class UsageTracker {
  constructor(private log: UsageLog = {}) {}

  record(provider: S2SProvider, seconds: number, at: Date) {
    const day = dayKey(at);
    const entry = (this.log[day] ??= {});
    entry[provider] = (entry[provider] ?? 0) + seconds;
  }

  secondsOn(provider: S2SProvider, at: Date): number {
    return this.log[dayKey(at)]?.[provider] ?? 0;
  }

  secondsInMonth(provider: S2SProvider, at: Date): number {
    const month = dayKey(at).slice(0, 7);
    return Object.entries(this.log)
      .filter(([day]) => day.startsWith(month))
      .reduce((sum, [, entry]) => sum + (entry[provider] ?? 0), 0);
  }

  toJSON(): UsageLog {
    return this.log;
  }
}

function dayKey(at: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}
