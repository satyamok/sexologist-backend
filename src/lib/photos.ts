/**
 * Clinic photo galleries (table `photos`). The doctor's profile picture is NOT a gallery photo:
 * it lives in doctors.photo_key and is managed on the doctor page.
 *
 * clinics.photo_key is the denormalised cover = first gallery photo; every gallery write goes through
 * `syncCoverStmt` so it never drifts.
 */
import { all, uuid } from './db'

export const MAX_PHOTOS_PER_CLINIC = 12

export type PhotoRow = {
  id: string
  owner_type: 'clinic' | 'doctor'
  owner_id: string
  key: string
  caption: string | null
  attribution: string | null
  sort_order: number
  created_at: string
}

export type PhotoJson = { url: string; caption: string | null; attribution: string | null }

// ---------- pure helpers (unit tested) ----------

/** Stable gallery order: sort_order, then created_at, then id. */
export function orderPhotos<T extends Pick<PhotoRow, 'sort_order' | 'created_at' | 'id'>>(photos: T[]): T[] {
  return [...photos].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
}

/** Key of the cover photo (first in gallery order) or null for an empty gallery. */
export function coverKey(photos: Pick<PhotoRow, 'sort_order' | 'created_at' | 'id' | 'key'>[]): string | null {
  return orderPhotos(photos)[0]?.key ?? null
}

/**
 * Returns the ids in their new order after moving `id` one step, or making it the cover (`'cover'`).
 * Unknown id or a no-op move returns the current order unchanged.
 */
export function reorderIds(orderedIds: string[], id: string, action: 'up' | 'down' | 'cover'): string[] {
  const i = orderedIds.indexOf(id)
  if (i < 0) return orderedIds
  const out = [...orderedIds]
  if (action === 'cover') {
    out.splice(i, 1)
    out.unshift(id)
    return out
  }
  const j = action === 'up' ? i - 1 : i + 1
  if (j < 0 || j >= out.length) return orderedIds
  ;[out[i], out[j]] = [out[j]!, out[i]!]
  return out
}

/** How many of `incoming` uploads fit under the per-clinic limit. */
export function remainingSlots(existingCount: number, incoming: number, max = MAX_PHOTOS_PER_CLINIC): number {
  return Math.max(0, Math.min(incoming, max - existingCount))
}

export function photosJson(photos: PhotoRow[], mediaUrl: string): PhotoJson[] {
  return orderPhotos(photos).map((p) => ({ url: `${mediaUrl}/${p.key}`, caption: p.caption, attribution: p.attribution }))
}

// ---------- D1 ----------

export async function listPhotos(db: D1Database, ownerType: 'clinic' | 'doctor', ownerId: string): Promise<PhotoRow[]> {
  return all<PhotoRow>(db, 'SELECT * FROM photos WHERE owner_type = ? AND owner_id = ? ORDER BY sort_order, created_at, id', ownerType, ownerId)
}

/** Photos for many clinics in one query, grouped by clinic id (ordered). */
export async function photosByClinic(db: D1Database, clinicIds: string[]): Promise<Map<string, PhotoRow[]>> {
  const map = new Map<string, PhotoRow[]>()
  const ids = [...new Set(clinicIds)]
  if (!ids.length) return map
  const rows = await all<PhotoRow>(db, `SELECT * FROM photos WHERE owner_type = 'clinic' AND owner_id IN (${ids.map(() => '?').join(',')}) ORDER BY sort_order, created_at, id`, ...ids)
  for (const r of rows) (map.get(r.owner_id) ?? map.set(r.owner_id, []).get(r.owner_id)!).push(r)
  return map
}

export function insertPhotoStmt(db: D1Database, p: { ownerType: 'clinic' | 'doctor'; ownerId: string; key: string; caption?: string | null; attribution?: string | null; sortOrder: number }): D1PreparedStatement {
  return db.prepare('INSERT INTO photos (id, owner_type, owner_id, key, caption, attribution, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(uuid(), p.ownerType, p.ownerId, p.key, p.caption ?? null, p.attribution ?? null, p.sortOrder)
}

/** Writes sort_order = index for the given id order (ids are scoped to the clinic to be safe). */
export function reorderStmts(db: D1Database, clinicId: string, orderedIds: string[]): D1PreparedStatement[] {
  return orderedIds.map((id, i) => db.prepare("UPDATE photos SET sort_order = ? WHERE id = ? AND owner_type = 'clinic' AND owner_id = ?").bind(i, id, clinicId))
}

/** clinics.photo_key / photo_attribution := first gallery photo (or NULL). Append to every gallery batch. */
export function syncCoverStmt(db: D1Database, clinicId: string): D1PreparedStatement {
  const first = "(SELECT %s FROM photos WHERE owner_type = 'clinic' AND owner_id = ? ORDER BY sort_order, created_at, id LIMIT 1)"
  return db
    .prepare(`UPDATE clinics SET photo_key = ${first.replace('%s', 'key')}, photo_attribution = ${first.replace('%s', 'attribution')}, updated_at = datetime('now') WHERE id = ?`)
    .bind(clinicId, clinicId, clinicId)
}
