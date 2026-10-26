/** Small helpers on top of D1 prepared statements. All SQL uses bound params. */

export type SqlValue = string | number | null

export function uuid(): string {
  return crypto.randomUUID()
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export async function one<T>(db: D1Database, sql: string, ...params: SqlValue[]): Promise<T | null> {
  const row = await db.prepare(sql).bind(...params).first<T>()
  return row ?? null
}

export async function all<T>(db: D1Database, sql: string, ...params: SqlValue[]): Promise<T[]> {
  const res = await db.prepare(sql).bind(...params).all<T>()
  return res.results
}

export async function run(db: D1Database, sql: string, ...params: SqlValue[]): Promise<D1Result> {
  return db.prepare(sql).bind(...params).run()
}

export function stmt(db: D1Database, sql: string, ...params: SqlValue[]): D1PreparedStatement {
  return db.prepare(sql).bind(...params)
}

/** Parse a JSON column that should hold a string array; tolerate junk. */
export function jsonStringArray(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw === '') return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function jsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw === '') return {}
  try {
    const v: unknown = JSON.parse(raw)
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Find a slug not yet used in `table` by appending -2, -3, ... */
export async function uniqueSlug(db: D1Database, table: 'doctors' | 'clinics', base: string, excludeId?: string): Promise<string> {
  const root = slugify(base) || 'item'
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`
    const row = await one<{ id: string }>(db, `SELECT id FROM ${table} WHERE slug = ?`, candidate)
    if (!row || row.id === excludeId) return candidate
  }
  return `${root}-${uuid().slice(0, 6)}`
}

/** Split a comma/newline separated textarea value into a trimmed string[]. */
export function splitList(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

export function toInt(v: unknown): number | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

export function toFloat(v: unknown): number | null {
  if (typeof v !== 'string' || v.trim() === '') return null
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export function str(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t === '' ? null : t
}

export function bool(v: unknown): number {
  return v === 'on' || v === '1' || v === 'true' || v === true ? 1 : 0
}
