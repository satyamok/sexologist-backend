/**
 * Shared listing query for /api/listing. Pulls candidate (doctor, clinic) rows with
 * bound SQL, then ranks / collapses in JS so the relevance rules live in one place
 * and are unit-testable with a fake DB.
 */
import { all, one, jsonStringArray, type SqlValue } from './db'
import { photosByClinic, photosJson, type PhotoRow, type PhotoJson } from './photos'
import { haversineKm, boundingBox, roundKm } from './geo'
import { LANG_CODES, speaksLocale, localesForLanguages, type LangCode } from './langs'
import { doctorTranslations, clinicTranslations, nameTranslations, pick, type DoctorTranslation, type ClinicTranslation } from './translations'

export const PER_PAGE = 20

export type Sort = 'relevance' | 'distance' | 'experience' | 'fee_asc' | 'fee_desc' | 'reviews'

export type ListingParams = {
  /** Optional only for India-wide online listings (`online=1`). */
  city?: string
  specialty?: string
  area?: string
  condition?: string
  doctorGender?: 'male' | 'female'
  online?: boolean
  exp?: number
  fee?: string // 0-500 | 500 | 1000 | 2000
  video?: boolean
  lang?: string
  rating?: number
  sort?: Sort
  page?: number
  /** Site language of the page (default 'en'). Non-English locales keep only doctors who speak that language. */
  locale?: LangCode
}

export type CityRow = { id: string; slug: string; name: string; state: string; lat: number | null; lng: number | null }
export type AreaRow = { id: string; city_id: string; slug: string; name: string; zone: string | null; lat: number; lng: number; default_radius_km: number }
export type SpecialtyRow = { id: string; slug: string; name: string; plural: string }
export type ConditionRow = { id: string; slug: string; name: string; gender_focus: string }

export type Ref = { slug: string; name: string }

export type DoctorCard = {
  id: string
  slug: string
  name: string
  gender: 'male' | 'female' | 'other'
  patientsTreated: 'men' | 'women' | 'both'
  photoUrl: string | null
  qualifications: string[]
  primarySpecialty: Ref
  specialties: Ref[]
  experienceYears: number | null
  languages: string[]
  isVerified: boolean
  registrationNumber: string | null
  registrationCouncil: string | null
  videoConsult: boolean
  videoFee: number | null
  ratingAvg: number | null
  reviewCount: number
  recommendPct: number | null
  googleRating: number | null
  googleReviewCount: number | null
  conditions: Ref[]
  clinic: {
    id: string
    slug: string
    name: string
    locality: string | null
    areaSlug: string | null
    address: string
    lat: number
    lng: number
    fee: number | null
    phone: string | null
    whatsapp: string | null
    distanceKm: number | null
    /** Cover photo (first gallery photo); never the doctor's profile picture. */
    photoUrl: string | null
    photos: PhotoJson[]
  }
  clinicCount: number
}

/** One (doctor, clinic) pair as returned from SQL. */
export type CandidateRow = {
  d_id: string; d_slug: string; d_name: string; d_gender: string; d_patients: string; d_photo_key: string | null
  d_qualifications: string; d_reg_no: string | null; d_reg_council: string | null; d_verified: number
  d_exp: number | null; d_languages: string; d_video: number; d_video_fee: number | null
  d_rating: number | null; d_reviews: number; d_recommend: number | null; d_grating: number | null; d_greviews: number | null
  c_id: string; c_slug: string; c_name: string; c_locality: string | null; c_area_id: string | null; c_area_slug: string | null
  c_address: string; c_lat: number; c_lng: number; c_phone: string | null; c_whatsapp: string | null; c_photo_key?: string | null; fee: number | null
}

export type DoctorRefRow = { doctor_id: string; slug: string; name: string; is_primary?: number }

export type ListingResult = {
  city: CityRow | null
  area: AreaRow | null
  specialty: SpecialtyRow | null
  condition: ConditionRow | null
  total: number
  page: number
  perPage: number
  indexable: boolean
  items: DoctorCard[]
  nearbyAreas: { slug: string; name: string; distanceKm: number; doctorCount: number }[]
  otherSpecialties: { slug: string; name: string; doctorCount: number }[]
  faqs: { q: string; a: string }[]
  aggregate: { ratingAvg: number | null; reviewCount: number }
  locale: LangCode
  /** Distinct doctors in the same scope (all filters except locale) who speak each site language; 'en' = everyone. */
  langCounts: Record<LangCode, number>
}

// ---------- pure ranking (unit tested) ----------

