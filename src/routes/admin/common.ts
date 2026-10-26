/** Lookups shared by the admin forms. */
import { all } from '../../lib/db'

export type CityOpt = { id: string; name: string; slug: string; lat: number | null; lng: number | null }
export type AreaOpt = { id: string; city_id: string; name: string; slug: string; lat: number; lng: number; default_radius_km: number }
export type SpecialtyOpt = { id: string; name: string; slug: string }
export type ConditionOpt = { id: string; name: string; slug: string }

export async function lookups(db: D1Database) {
  const [cities, areas, specialties, conditions] = await Promise.all([
    all<CityOpt>(db, 'SELECT id, name, slug, lat, lng FROM cities ORDER BY name'),
    all<AreaOpt>(db, 'SELECT id, city_id, name, slug, lat, lng, default_radius_km FROM areas ORDER BY name'),
    all<SpecialtyOpt>(db, 'SELECT id, name, slug FROM specialties ORDER BY name'),
    all<ConditionOpt>(db, 'SELECT id, name, slug FROM conditions ORDER BY name'),
  ])
  return { cities, areas, specialties, conditions }
}

export function redirectWithFlash(path: string, flash: string): string {
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}flash=${encodeURIComponent(flash)}`
}

export const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
]

export const PATIENTS = [
  { value: 'men', label: 'Men' },
  { value: 'women', label: 'Women' },
  { value: 'both', label: 'Both men and women' },
]

export const CLINIC_TYPES = [
  { value: 'clinic', label: 'Clinic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'ayurvedic', label: 'Ayurvedic' },
  { value: 'online', label: 'Online only' },
]

/** Values of a multi-value form field (checkbox group). */
export function multi(body: Record<string, string | File | (string | File)[]>, key: string): string[] {
  const v = body[`${key}[]`] ?? body[key]
  if (v === undefined) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr.filter((x): x is string => typeof x === 'string' && x !== '')
}

export const ID_RE = /^[A-Za-z0-9_-]{1,64}$/
