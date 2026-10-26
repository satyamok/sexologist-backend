import { all, one } from './db'

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export type SlugEntity = 'doctor' | 'clinic'
const TABLE: Record<SlugEntity, string> = { doctor: 'doctors', clinic: 'clinics' }

/** Normalise user input into a slug candidate; returns null when nothing usable is left. */
export function normaliseSlug(input: string): string | null {
  const s = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return SLUG_RE.test(s) ? s : null
}

/**
 * Change an entity's slug and remember the old one so the public site can 301 it.
 * Returns an error message when the new slug is taken.
 */
export async function changeSlug(db: D1Database, entity: SlugEntity, id: string, oldSlug: string, newSlug: string): Promise<string | null> {
  if (newSlug === oldSlug) return null
  const table = TABLE[entity]
  const clash = await one<{ id: string }>(db, `SELECT id FROM ${table} WHERE slug = ?`, newSlug)
  if (clash) return `The URL "${newSlug}" is already used by another ${entity}.`
  const redirect = await one<{ entity_id: string }>(db, 'SELECT entity_id FROM slug_redirects WHERE entity = ? AND old_slug = ?', entity, newSlug)
  if (redirect && redirect.entity_id !== id) return `The URL "${newSlug}" was previously used by another ${entity} and still redirects there.`
  await db.batch([
    // Re-using one of our own old slugs: drop that redirect so it resolves directly again.
    db.prepare('DELETE FROM slug_redirects WHERE entity = ? AND old_slug = ?').bind(entity, newSlug),
    db.prepare('INSERT OR REPLACE INTO slug_redirects (entity, old_slug, entity_id) VALUES (?, ?, ?)').bind(entity, oldSlug, id),
    db.prepare(`UPDATE ${table} SET slug = ?, updated_at = datetime('now') WHERE id = ?`).bind(newSlug, id),
  ])
  return null
}

/** Current slug for an old one, or null when it never existed. Chains (a→b→c) resolve in one step. */
export async function resolveRedirect(db: D1Database, entity: SlugEntity, oldSlug: string): Promise<string | null> {
  const row = await one<{ slug: string }>(
    db,
    `SELECT t.slug FROM slug_redirects r JOIN ${TABLE[entity]} t ON t.id = r.entity_id WHERE r.entity = ? AND r.old_slug = ? AND t.is_published = 1`,
    entity,
    oldSlug,
  )
  return row?.slug ?? null
}

export async function oldSlugsFor(db: D1Database, entity: SlugEntity, id: string): Promise<string[]> {
  const rows = await all<{ old_slug: string }>(db, 'SELECT old_slug FROM slug_redirects WHERE entity = ? AND entity_id = ? ORDER BY created_at DESC', entity, id)
  return rows.map((r) => r.old_slug)
}

