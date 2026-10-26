import { describe, it, expect } from 'vitest'
import { parseDoctorForm } from '../src/lib/doctorForm'

const base = {
  doctor_name: 'Dr. Meera Nair',
  doctor_gender: 'female',
  doctor_patients_treated: 'women',
  'doctor_specialties[]': ['sp_sexologist', 'sp_gynecologist'],
  doctor_primary_specialty: 'sp_gynecologist',
  doctor_qualifications: 'MBBS, MD (OBG)',
  doctor_languages: 'Malayalam, English',
}

describe('parseDoctorForm', () => {
  it('parses a valid form', () => {
    const r = parseDoctorForm({ ...base, doctor_experience_years: '12', doctor_is_published: 'on' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.qualifications).toEqual(['MBBS', 'MD (OBG)'])
    expect(r.value.primary_specialty_id).toBe('sp_gynecologist')
    expect(r.value.patients_treated).toBe('women')
    expect(r.value.is_published).toBe(1)
    expect(r.value.is_verified).toBe(0)
  })

  it('refuses verified without a registration number (server-side guard)', () => {
    const r = parseDoctorForm({ ...base, doctor_is_verified: 'on' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors.join(' ')).toMatch(/registration number/)
    const ok = parseDoctorForm({ ...base, doctor_is_verified: 'on', doctor_registration_number: 'DMC/12345' })
    expect(ok.ok).toBe(true)
  })

  it('requires name, gender and a specialty', () => {
    const r = parseDoctorForm({ doctor_name: 'X' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toHaveLength(3)
  })

  it('falls back to the first selected specialty when the primary is not selected', () => {
    const r = parseDoctorForm({ ...base, doctor_primary_specialty: 'sp_urologist' })
    expect(r.ok && r.value.primary_specialty_id).toBe('sp_sexologist')
  })
})
