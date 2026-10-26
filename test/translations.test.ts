import { describe, it, expect } from 'vitest'
import { localeFilterSql, mergeTranslation, pick } from '../src/lib/translations'
import { langCountsFor, filterByLocale, translateCard, toCard, collapseByDoctor, type CandidateRow } from '../src/lib/listing'
import { parseDoctorTranslation, parseClinicTranslation, parseNameTranslations, isEmptyTranslation, translatableLang } from '../src/lib/translationForm'

function row(over: Partial<CandidateRow> & { d_id: string; c_id: string }): CandidateRow {
  return {
    d_slug: over.d_id, d_name: `Dr ${over.d_id}`, d_gender: 'male', d_patients: 'both', d_photo_key: null, d_qualifications: '["MBBS"]',
    d_reg_no: null, d_reg_council: null, d_verified: 0, d_exp: 5, d_languages: '["Hindi"]', d_video: 0, d_video_fee: null,
    d_rating: 4, d_reviews: 10, d_recommend: null, d_grating: null, d_greviews: null,
    c_slug: over.c_id, c_name: `Clinic ${over.c_id}`, c_locality: 'Saket', c_area_id: null, c_area_slug: null, c_address: 'J-Block, Saket',
    c_lat: 28.5, c_lng: 77.2, c_phone: null, c_whatsapp: null, fee: 500,
    ...over,
  }
}

describe('localeFilterSql', () => {
  it('returns null for en (every doctor is shown)', () => {
    expect(localeFilterSql('en')).toBeNull()
  })
  it('builds a bound json_each EXISTS clause on the doctor alias with the English language name', () => {
    const f = localeFilterSql('kn')
    expect(f).not.toBeNull()
    expect(f!.sql).toBe('EXISTS (SELECT 1 FROM json_each(d.languages) je_loc WHERE lower(je_loc.value) = lower(?))')
    expect(f!.params).toEqual(['Kannada'])
    expect(f!.sql.match(/\?/g)).toHaveLength(f!.params.length)
  })
  it('honours a custom alias and never interpolates the value', () => {
    const f = localeFilterSql('hi', 'doc')!
    expect(f.sql).toContain('json_each(doc.languages)')
    expect(f.sql).not.toContain('Hindi')
    expect(f.params).toEqual(['Hindi'])
  })
})

describe('mergeTranslation / pick', () => {
  const base = { name: 'Dr. Arjun Mehta', bio: 'English bio', qualifications_note: null as string | null }
  it('uses translated text where present and reports which fields were translated', () => {
    const { value, translated } = mergeTranslation(base, { name: 'डॉ. अर्जुन मेहता', bio: null, qualifications_note: '' }, ['name', 'bio', 'qualifications_note'])
    expect(value).toEqual({ name: 'डॉ. अर्जुन मेहता', bio: 'English bio', qualifications_note: null })
    expect(translated).toEqual({ name: true, bio: false, qualifications_note: false })
  })
  it('falls back entirely when there is no row', () => {
    const { value, translated } = mergeTranslation(base, null, ['name', 'bio'])
    expect(value).toEqual(base)
    expect(translated).toEqual({ name: false, bio: false })
  })
  it('does not mutate the original', () => {
    mergeTranslation(base, { name: 'x' }, ['name'])
    expect(base.name).toBe('Dr. Arjun Mehta')
  })
  it('pick treats blank/whitespace as missing', () => {
    expect(pick('  ', 'orig')).toBe('orig')
    expect(pick(undefined, null)).toBeNull()
    expect(pick('ಹೆಸರು', 'orig')).toBe('ಹೆಸರು')
  })
})