export type RankCtx = { center: { lat: number; lng: number } | null; areaId: string | null; sort: Sort }

type Collapsed = { row: CandidateRow; distanceKm: number | null; inArea: boolean; clinicCount: number }

/** Collapse multiple clinic rows per doctor into one, keeping the nearest (or in-area) clinic. */
export function collapseByDoctor(rows: CandidateRow[], ctx: RankCtx): Collapsed[] {
  const byDoctor = new Map<string, Collapsed>()
  for (const row of rows) {
    const distanceKm = ctx.center ? roundKm(haversineKm(ctx.center, { lat: row.c_lat, lng: row.c_lng })) : null
    const inArea = ctx.areaId !== null && row.c_area_id === ctx.areaId
    const existing = byDoctor.get(row.d_id)
    if (!existing) {
      byDoctor.set(row.d_id, { row, distanceKm, inArea, clinicCount: 1 })
      continue
    }
    existing.clinicCount += 1
    const better =
      (inArea && !existing.inArea) ||
      (inArea === existing.inArea && distanceKm !== null && existing.distanceKm !== null && distanceKm < existing.distanceKm)
    if (better) {
      existing.row = row
      existing.distanceKm = distanceKm
      existing.inArea = inArea
    }
  }
  return [...byDoctor.values()]
}

function num(v: number | null | undefined, fallback: number): number {
  return v === null || v === undefined ? fallback : v
}

export function compareCards(a: Collapsed, b: Collapsed, ctx: RankCtx): number {
  const ra = a.row, rb = b.row
  const byRating = () => num(rb.d_rating, 0) - num(ra.d_rating, 0) || rb.d_reviews - ra.d_reviews
  const byDistance = () => num(a.distanceKm, 1e9) - num(b.distanceKm, 1e9)
  switch (ctx.sort) {
    case 'distance':
      return byDistance() || byRating()
    case 'experience':
      return num(rb.d_exp, -1) - num(ra.d_exp, -1) || byRating()
    case 'fee_asc':
      return num(ra.fee, 1e9) - num(rb.fee, 1e9) || byRating()
    case 'fee_desc':
      return num(rb.fee, -1) - num(ra.fee, -1) || byRating()
    case 'reviews':
      return rb.d_reviews - ra.d_reviews || num(rb.d_rating, 0) - num(ra.d_rating, 0)
    default: {
      if (ctx.areaId) {
        if (a.inArea !== b.inArea) return a.inArea ? -1 : 1
        return byDistance() || byRating()
      }
      return byRating() || num(rb.d_exp, -1) - num(ra.d_exp, -1)
    }
  }
}

export function rankCandidates(rows: CandidateRow[], ctx: RankCtx): Collapsed[] {
  return collapseByDoctor(rows, ctx).sort((a, b) => compareCards(a, b, ctx))
}

/** Distinct doctors per site language; 'en' counts every doctor. Scope = whatever rows the caller passes. */
export function langCountsFor(rows: readonly { d_id: string; d_languages: string }[]): Record<LangCode, number> {
  const seen = new Set<string>()
  const counts = Object.fromEntries(LANG_CODES.map((c) => [c, 0])) as Record<LangCode, number>
  for (const r of rows) {
    if (seen.has(r.d_id)) continue
    seen.add(r.d_id)
    for (const code of localesForLanguages(jsonStringArray(r.d_languages))) counts[code] += 1
  }
  return counts
}

/** Keep only (doctor, clinic) rows whose doctor speaks the locale. 'en' keeps everything. */
export function filterByLocale<T extends { d_languages: string }>(rows: readonly T[], locale: LangCode): T[] {
  if (locale === 'en') return [...rows]
  return rows.filter((r) => speaksLocale(jsonStringArray(r.d_languages), locale))
}

/** Overlay admin translations on a card: doctor name, clinic name/locality/address. Missing fields fall back to English. */
export function translateCard(card: DoctorCard, dtr: DoctorTranslation | null | undefined, ctr: ClinicTranslation | null | undefined): DoctorCard {
  if (!dtr && !ctr) return card
  return {
    ...card,
    name: pick(dtr?.name, card.name),
    clinic: { ...card.clinic, name: pick(ctr?.name, card.clinic.name), locality: pick(ctr?.locality, card.clinic.locality), address: pick(ctr?.address, card.clinic.address) },
  }
}

