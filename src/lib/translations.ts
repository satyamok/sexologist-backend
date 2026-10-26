/**
 * Translation lookups + merge/fallback rules for the public API, and the SQL fragment that
 * restricts doctors to those who speak a locale. Pure helpers are unit tested; the DB loaders
 * only run bound prepared statements.
 */
import { all, type SqlValue } from './db'
import { languageNameForCode, type LangCode } from './langs'

// ---------- pure ----------

/**
 * SQL condition (for a query where `doctors` is aliased `d`) keeping only doctors whose
 * `languages` JSON array contains the locale's English name, case-insensitively.
 * Returns null for 'en' (English pages show every published doctor).
 */
export function localeFilterSql(locale: LangCode, alias = 'd'): { sql: string; params: SqlValue[] } | null {
  if (locale === 'en') return null
  const name = languageNameForCode(locale)
  if (!name) return null
  return {
    sql: `EXISTS (SELECT 1 FROM json_each(${alias}.languages) je_loc WHERE lower(je_loc.value) = lower(?))`,
    params: [name],
  }
}

/** Translated value when present and non-blank, else the English original. */
export function pick<T extends string | null>(translated: string | null | undefined, original: T): T | string {
  if (typeof translated === 'string' && translated.trim() !== '') return translated
  return original
}

/**
 * Overlay a translation row on an English record, field by field. Returns the merged record and a
 * per-field `translated` map (true when the translated text was used).
 */
export function mergeTranslation<T extends Record<string, unknown>, K extends keyof T & string>(
  base: T,
  tr: Partial<Record<K, string | null>> | null | undefined,
  fields: readonly K[],
): { value: T; translated: Record<K, boolean> } {
  const value = { ...base }
  const translated = {} as Record<K, boolean>
  for (const f of fields) {
    const t = tr?.[f]
    const used = typeof t === 'string' && t.trim() !== ''
    translated[f] = used
    if (used) (value as Record<string, unknown>)[f] = t
  }
  return { value, translated }
}

// ---------- loaders ----------

export type DoctorTranslation = { doctor_id: string; lang: string; name: string | null; bio: string | null; qualifications_note: string | null; is_reviewed: number; updated_at: string }
export type ClinicTranslation = { clinic_id: string; lang: string; name: string | null; address: string | null; locality: string | null; updated_at: string }
export type NameTranslation = { id: string; name: string }

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(',')
}

export async function doctorTranslations(db: D1Database, ids: readonly string[], locale: LangCode): Promise<Map<string, DoctorTranslation>> {
  const map = new Map<string, DoctorTranslation>()
  if (locale === 'en' || ids.length === 0) return map
  const rows = await all<DoctorTranslation>(db, `SELECT * FROM doctor_translations WHERE lang = ? AND doctor_id IN (${placeholders(ids.length)})`, locale, ...ids)
  for (const r of rows) map.set(r.doctor_id, r)
  return map
}

export async function clinicTranslations(db: D1Database, ids: readonly string[], locale: LangCode): Promise<Map<string, ClinicTranslation>> {
  const map = new Map<string, ClinicTranslation>()
  if (locale === 'en' || ids.length === 0) return map
  const rows = await all<ClinicTranslation>(db, `SELECT * FROM clinic_translations WHERE lang = ? AND clinic_id IN (${placeholders(ids.length)})`, locale, ...ids)
  for (const r of rows) map.set(r.clinic_id, r)
  return map
}

/** id → translated name for cities or areas. */
export async function nameTranslations(db: D1Database, table: 'city_translations' | 'area_translations', ids: readonly string[], locale: LangCode): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const unique = [...new Set(ids)]
  if (locale === 'en' || unique.length === 0) return map
  const col = table === 'city_translations' ? 'city_id' : 'area_id'
  const rows = await all<NameTranslation>(db, `SELECT ${col} id, name FROM ${table} WHERE lang = ? AND ${col} IN (${placeholders(unique.length)})`, locale, ...unique)
  for (const r of rows) if (r.name && r.name.trim() !== '') map.set(r.id, r.name)
  return map
}

/** All name translations of one table (cities/areas lists), keyed `${id}` → name. */
export async function allNameTranslations(db: D1Database, table: 'city_translations' | 'area_translations', locale: LangCode): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (locale === 'en') return map
  const col = table === 'city_translations' ? 'city_id' : 'area_id'
  const rows = await all<NameTranslation>(db, `SELECT ${col} id, name FROM ${table} WHERE lang = ?`, locale)
  for (const r of rows) if (r.name && r.name.trim() !== '') map.set(r.id, r.name)
  return map
}