describe('filterByLocale / langCountsFor', () => {
  const rows = [
    row({ d_id: 'a', c_id: 'a1', d_languages: '["Hindi","English","Punjabi"]' }),
    row({ d_id: 'a', c_id: 'a2', d_languages: '["Hindi","English","Punjabi"]' }), // second clinic, same doctor
    row({ d_id: 'b', c_id: 'b1', d_languages: '["kannada","Hindi"]' }),
    row({ d_id: 'c', c_id: 'c1', d_languages: '["Tamil","Urdu"]' }),
    row({ d_id: 'd', c_id: 'd1', d_languages: 'not json' }),
  ]
  it('en keeps everything, other locales keep only speakers (case-insensitive)', () => {
    expect(filterByLocale(rows, 'en')).toHaveLength(5)
    expect(filterByLocale(rows, 'hi').map((r) => r.d_id)).toEqual(['a', 'a', 'b'])
    expect(filterByLocale(rows, 'kn').map((r) => r.d_id)).toEqual(['b'])
    expect(filterByLocale(rows, 'ta').map((r) => r.d_id)).toEqual(['c'])
    expect(filterByLocale(rows, 'gu')).toEqual([])
  })
  it('counts distinct doctors per language, en = all, non-site languages ignored', () => {
    const counts = langCountsFor(rows)
    expect(counts.en).toBe(4)
    expect(counts.hi).toBe(2)
    expect(counts.pa).toBe(1)
    expect(counts.kn).toBe(1)
    expect(counts.ta).toBe(1)
    expect(counts.gu).toBe(0)
    expect(Object.keys(counts).sort()).toEqual(['bn', 'en', 'gu', 'hi', 'kn', 'ml', 'mr', 'pa', 'ta', 'te'])
  })
})

describe('translateCard', () => {
  const card = toCard(collapseByDoctor([row({ d_id: 'a', c_id: 'c1' })], { center: null, areaId: null, sort: 'relevance' })[0]!, 'https://m', [], null, [])
  it('overlays doctor name and clinic fields, falling back per field', () => {
    const out = translateCard(card, { doctor_id: 'a', lang: 'hi', name: 'डॉ. ए', bio: null, qualifications_note: null, is_reviewed: 1, updated_at: '' }, { clinic_id: 'c1', lang: 'hi', name: null, address: 'जे-ब्लॉक, साकेत', locality: '', updated_at: '' })
    expect(out.name).toBe('डॉ. ए')
    expect(out.clinic.name).toBe('Clinic c1')
    expect(out.clinic.address).toBe('जे-ब्लॉक, साकेत')
    expect(out.clinic.locality).toBe('Saket')
    expect(card.name).toBe('Dr a') // untouched
  })
  it('returns the same card when nothing is translated', () => {
    expect(translateCard(card, undefined, undefined)).toBe(card)
  })
})

describe('admin translation form parsing', () => {
  it('parses doctor fields, blank → null, checkbox → 0/1', () => {
    expect(parseDoctorTranslation({ tr_name: ' डॉ. ए ', tr_bio: '', tr_qualifications_note: 'x', tr_is_reviewed: 'on' })).toEqual({ name: 'डॉ. ए', bio: null, qualifications_note: 'x', is_reviewed: 1 })
    expect(parseClinicTranslation({ tr_name: '', tr_address: 'addr', tr_locality: ' ' })).toEqual({ name: null, address: 'addr', locality: null })
  })
  it('detects rows that should be deleted', () => {
    expect(isEmptyTranslation({ name: null, bio: null, qualifications_note: null, is_reviewed: 0 })).toBe(true)
    expect(isEmptyTranslation({ name: null, bio: null, qualifications_note: null, is_reviewed: 1 })).toBe(false)
    expect(isEmptyTranslation({ name: 'x', address: null, locality: null })).toBe(false)
  })
  it('parses name_<code> inputs for the 9 languages only', () => {
    expect(parseNameTranslations({ name_hi: 'दिल्ली', name_ta: '', name_en: 'Delhi', name_fr: 'x', name_gu: ' દિલ્હી ' })).toEqual({ hi: 'दिल्ली', gu: 'દિલ્હી' })
  })
  it('accepts only translatable language codes in the URL', () => {
    expect(translatableLang('hi')).toBe('hi')
    expect(translatableLang('en')).toBeNull()
    expect(translatableLang('xx')).toBeNull()
    expect(translatableLang(undefined)).toBeNull()
  })
})