export function toCard(
  c: Collapsed,
  mediaUrl: string,
  specialties: Ref[],
  primary: Ref | null,
  conditions: Ref[],
  clinicPhotos: PhotoRow[] = [],
): DoctorCard {
  const r = c.row
  const gallery = photosJson(clinicPhotos, mediaUrl)
  return {
    id: r.d_id,
    slug: r.d_slug,
    name: r.d_name,
    gender: r.d_gender as DoctorCard['gender'],
    patientsTreated: r.d_patients as DoctorCard['patientsTreated'],
    photoUrl: r.d_photo_key ? `${mediaUrl}/${r.d_photo_key}` : null,
    qualifications: jsonStringArray(r.d_qualifications),
    primarySpecialty: primary ?? specialties[0] ?? { slug: 'sexologist', name: 'Sexologist' },
    specialties,
    experienceYears: r.d_exp,
    languages: jsonStringArray(r.d_languages),
    isVerified: r.d_verified === 1,
    registrationNumber: r.d_reg_no,
    registrationCouncil: r.d_reg_council,
    videoConsult: r.d_video === 1,
    videoFee: r.d_video_fee,
    ratingAvg: r.d_rating,
    reviewCount: r.d_reviews,
    recommendPct: r.d_recommend,
    googleRating: r.d_grating,
    googleReviewCount: r.d_greviews,
    conditions,
    clinic: {
      id: r.c_id,
      slug: r.c_slug,
      name: r.c_name,
      locality: r.c_locality,
      areaSlug: r.c_area_slug,
      address: r.c_address,
      lat: r.c_lat,
      lng: r.c_lng,
      fee: r.fee,
      phone: r.c_phone,
      whatsapp: r.c_whatsapp,
      distanceKm: c.distanceKm,
      photoUrl: gallery[0]?.url ?? (r.c_photo_key ? `${mediaUrl}/${r.c_photo_key}` : null),
      photos: gallery,
    },
    clinicCount: c.clinicCount,
  }
}

/** indexable = enough doctors AND no filter/sort/page params beyond the path ones. */
export function isIndexable(total: number, minDoctors: number, p: ListingParams): boolean {
  const hasExtra =
    p.exp !== undefined || p.fee !== undefined || p.video || p.lang !== undefined || p.rating !== undefined ||
    (p.sort !== undefined && p.sort !== 'relevance') || (p.page !== undefined && p.page > 1)
  return total >= minDoctors && !hasExtra
}

export function feeRange(fee: string | undefined): { min: number; max: number | null } | null {
  switch (fee) {
    case '0-500': return { min: 0, max: 500 }
    case '500': return { min: 500, max: null }
    case '1000': return { min: 1000, max: null }
    case '2000': return { min: 2000, max: null }
    default: return null
  }
}

// ---------- FAQ templates ----------

export function fallbackFaqs(opts: { specialty: SpecialtyRow | null; condition: ConditionRow | null; city: CityRow | null; area: AreaRow | null; total: number }): { q: string; a: string }[] {
  const cityName = opts.city?.name ?? 'India'
  const place = opts.area ? `${opts.area.name}, ${cityName}` : cityName
  const spec = opts.specialty?.name ?? 'sexologist'
  const plural = (opts.specialty?.plural ?? 'sexologists').toLowerCase()
  const count = opts.total > 0 ? `${opts.total} ` : ''
  const faqs = [
    { q: `What does a ${spec.toLowerCase()} treat?`, a: `A ${spec.toLowerCase()} evaluates and treats sexual health problems such as erectile dysfunction, premature ejaculation, low libido, performance anxiety, painful intercourse and sexually transmitted infections. Treatment may include medicines, counselling, hormonal therapy or referral to a urologist or gynaecologist.` },
    { q: `How do I choose the right ${spec.toLowerCase()} in ${place}?`, a: `Check the doctor's qualifications and medical-council registration, years of experience, the conditions they treat, patient reviews and whether they offer video consultation. SexologistIndia lists ${count}${plural} in ${place} with verified registration details where available.` },
    { q: `Can I consult a ${spec.toLowerCase()} in ${place} online?`, a: `Yes. Many ${plural} in ${place} offer video consultations. Use the "Video consult" filter to see doctors who consult online, their fee and languages.` },
    { q: `Can I request a female ${spec.toLowerCase()} in ${place}?`, a: `Yes. Use the doctor gender filter to see female ${plural} in ${place}. Many women prefer a female doctor for problems like vaginismus, painful intercourse or low desire.` },
    { q: `How much does a ${spec.toLowerCase()} consultation cost in ${cityName}?`, a: `Consultation fees for ${plural} in ${cityName} typically range from Rs 300 to Rs 2,000 depending on the doctor's experience and clinic. Fees are shown on each doctor's card and can be filtered by range.` },
    { q: `Is my consultation confidential?`, a: `Yes. Sexual-health consultations are private and covered by medical confidentiality. You can also book a video consultation if you prefer not to visit a clinic.` },
  ]
  if (opts.condition) {
    faqs.unshift({
      q: `Which doctor should I see for ${opts.condition.name.toLowerCase()} in ${place}?`,
      a: `${opts.condition.name} is usually treated by a sexologist, andrologist or urologist${opts.condition.gender_focus === 'female' ? ', or a gynaecologist' : ''}. The doctors listed here in ${place} treat ${opts.condition.name.toLowerCase()}; check their experience and registration before booking.`,
    })
  }
  return faqs.slice(0, 7)
}

