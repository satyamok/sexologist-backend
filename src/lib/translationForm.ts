/** Pure parsing for the admin Translations forms (unit tested). */
import { str, bool, type SqlValue } from './db'
import { TRANSLATABLE_LANGS, isLangCode, type LangCode } from './langs'

type Body = Record<string, string | File | (string | File)[]>
const field = (body: Body, k: string): string | null => {
  const v = body[k]
  return str(typeof v === 'string' ? v : undefined)
}

export type DoctorTranslationInput = { name: string | null; bio: string | null; qualifications_note: string | null; is_reviewed: number }
export type ClinicTranslationInput = { name: string | null; address: string | null; locality: string | null }

/** 'hi' … 'gu' (never 'en'), or null. */
export function translatableLang(raw: string | undefined): Exclude<LangCode, 'en'> | null {
  return raw && isLangCode(raw) && raw !== 'en' ? raw : null
}

export function parseDoctorTranslation(body: Body): DoctorTranslationInput {
  return { name: field(body, 'tr_name'), bio: field(body, 'tr_bio'), qualifications_note: field(body, 'tr_qualifications_note'), is_reviewed: bool(body.tr_is_reviewed) }
}

export function parseClinicTranslation(body: Body): ClinicTranslationInput {
  return { name: field(body, 'tr_name'), address: field(body, 'tr_address'), locality: field(body, 'tr_locality') }
}

/** A row with no text at all (and not reviewed) is deleted instead of stored. */
export function isEmptyTranslation(v: Record<string, SqlValue>): boolean {
  return Object.entries(v).every(([k, val]) => (k === 'is_reviewed' ? val === 0 : val === null))
}

/**
 * City/area "Names in other languages": one `name_<code>` input per translatable language.
 * Returns the non-blank names; blank inputs mean "delete the translation".
 */
export function parseNameTranslations(body: Body): Partial<Record<Exclude<LangCode, 'en'>, string>> {
  const out: Partial<Record<Exclude<LangCode, 'en'>, string>> = {}
  for (const l of TRANSLATABLE_LANGS) {
    const v = field(body, `name_${l.code}`)
    if (v) out[l.code as Exclude<LangCode, 'en'>] = v.slice(0, 120)
  }
  return out
}

/** Statements that make the stored names equal the submitted ones (upsert present, delete blank). */
export function nameTranslationStmts(db: D1Database, table: 'city_translations' | 'area_translations', id: string, names: Partial<Record<Exclude<LangCode, 'en'>, string>>): D1PreparedStatement[] {
  const col = table === 'city_translations' ? 'city_id' : 'area_id'
  return TRANSLATABLE_LANGS.map((l) => {
    const name = names[l.code as Exclude<LangCode, 'en'>]
    return name
      ? db.prepare(`INSERT INTO ${table} (${col}, lang, name) VALUES (?, ?, ?) ON CONFLICT (${col}, lang) DO UPDATE SET name = excluded.name`).bind(id, l.code, name)
      : db.prepare(`DELETE FROM ${table} WHERE ${col} = ? AND lang = ?`).bind(id, l.code)
  })
}
