/**
 * Doctor form parsing + validation shared by /admin/doctors and /admin/import/review.
 * Returns either a validated record ready for SQL or a list of errors.
 */
import { splitList, str, toInt, bool, type SqlValue } from './db'

export type DoctorInput = {
  name: string
  gender: 'male' | 'female' | 'other'
  patients_treated: 'men' | 'women' | 'both'
  qualifications: string[]
  registration_number: string | null
  registration_council: string | null
  is_verified: number
  experience_years: number | null
  languages: string[]
  bio: string | null
  video_consult: number
  video_fee: number | null
  phone: string | null
  whatsapp: string | null
  email: string | null
  website: string | null
  google_maps_url: string | null
  is_published: number
  specialty_ids: string[]
  primary_specialty_id: string | null
  condition_ids: string[]
}

type Body = Record<string, string | File | (string | File)[]>

function field(body: Body, key: string): string | undefined {
  const v = body[key]
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined
  return typeof v === 'string' ? v : undefined
}

function fields(body: Body, key: string): string[] {
  const v = body[`${key}[]`] ?? body[key]
  if (v === undefined) return []
  return (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === 'string' && x !== '')
}

export function parseDoctorForm(body: Body, prefix = 'doctor_'): { ok: true; value: DoctorInput } | { ok: false; errors: string[] } {
  const f = (k: string) => field(body, prefix + k)
  const errors: string[] = []
  const name = str(f('name'))
  if (!name || name.length < 3) errors.push('Doctor name is required (min 3 characters).')
  const gender = f('gender')
  if (gender !== 'male' && gender !== 'female' && gender !== 'other') errors.push('Gender is required.')
  const patients = f('patients_treated') || 'both'
  if (patients !== 'men' && patients !== 'women' && patients !== 'both') errors.push('Invalid patients_treated value.')
  const registration_number = str(f('registration_number'))
  const is_verified = bool(f('is_verified'))
  if (is_verified && !registration_number) errors.push('A doctor can only be marked verified when a registration number is filled.')
  const experience_years = toInt(f('experience_years'))
  if (experience_years !== null && (experience_years < 0 || experience_years > 70)) errors.push('Experience must be between 0 and 70 years.')
  const video_fee = toInt(f('video_fee'))
  if (video_fee !== null && (video_fee < 0 || video_fee > 100000)) errors.push('Video fee is out of range.')
  const website = str(f('website'))
  if (website && !/^https?:\/\//i.test(website)) errors.push('Website must start with http:// or https://')
  const email = str(f('email'))
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Email address looks invalid.')
  const specialty_ids = fields(body, prefix + 'specialties')
  if (!specialty_ids.length) errors.push('Select at least one specialty.')
  let primary = str(f('primary_specialty')) ?? null
  if (primary && !specialty_ids.includes(primary)) primary = null
  if (!primary) primary = specialty_ids[0] ?? null

  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      name: name!,
      gender: gender as DoctorInput['gender'],
      patients_treated: patients as DoctorInput['patients_treated'],
      qualifications: splitList(f('qualifications')),
      registration_number,
      registration_council: str(f('registration_council')),
      is_verified,
      experience_years,
      languages: splitList(f('languages')),
      bio: str(f('bio')),
      video_consult: bool(f('video_consult')),
      video_fee,
      phone: str(f('phone')),
      whatsapp: str(f('whatsapp')),
      email,
      website,
      google_maps_url: str(f('google_maps_url')),
      is_published: bool(f('is_published')),
      specialty_ids,
      primary_specialty_id: primary,
      condition_ids: fields(body, prefix + 'conditions'),
    },
  }
}

/** Column list + bound values for INSERT/UPDATE of a doctor (excluding id/slug/source/created_by). */
export function doctorColumns(d: DoctorInput, verifiedBy: string | null): { cols: string[]; vals: SqlValue[] } {
  const cols = [
    'name', 'gender', 'patients_treated', 'qualifications', 'registration_number', 'registration_council', 'is_verified',
    'experience_years', 'languages', 'bio', 'video_consult', 'video_fee', 'phone', 'whatsapp', 'email', 'website', 'google_maps_url', 'is_published',
  ]
  const vals: SqlValue[] = [
    d.name, d.gender, d.patients_treated, JSON.stringify(d.qualifications), d.registration_number, d.registration_council, d.is_verified,
    d.experience_years, JSON.stringify(d.languages), d.bio, d.video_consult, d.video_fee, d.phone, d.whatsapp, d.email, d.website, d.google_maps_url, d.is_published,
  ]
  if (d.is_verified) {
    cols.push('verified_at', 'verified_by')
    vals.push(new Date().toISOString(), verifiedBy)
  }
  return { cols, vals }
}

/** Statements that replace a doctor's specialties and conditions. */
export function relationStatements(db: D1Database, doctorId: string, d: DoctorInput): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [
    db.prepare('DELETE FROM doctor_specialties WHERE doctor_id = ?').bind(doctorId),
    db.prepare('DELETE FROM doctor_conditions WHERE doctor_id = ?').bind(doctorId),
  ]
  for (const sid of d.specialty_ids) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO doctor_specialties (doctor_id, specialty_id, is_primary) SELECT ?, id, ? FROM specialties WHERE id = ?').bind(doctorId, sid === d.primary_specialty_id ? 1 : 0, sid))
  }
  for (const cid of d.condition_ids) {
    stmts.push(db.prepare('INSERT OR IGNORE INTO doctor_conditions (doctor_id, condition_id) SELECT ?, id FROM conditions WHERE id = ?').bind(doctorId, cid))
  }
  return stmts
}