export function pageKeyFor(p: { city: string; specialty?: string | null; area?: string | null; condition?: string | null }): string {
  if (p.condition) return p.area ? `area:${p.city}:cond:${p.condition}:${p.area}` : `city:${p.city}:cond:${p.condition}`
  const spec = p.specialty ?? 'sexologist'
  return p.area ? `area:${p.city}:${spec}:${p.area}` : `city:${p.city}:${spec}`
}

// ---------- DB-backed query ----------

export type ListingDeps = { db: D1Database; mediaUrl: string; minDoctors: number }

const CANDIDATE_SELECT = `
  SELECT d.id d_id, d.slug d_slug, d.name d_name, d.gender d_gender, d.patients_treated d_patients, d.photo_key d_photo_key,
         d.qualifications d_qualifications, d.registration_number d_reg_no, d.registration_council d_reg_council, d.is_verified d_verified,
         d.experience_years d_exp, d.languages d_languages, d.video_consult d_video, d.video_fee d_video_fee,
         d.rating_avg d_rating, d.review_count d_reviews, d.recommend_pct d_recommend, d.google_rating d_grating, d.google_review_count d_greviews,
         c.id c_id, c.slug c_slug, c.name c_name, c.locality c_locality, c.area_id c_area_id, a.slug c_area_slug,
         c.address c_address, c.lat c_lat, c.lng c_lng, c.phone c_phone, c.whatsapp c_whatsapp, c.photo_key c_photo_key, dc.consultation_fee fee
    FROM doctors d
    JOIN doctor_clinics dc ON dc.doctor_id = d.id
    JOIN clinics c ON c.id = dc.clinic_id
    LEFT JOIN areas a ON a.id = c.area_id
   WHERE d.is_published = 1 AND c.is_published = 1`

