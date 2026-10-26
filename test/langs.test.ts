import { describe, it, expect } from 'vitest'
import { LANGS, TRANSLATABLE_LANGS, codeForLanguageName, languageNameForCode, parseLocale, speaksLocale, localesForLanguages, isLangCode } from '../src/lib/langs'

describe('LANGS', () => {
  it('has the 10 site languages with en first, incl. pa and gu', () => {
    expect(LANGS.map((l) => l.code)).toEqual(['en', 'hi', 'ta', 'te', 'mr', 'kn', 'bn', 'ml', 'pa', 'gu'])
    expect(TRANSLATABLE_LANGS.map((l) => l.code)).not.toContain('en')
    expect(TRANSLATABLE_LANGS).toHaveLength(9)
    expect(LANGS.find((l) => l.code === 'kn')).toMatchObject({ name: 'Kannada', native: 'ಕನ್ನಡ', hreflang: 'kn-IN' })
  })
})

describe('codeForLanguageName / languageNameForCode', () => {
  it('maps English names to codes case-insensitively', () => {
    expect(codeForLanguageName('Hindi')).toBe('hi')
    expect(codeForLanguageName('hindi')).toBe('hi')
    expect(codeForLanguageName('  KANNADA ')).toBe('kn')
    expect(codeForLanguageName('Punjabi')).toBe('pa')
    expect(codeForLanguageName('Gujarati')).toBe('gu')
  })
  it('returns null for unknown or empty names', () => {
    expect(codeForLanguageName('Urdu')).toBeNull()
    expect(codeForLanguageName('')).toBeNull()
  })
  it('round-trips codes to names', () => {
    for (const l of LANGS) expect(languageNameForCode(l.code)).toBe(l.name)
    expect(languageNameForCode('xx')).toBeNull()
  })
})

describe('parseLocale', () => {
  it('defaults to en and accepts site codes', () => {
    expect(parseLocale(undefined)).toBe('en')
    expect(parseLocale('')).toBe('en')
    expect(parseLocale('hi')).toBe('hi')
    expect(parseLocale('KN')).toBe('kn')
  })
  it('rejects unknown locales', () => {
    expect(parseLocale('fr')).toBeNull()
    expect(parseLocale('hindi')).toBeNull()
    expect(isLangCode('en')).toBe(true)
    expect(isLangCode('xx')).toBe(false)
  })
})

describe('speaksLocale / localesForLanguages', () => {
  const langs = ['Hindi', 'English', 'kannada', 'Urdu']
  it('en always matches; other locales need the spoken language', () => {
    expect(speaksLocale(langs, 'en')).toBe(true)
    expect(speaksLocale(langs, 'hi')).toBe(true)
    expect(speaksLocale(langs, 'kn')).toBe(true)
    expect(speaksLocale(langs, 'ta')).toBe(false)
    expect(speaksLocale([], 'hi')).toBe(false)
  })
  it('availableLocales = en + spoken site languages in LANGS order, no duplicates, non-site languages ignored', () => {
    expect(localesForLanguages(['Kannada', 'Hindi', 'Urdu', 'hindi'])).toEqual(['en', 'hi', 'kn'])
    expect(localesForLanguages([])).toEqual(['en'])
    expect(localesForLanguages(['English'])).toEqual(['en'])
  })
})
