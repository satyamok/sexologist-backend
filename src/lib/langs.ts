/**
 * Site languages. `doctors.languages` stores English names ("Hindi"); the public API and the
 * translation tables use the two-letter code. Matching on the English name is case-insensitive.
 * Shared contract with the frontend (I18N-SPEC.md): do not rename codes or fields.
 */

export type LangCode = 'en' | 'hi' | 'ta' | 'te' | 'mr' | 'kn' | 'bn' | 'ml' | 'pa' | 'gu'

export type Lang = { code: LangCode; name: string; native: string; hreflang: string }

export const LANGS: readonly Lang[] = [
  { code: 'en', name: 'English', native: 'English', hreflang: 'en-IN' },
  { code: 'hi', name: 'Hindi', native: 'हिन्दी', hreflang: 'hi-IN' },
  { code: 'ta', name: 'Tamil', native: 'தமிழ்', hreflang: 'ta-IN' },
  { code: 'te', name: 'Telugu', native: 'తెలుగు', hreflang: 'te-IN' },
  { code: 'mr', name: 'Marathi', native: 'मराठी', hreflang: 'mr-IN' },
  { code: 'kn', name: 'Kannada', native: 'ಕನ್ನಡ', hreflang: 'kn-IN' },
  { code: 'bn', name: 'Bengali', native: 'বাংলা', hreflang: 'bn-IN' },
  { code: 'ml', name: 'Malayalam', native: 'മലയാളം', hreflang: 'ml-IN' },
  { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ', hreflang: 'pa-IN' },
  { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી', hreflang: 'gu-IN' },
]

/** Languages that can carry translations (everything but English). */
export const TRANSLATABLE_LANGS: readonly Lang[] = LANGS.filter((l) => l.code !== 'en')

export const LANG_CODES: readonly LangCode[] = LANGS.map((l) => l.code)

export function isLangCode(v: unknown): v is LangCode {
  return typeof v === 'string' && (LANG_CODES as readonly string[]).includes(v)
}

/** "hindi" / "Hindi" / " HINDI " → 'hi'; unknown names (e.g. "Urdu") → null. */
export function codeForLanguageName(name: string): LangCode | null {
  const n = name.trim().toLowerCase()
  if (!n) return null
  return LANGS.find((l) => l.name.toLowerCase() === n)?.code ?? null
}

/** 'hi' → "Hindi"; unknown code → null. */
export function languageNameForCode(code: string): string | null {
  return LANGS.find((l) => l.code === code)?.name ?? null
}

/**
 * Parse the `locale=` query parameter. Missing/empty → 'en'. Anything that is not a site
 * language → null (the route answers 400).
 */
export function parseLocale(raw: string | undefined | null): LangCode | null {
  if (raw === undefined || raw === null || raw === '') return 'en'
  const v = raw.trim().toLowerCase()
  return isLangCode(v) ? v : null
}

/** True when the doctor's spoken-language list (English names) covers the locale. 'en' always matches. */
export function speaksLocale(languages: readonly string[], locale: LangCode): boolean {
  if (locale === 'en') return true
  return languages.some((l) => codeForLanguageName(l) === locale)
}

/**
 * Site locales a doctor can appear under: 'en' plus the codes of the spoken languages that are
 * site languages, in LANGS order, without duplicates.
 */
export function localesForLanguages(languages: readonly string[]): LangCode[] {
  const set = new Set<LangCode>(['en'])
  for (const l of languages) {
    const code = codeForLanguageName(l)
    if (code) set.add(code)
  }
  return LANG_CODES.filter((c) => set.has(c))
}
