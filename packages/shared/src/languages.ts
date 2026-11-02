export const LANGUAGES = {
  id: "Bahasa Indonesia",
  en: "English",
  zh: "中文",
  ja: "日本語",
  ko: "한국어",
  ar: "العربية",
} as const;

export type LanguageCode = keyof typeof LANGUAGES;

export function isLanguageCode(value: string): value is LanguageCode {
  return value in LANGUAGES;
}
