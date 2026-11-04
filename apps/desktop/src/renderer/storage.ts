import type { Direction, LanguageCode, S2SProvider, UsageLog } from "@omonginaja/shared";

export interface Line {
  direction: Direction;
  original: string;
  translated: string;
}

/** One press of "Mulai menerjemahkan" until "Berhenti". */
export interface Conversation {
  id: string;
  startedAt: number;
  provider: S2SProvider;
  myLang: LanguageCode;
  theirLang: LanguageCode;
  lines: Line[];
}

const HISTORY_KEY = "omongin.history";
const USAGE_KEY = "omongin.usage";
const MAX_CONVERSATIONS = 100;

// Storage can be unavailable or full; the app must keep working without it.
function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const loadHistory = () => read<Conversation[]>(HISTORY_KEY, []);
export const saveHistory = (history: Conversation[]) => write(HISTORY_KEY, history.slice(0, MAX_CONVERSATIONS));
export const loadUsage = () => read<UsageLog>(USAGE_KEY, {});
export const saveUsage = (usage: UsageLog) => write(USAGE_KEY, usage);
