import { describe, it, expect } from 'vitest'
import { collapseByDoctor, rankCandidates, isIndexable, feeRange, fallbackFaqs, pageKeyFor, toCard, type CandidateRow, type RankCtx } from '../src/lib/listing'

const AREA = 'ar_del_lajpat'
const CENTER = { lat: 28.5677, lng: 77.2433 } // Lajpat Nagar

function row(over: Partial<CandidateRow> & { d_id: string; c_id: string }): CandidateRow {
  return {
    d_slug: over.d_id, d_name: `Dr ${over.d_id}`, d_gender: 'male', d_patients: 'both', d_photo_key: null, d_qualifications: '["MBBS"]',
    d_reg_no: null, d_reg_council: null, d_verified: 0, d_exp: 5, d_languages: '["Hindi"]', d_video: 0, d_video_fee: null,
    d_rating: 4, d_reviews: 10, d_recommend: null, d_grating: null, d_greviews: null,
    c_slug: over.c_id, c_name: `Clinic ${over.c_id}`, c_locality: null, c_area_id: null, c_area_slug: null, c_address: 'addr',
    c_lat: CENTER.lat, c_lng: CENTER.lng, c_phone: null, c_whatsapp: null, fee: 500,
    ...over,
  }
}

const areaCtx: RankCtx = { center: CENTER, areaId: AREA, sort: 'relevance' }
const cityCtx: RankCtx = { center: null, areaId: null, sort: 'relevance' }

describe('collapseByDoctor', () => {
  it('collapses several clinics into one card using the nearest clinic and counts the rest', () => {
    const far = row({ d_id: 'a', c_id: 'far', c_lat: 28.65, c_lng: 77.30 })
    const near = row({ d_id: 'a', c_id: 'near', c_lat: 28.57, c_lng: 77.245 })
    const out = collapseByDoctor([far, near], areaCtx)
    expect(out).toHaveLength(1)
    expect(out[0]?.row.c_id).toBe('near')
    expect(out[0]?.clinicCount).toBe(2)
    expect(out[0]?.distanceKm).toBeLessThan(1)
  })

  it('prefers an in-area clinic over a nearer out-of-area one', () => {
    const inArea = row({ d_id: 'a', c_id: 'in', c_area_id: AREA, c_lat: 28.58, c_lng: 77.26 })
    const nearer = row({ d_id: 'a', c_id: 'out', c_area_id: 'other', c_lat: 28.5678, c_lng: 77.2434 })
    const out = collapseByDoctor([nearer, inArea], areaCtx)
    expect(out[0]?.row.c_id).toBe('in')
    expect(out[0]?.inArea).toBe(true)
  })
})

describe('rankCandidates — relevance', () => {
  it('area page: in-area first, then distance, then rating/reviews', () => {
    const rows = [
      row({ d_id: 'far-high', c_id: 'c1', c_area_id: 'other', c_lat: 28.60, c_lng: 77.28, d_rating: 5, d_reviews: 500 }),
      row({ d_id: 'in-low', c_id: 'c2', c_area_id: AREA, d_rating: 3.5, d_reviews: 2, c_lat: 28.57, c_lng: 77.25 }),
      row({ d_id: 'in-high', c_id: 'c3', c_area_id: AREA, d_rating: 4.8, d_reviews: 40, c_lat: 28.57, c_lng: 77.25 }),
      row({ d_id: 'near-out', c_id: 'c4', c_area_id: 'other', c_lat: 28.575, c_lng: 77.25, d_rating: 4.9, d_reviews: 90 }),
    ]
    const ids = rankCandidates(rows, areaCtx).map((c) => c.row.d_id)
    expect(ids.slice(0, 2).sort()).toEqual(['in-high', 'in-low'])
    expect(ids[0]).toBe('in-high') // same distance -> rating desc
    expect(ids[2]).toBe('near-out')
    expect(ids[3]).toBe('far-high')
  })

  it('city page: rating desc, review_count desc, then experience', () => {
    const rows = [
      row({ d_id: 'r4-exp10', c_id: 'a', d_rating: 4, d_reviews: 10, d_exp: 10 }),
      row({ d_id: 'r5', c_id: 'b', d_rating: 5, d_reviews: 1 }),
      row({ d_id: 'r4-rev50', c_id: 'c', d_rating: 4, d_reviews: 50 }),
      row({ d_id: 'r4-exp20', c_id: 'd', d_rating: 4, d_reviews: 10, d_exp: 20 }),
      row({ d_id: 'unrated', c_id: 'e', d_rating: null, d_reviews: 0 }),
    ]
    expect(rankCandidates(rows, cityCtx).map((c) => c.row.d_id)).toEqual(['r5', 'r4-rev50', 'r4-exp20', 'r4-exp10', 'unrated'])
  })
})