export async function runListing(deps: ListingDeps, p: ListingParams): Promise<ListingResult | { error: string; status: number }> {
  const { db } = deps
  let city: CityRow | null = null
  if (p.city) {
    city = await one<CityRow>(db, 'SELECT id, slug, name, state, lat, lng FROM cities WHERE slug = ? AND is_published = 1', p.city)
    if (!city) return { error: 'Unknown city', status: 404 }
  } else if (!p.online) {
    return { error: 'city is required', status: 400 }
  }

  let area: AreaRow | null = null
  if (p.area && city) {
    area = await one<AreaRow>(db, 'SELECT id, city_id, slug, name, zone, lat, lng, default_radius_km FROM areas WHERE city_id = ? AND slug = ? AND is_published = 1', city.id, p.area)
    if (!area) return { error: 'Unknown area', status: 404 }
  }
  let specialty: SpecialtyRow | null = null
  if (p.specialty) {
    specialty = await one<SpecialtyRow>(db, 'SELECT id, slug, name, plural FROM specialties WHERE slug = ?', p.specialty)
    if (!specialty) return { error: 'Unknown specialty', status: 404 }
  }
  let condition: ConditionRow | null = null
  if (p.condition) {
    condition = await one<ConditionRow>(db, 'SELECT id, slug, name, gender_focus FROM conditions WHERE slug = ?', p.condition)
    if (!condition) return { error: 'Unknown condition', status: 404 }
  }

  const where: string[] = []
  const params: SqlValue[] = []
  if (city) { where.push('c.city_id = ?'); params.push(city.id) }
  if (specialty) { where.push('EXISTS (SELECT 1 FROM doctor_specialties ds WHERE ds.doctor_id = d.id AND ds.specialty_id = ?)'); params.push(specialty.id) }
  if (condition) { where.push('EXISTS (SELECT 1 FROM doctor_conditions dcn WHERE dcn.doctor_id = d.id AND dcn.condition_id = ?)'); params.push(condition.id) }
  if (p.doctorGender) { where.push('d.gender = ?'); params.push(p.doctorGender) }
  if (p.online || p.video) where.push('d.video_consult = 1')
  if (p.exp !== undefined) { where.push('d.experience_years >= ?'); params.push(p.exp) }
  if (p.rating !== undefined) { where.push('d.rating_avg >= ?'); params.push(p.rating) }
  if (p.lang) { where.push("EXISTS (SELECT 1 FROM json_each(d.languages) je WHERE lower(je.value) = lower(?))"); params.push(p.lang) }
  const fr = feeRange(p.fee)
  if (fr) {
    where.push('dc.consultation_fee >= ?'); params.push(fr.min)
    if (fr.max !== null) { where.push('dc.consultation_fee <= ?'); params.push(fr.max) }
  }
  // Area pages: clinics inside the area OR within its radius (bounding box; exact distance in JS).
  if (area) {
    const box = boundingBox({ lat: area.lat, lng: area.lng }, area.default_radius_km)
    where.push('(c.area_id = ? OR (c.lat BETWEEN ? AND ? AND c.lng BETWEEN ? AND ?))')
    params.push(area.id, box.minLat, box.maxLat, box.minLng, box.maxLng)
  }

  const sql = `${CANDIDATE_SELECT}${where.length ? ' AND ' + where.join(' AND ') : ''}`
  let rows = await all<CandidateRow>(db, sql, ...params)

  const center = area ? { lat: area.lat, lng: area.lng } : null
  const ctx: RankCtx = { center, areaId: area?.id ?? null, sort: p.sort ?? 'relevance' }
  if (area) {
    rows = rows.filter((r) => r.c_area_id === area.id || haversineKm(center!, { lat: r.c_lat, lng: r.c_lng }) <= area.default_radius_km)
  }
  const locale: LangCode = p.locale ?? 'en'
  // langCounts covers the whole scope (before the locale filter) so hreflang alternates only point at pages with doctors.
  const langCounts = langCountsFor(rows)
  rows = filterByLocale(rows, locale)
  const ranked = rankCandidates(rows, ctx)
  const total = ranked.length
  const page = Math.max(1, p.page ?? 1)
  const slice = ranked.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const ids = slice.map((c) => c.row.d_id)
  const clinicIds = slice.map((c) => c.row.c_id)
  const [specMap, primMap, condMap, photoMap, dtrMap, ctrMap] = await Promise.all([
    doctorRefs(db, 'doctor_specialties', 'specialties', 'specialty_id', ids),
    doctorPrimary(db, ids),
    doctorRefs(db, 'doctor_conditions', 'conditions', 'condition_id', ids),
    photosByClinic(db, clinicIds),
    doctorTranslations(db, ids, locale),
    clinicTranslations(db, clinicIds, locale),
  ])
  const items = slice.map((c) =>
    translateCard(toCard(c, deps.mediaUrl, specMap.get(c.row.d_id) ?? [], primMap.get(c.row.d_id) ?? null, condMap.get(c.row.d_id) ?? [], photoMap.get(c.row.c_id) ?? []), dtrMap.get(c.row.d_id), ctrMap.get(c.row.c_id)),
  )

  const rated = ranked.filter((c) => c.row.d_rating !== null)
  const aggregate = {
    ratingAvg: rated.length ? Math.round((rated.reduce((s, c) => s + (c.row.d_rating ?? 0), 0) / rated.length) * 10) / 10 : null,
    reviewCount: ranked.reduce((s, c) => s + c.row.d_reviews, 0),
  }

  const [nearbyAreas, otherSpecialties, faqRows] = await Promise.all([
    nearbyAreasFor(db, city, area, specialty),
    otherSpecialtiesFor(db, city, area, specialty),
    all<{ question: string; answer: string }>(db, 'SELECT question, answer FROM page_faqs WHERE page_key = ? ORDER BY sort_order, rowid', pageKeyFor({ city: city?.slug ?? 'online', specialty: specialty?.slug, area: area?.slug, condition: condition?.slug })),
  ])
  const faqs = faqRows.length ? faqRows.map((f) => ({ q: f.question, a: f.answer })) : fallbackFaqs({ specialty, condition, city, area, total })

  // City / area names in the page language (nearby areas too). English stays when no row exists.
  const [cityNames, areaNames] = await Promise.all([
    nameTranslations(db, 'city_translations', city ? [city.id] : [], locale),
    nameTranslations(db, 'area_translations', [...(area ? [area.id] : []), ...nearbyAreas.map((a) => a.id)], locale),
  ])
  const cityOut = city ? { ...city, name: cityNames.get(city.id) ?? city.name } : null
  const areaOut = area ? { ...area, name: areaNames.get(area.id) ?? area.name } : null

  return {
    city: cityOut, area: areaOut, specialty, condition, total, page, perPage: PER_PAGE,
    indexable: isIndexable(total, deps.minDoctors, p),
    items,
    nearbyAreas: nearbyAreas.map(({ id, ...a }) => ({ ...a, name: areaNames.get(id) ?? a.name })),
    otherSpecialties, faqs, aggregate, locale, langCounts,
  }
}