describe('rankCandidates — explicit sorts', () => {
  const rows = [
    row({ d_id: 'a', c_id: 'a', d_exp: 3, fee: 300, d_reviews: 5, c_lat: 28.60, c_lng: 77.30 }),
    row({ d_id: 'b', c_id: 'b', d_exp: 15, fee: 1500, d_reviews: 50, c_lat: 28.568, c_lng: 77.244 }),
    row({ d_id: 'c', c_id: 'c', d_exp: 8, fee: null, d_reviews: 20, c_lat: 28.58, c_lng: 77.26 }),
  ]
  const ids = (sort: RankCtx['sort']) => rankCandidates(rows, { ...areaCtx, sort }).map((c) => c.row.d_id)
  it('distance', () => expect(ids('distance')).toEqual(['b', 'c', 'a']))
  it('experience', () => expect(ids('experience')).toEqual(['b', 'c', 'a']))
  it('fee_asc puts unknown fees last', () => expect(ids('fee_asc')).toEqual(['a', 'b', 'c']))
  it('fee_desc puts unknown fees last', () => expect(ids('fee_desc')).toEqual(['b', 'a', 'c']))
  it('reviews', () => expect(ids('reviews')).toEqual(['b', 'c', 'a']))
})

describe('toCard', () => {
  it('maps the row to the DoctorCard contract', () => {
    const [c] = collapseByDoctor([row({ d_id: 'a', c_id: 'c', d_photo_key: 'doctors/a.jpg', c_area_slug: 'lajpat-nagar' })], areaCtx)
    const card = toCard(c!, 'https://media.example', [{ slug: 'sexologist', name: 'Sexologist' }], null, [{ slug: 'erectile-dysfunction', name: 'Erectile Dysfunction' }])
    expect(card.photoUrl).toBe('https://media.example/doctors/a.jpg')
    expect(card.primarySpecialty).toEqual({ slug: 'sexologist', name: 'Sexologist' })
    expect(card.qualifications).toEqual(['MBBS'])
    expect(card.clinic.areaSlug).toBe('lajpat-nagar')
    expect(card.clinic.distanceKm).toBe(0)
    expect(card.clinicCount).toBe(1)
    expect(Object.keys(card).sort()).toEqual([
      'clinic', 'clinicCount', 'conditions', 'experienceYears', 'gender', 'googleRating', 'googleReviewCount', 'id', 'isVerified', 'languages', 'name',
      'patientsTreated', 'photoUrl', 'primarySpecialty', 'qualifications', 'ratingAvg', 'recommendPct', 'registrationCouncil', 'registrationNumber',
      'reviewCount', 'slug', 'specialties', 'videoConsult', 'videoFee',
    ])
  })
})

describe('isIndexable', () => {
  it('requires the minimum count and no extra params', () => {
    expect(isIndexable(3, 3, { city: 'delhi', specialty: 'sexologist' })).toBe(true)
    expect(isIndexable(2, 3, { city: 'delhi', specialty: 'sexologist' })).toBe(false)
    expect(isIndexable(10, 3, { city: 'delhi', specialty: 'sexologist', area: 'saket', condition: 'erectile-dysfunction', doctorGender: 'female', online: true })).toBe(true)
    expect(isIndexable(10, 3, { city: 'delhi', fee: '500' })).toBe(false)
    expect(isIndexable(10, 3, { city: 'delhi', page: 2 })).toBe(false)
    expect(isIndexable(10, 3, { city: 'delhi', sort: 'relevance' })).toBe(true)
    expect(isIndexable(10, 3, { city: 'delhi', sort: 'fee_asc' })).toBe(false)
  })
})

describe('helpers', () => {
  it('feeRange', () => {
    expect(feeRange('0-500')).toEqual({ min: 0, max: 500 })
    expect(feeRange('1000')).toEqual({ min: 1000, max: null })
    expect(feeRange('abc')).toBeNull()
  })
  it('pageKeyFor', () => {
    expect(pageKeyFor({ city: 'delhi', specialty: 'sexologist' })).toBe('city:delhi:sexologist')
    expect(pageKeyFor({ city: 'delhi', specialty: 'sexologist', area: 'saket' })).toBe('area:delhi:sexologist:saket')
    expect(pageKeyFor({ city: 'delhi', condition: 'erectile-dysfunction' })).toBe('city:delhi:cond:erectile-dysfunction')
  })
  it('fallbackFaqs mention the place and keep to 5-8 entries', () => {
    const city = { id: 'c', slug: 'delhi', name: 'Delhi', state: 'Delhi', lat: null, lng: null }
    const area = { id: 'a', city_id: 'c', slug: 'saket', name: 'Saket', zone: null, lat: 0, lng: 0, default_radius_km: 6 }
    const faqs = fallbackFaqs({ specialty: { id: 's', slug: 'sexologist', name: 'Sexologist', plural: 'Sexologists' }, condition: null, city, area, total: 7 })
    expect(faqs.length).toBeGreaterThanOrEqual(5)
    expect(faqs.length).toBeLessThanOrEqual(8)
    expect(faqs.some((f) => f.q.includes('Saket, Delhi'))).toBe(true)
    const withCond = fallbackFaqs({ specialty: null, condition: { id: 'x', slug: 'vaginismus', name: 'Vaginismus', gender_focus: 'female' }, city, area: null, total: 0 })
    expect(withCond[0]?.q).toContain('vaginismus')
    expect(withCond[0]?.a).toContain('gynaecologist')
  })
})