type RefRow = { doctor_id: string; slug: string; name: string }

async function doctorRefs(db: D1Database, link: string, table: string, col: string, ids: string[]): Promise<Map<string, Ref[]>> {
  const map = new Map<string, Ref[]>()
  if (!ids.length) return map
  const rows = await all<RefRow>(db, `SELECT l.doctor_id, t.slug, t.name FROM ${link} l JOIN ${table} t ON t.id = l.${col} WHERE l.doctor_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.name`, ...ids)
  for (const r of rows) (map.get(r.doctor_id) ?? map.set(r.doctor_id, []).get(r.doctor_id)!).push({ slug: r.slug, name: r.name })
  return map
}

async function doctorPrimary(db: D1Database, ids: string[]): Promise<Map<string, Ref>> {
  const map = new Map<string, Ref>()
  if (!ids.length) return map
  const rows = await all<RefRow>(db, `SELECT ds.doctor_id, s.slug, s.name FROM doctor_specialties ds JOIN specialties s ON s.id = ds.specialty_id WHERE ds.is_primary = 1 AND ds.doctor_id IN (${ids.map(() => '?').join(',')})`, ...ids)
  for (const r of rows) map.set(r.doctor_id, { slug: r.slug, name: r.name })
  return map
}

/** Count of published doctors (optionally of a specialty) with a clinic in a given area. */
const COUNT_IN_AREA = `
  SELECT a.id, a.slug, a.name, a.lat, a.lng,
         (SELECT COUNT(DISTINCT d.id) FROM doctors d JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics c ON c.id = dc.clinic_id
           WHERE d.is_published = 1 AND c.is_published = 1 AND c.area_id = a.id
             AND (? IS NULL OR EXISTS (SELECT 1 FROM doctor_specialties ds WHERE ds.doctor_id = d.id AND ds.specialty_id = ?))) doctor_count
    FROM areas a WHERE a.city_id = ? AND a.is_published = 1`

async function nearbyAreasFor(db: D1Database, city: CityRow | null, area: AreaRow | null, specialty: SpecialtyRow | null) {
  if (!city) return []
  const rows = await all<{ id: string; slug: string; name: string; lat: number; lng: number; doctor_count: number }>(db, COUNT_IN_AREA, specialty?.id ?? null, specialty?.id ?? null, city.id)
  const center = area ? { lat: area.lat, lng: area.lng } : city.lat !== null && city.lng !== null ? { lat: city.lat, lng: city.lng } : null
  return rows
    .filter((r) => r.id !== area?.id)
    .map((r) => ({ id: r.id, slug: r.slug, name: r.name, distanceKm: center ? roundKm(haversineKm(center, r)) : 0, doctorCount: r.doctor_count }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 8)
}

async function otherSpecialtiesFor(db: D1Database, city: CityRow | null, area: AreaRow | null, specialty: SpecialtyRow | null) {
  const rows = await all<{ slug: string; name: string; doctor_count: number }>(
    db,
    `SELECT s.slug, s.name,
            (SELECT COUNT(DISTINCT d.id) FROM doctors d JOIN doctor_specialties ds ON ds.doctor_id = d.id AND ds.specialty_id = s.id
               JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics c ON c.id = dc.clinic_id
              WHERE d.is_published = 1 AND c.is_published = 1 AND (? IS NULL OR c.city_id = ?) AND (? IS NULL OR c.area_id = ?)) doctor_count
       FROM specialties s WHERE s.id <> ? ORDER BY s.name`,
    city?.id ?? null, city?.id ?? null, area?.id ?? null, area?.id ?? null, specialty?.id ?? '',
  )
  return rows.map((r) => ({ slug: r.slug, name: r.name, doctorCount: r.doctor_count }))
}
