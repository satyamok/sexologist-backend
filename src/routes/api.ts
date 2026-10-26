import { Hono } from 'hono'
import type { AppEnv } from '../env'
import { all, one, uuid, run, jsonStringArray, jsonObject } from '../lib/db'
import { haversineKm } from '../lib/geo'
import { runListing, type ListingParams, type Sort, type DoctorCard, rankCandidates, toCard, type CandidateRow, type Ref } from '../lib/listing'

export const api = new Hono<AppEnv>()

const SORTS: Sort[] = ['relevance', 'distance', 'experience', 'fee_asc', 'fee_desc', 'reviews']
const SLUG = /^[a-z0-9-]{1,80}$/

api.use('*', async (c, next) => {
  await next()
  if (c.req.method === 'GET' && c.res.ok) c.res.headers.set('Cache-Control', 'public, s-maxage=300')
})

const ok = (c: { json: (b: unknown, s?: 200) => Response }, data: unknown) => c.json({ ok: true, data })

api.get('/cities', async (c) => {
  const cities = await all<{ id: string; slug: string; name: string; state: string; lat: number | null; lng: number | null; doctor_count: number }>(
    c.env.DB,
    `SELECT ci.id, ci.slug, ci.name, ci.state, ci.lat, ci.lng,
            (SELECT COUNT(DISTINCT d.id) FROM doctors d JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics cl ON cl.id = dc.clinic_id
              WHERE d.is_published = 1 AND cl.is_published = 1 AND cl.city_id = ci.id) doctor_count
       FROM cities ci WHERE ci.is_published = 1 ORDER BY ci.name`,
  )
  const areas = await all<{ city_id: string; slug: string; name: string; zone: string | null; doctor_count: number }>(
    c.env.DB,
    `SELECT a.city_id, a.slug, a.name, a.zone,
            (SELECT COUNT(DISTINCT d.id) FROM doctors d JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics cl ON cl.id = dc.clinic_id
              WHERE d.is_published = 1 AND cl.is_published = 1 AND cl.area_id = a.id) doctor_count
       FROM areas a WHERE a.is_published = 1 ORDER BY a.name`,
  )
  return ok(c, cities.map((ci) => ({
    id: ci.id, slug: ci.slug, name: ci.name, state: ci.state, lat: ci.lat, lng: ci.lng, doctorCount: ci.doctor_count,
    areas: areas.filter((a) => a.city_id === ci.id).map((a) => ({ slug: a.slug, name: a.name, zone: a.zone, doctorCount: a.doctor_count })),
  })))
})

api.get('/meta', async (c) => {
  const [specialties, conditions] = await Promise.all([
    all<{ slug: string; name: string; plural: string }>(c.env.DB, 'SELECT slug, name, plural FROM specialties ORDER BY name'),
    all<{ slug: string; name: string; gender_focus: string }>(c.env.DB, 'SELECT slug, name, gender_focus FROM conditions ORDER BY name'),
  ])
  return ok(c, { specialties, conditions: conditions.map((x) => ({ slug: x.slug, name: x.name, genderFocus: x.gender_focus })) })
})

function parseListingParams(q: Record<string, string | undefined>): ListingParams | string {
  const city = q.city
  // city is optional only for India-wide online listings (online=1)
  if (city && !SLUG.test(city)) return 'invalid city'
  if (!city && q.online !== '1') return 'city is required'
  const p: ListingParams = city ? { city } : {}
  for (const k of ['specialty', 'area', 'condition'] as const) {
    const v = q[k]
    if (v !== undefined && v !== '') {
      if (!SLUG.test(v)) return `invalid ${k}`
      p[k] = v
    }
  }
  if (!p.specialty && !p.condition) p.specialty = 'sexologist'
  const dg = q.doctorGender ?? q.gender
  if (dg === 'male' || dg === 'female') p.doctorGender = dg
  if (q.online === '1') p.online = true
  if (q.video === '1') p.video = true
  if (q.exp && ['5', '10', '15', '20'].includes(q.exp)) p.exp = Number(q.exp)
  if (q.fee && ['0-500', '500', '1000', '2000'].includes(q.fee)) p.fee = q.fee
  if (q.lang && /^[a-z]{2,20}$/i.test(q.lang)) p.lang = q.lang
  if (q.rating && ['3', '4', '4.5'].includes(q.rating)) p.rating = Number(q.rating)
  if (q.sort && (SORTS as string[]).includes(q.sort)) p.sort = q.sort as Sort
  if (q.page) {
    const n = Number.parseInt(q.page, 10)
    if (!Number.isFinite(n) || n < 1 || n > 500) return 'invalid page'
    p.page = n
  }
  return p
}

api.get('/listing', async (c) => {
  const parsed = parseListingParams(c.req.query())
  if (typeof parsed === 'string') return c.json({ ok: false, error: parsed }, 400)
  const result = await runListing({ db: c.env.DB, mediaUrl: c.env.MEDIA_URL, minDoctors: Number(c.env.MIN_DOCTORS_PER_PAGE) || 3 }, parsed)
  if ('error' in result) return c.json({ ok: false, error: result.error }, result.status as 404)
  const { city, area, specialty, condition, ...rest } = result
  return ok(c, {
    city: city ? { id: city.id, slug: city.slug, name: city.name, state: city.state, lat: city.lat, lng: city.lng } : null,
    area: area ? { id: area.id, slug: area.slug, name: area.name, zone: area.zone, lat: area.lat, lng: area.lng } : null,
    specialty: specialty ? { slug: specialty.slug, name: specialty.name, plural: specialty.plural } : null,
    condition: condition ? { slug: condition.slug, name: condition.name, genderFocus: condition.gender_focus } : null,
    ...rest,
  })
})

// ---- doctor profile ----

type DoctorRow = {
  id: string; slug: string; name: string; gender: string; patients_treated: string; photo_key: string | null; qualifications: string
  registration_number: string | null; registration_council: string | null; is_verified: number; verified_at: string | null
  experience_years: number | null; languages: string; bio: string | null; video_consult: number; video_fee: number | null
  phone: string | null; whatsapp: string | null; website: string | null; google_maps_url: string | null
  rating_avg: number | null; review_count: number; recommend_pct: number | null; google_rating: number | null; google_review_count: number | null
}

type ClinicRow = {
  id: string; slug: string; name: string; address: string; pincode: string | null; locality: string | null; city_id: string; city_slug: string; city_name: string
  area_slug: string | null; area_name: string | null; lat: number; lng: number; phone: string | null; whatsapp: string | null; website: string | null
  timings: string; google_maps_url: string | null; google_rating: number | null; google_review_count: number | null; photo_key: string | null
  photo_attribution: string | null; clinic_type: string | null; fee?: number | null; is_primary?: number; doctor_timings?: string | null
}

const CLINIC_SELECT = `
  SELECT c.id, c.slug, c.name, c.address, c.pincode, c.locality, c.city_id, ci.slug city_slug, ci.name city_name, a.slug area_slug, a.name area_name,
         c.lat, c.lng, c.phone, c.whatsapp, c.website, c.timings, c.google_maps_url, c.google_rating, c.google_review_count, c.photo_key, c.photo_attribution, c.clinic_type
    FROM clinics c JOIN cities ci ON ci.id = c.city_id LEFT JOIN areas a ON a.id = c.area_id`

function clinicJson(cl: ClinicRow, mediaUrl: string) {
  return {
    id: cl.id, slug: cl.slug, name: cl.name, address: cl.address, pincode: cl.pincode, locality: cl.locality,
    citySlug: cl.city_slug, cityName: cl.city_name, city: { slug: cl.city_slug, name: cl.city_name }, areaSlug: cl.area_slug, areaName: cl.area_name,
    lat: cl.lat, lng: cl.lng, phone: cl.phone, whatsapp: cl.whatsapp, website: cl.website,
    timings: cl.doctor_timings && Object.keys(jsonObject(cl.doctor_timings)).length ? jsonObject(cl.doctor_timings) : jsonObject(cl.timings),
    googleMapsUrl: cl.google_maps_url, googleRating: cl.google_rating, googleReviewCount: cl.google_review_count,
    photoUrl: cl.photo_key ? `${mediaUrl}/${cl.photo_key}` : null, photoAttribution: cl.photo_attribution, clinicType: cl.clinic_type,
    fee: cl.fee ?? null, isPrimary: cl.is_primary === 1,
  }
}

async function refsFor(db: D1Database, doctorId: string): Promise<{ specialties: Ref[]; primary: Ref | null; conditions: Ref[] }> {
  const sp = await all<Ref & { is_primary: number }>(db, 'SELECT s.slug, s.name, ds.is_primary FROM doctor_specialties ds JOIN specialties s ON s.id = ds.specialty_id WHERE ds.doctor_id = ? ORDER BY ds.is_primary DESC, s.name', doctorId)
  const cn = await all<Ref>(db, 'SELECT cn.slug, cn.name FROM doctor_conditions dc JOIN conditions cn ON cn.id = dc.condition_id WHERE dc.doctor_id = ? ORDER BY cn.name', doctorId)
  const primary = sp.find((s) => s.is_primary === 1) ?? null
  return { specialties: sp.map((s) => ({ slug: s.slug, name: s.name })), primary: primary ? { slug: primary.slug, name: primary.name } : null, conditions: cn }
}

api.get('/doctors/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!SLUG.test(slug)) return c.json({ ok: false, error: 'invalid slug' }, 400)
  const d = await one<DoctorRow>(c.env.DB, 'SELECT * FROM doctors WHERE slug = ? AND is_published = 1', slug)
  if (!d) return c.json({ ok: false, error: 'Not found' }, 404)
  const clinics = await all<ClinicRow>(c.env.DB, `${CLINIC_SELECT} JOIN doctor_clinics dc ON dc.clinic_id = c.id WHERE dc.doctor_id = ? AND c.is_published = 1 ORDER BY dc.is_primary DESC, c.name`, d.id)
  // reuse the query that adds fee/is_primary/timings override
  const links = await all<{ clinic_id: string; consultation_fee: number | null; is_primary: number; timings: string | null }>(c.env.DB, 'SELECT clinic_id, consultation_fee, is_primary, timings FROM doctor_clinics WHERE doctor_id = ?', d.id)
  for (const cl of clinics) {
    const l = links.find((x) => x.clinic_id === cl.id)
    cl.fee = l?.consultation_fee ?? null; cl.is_primary = l?.is_primary ?? 0; cl.doctor_timings = l?.timings ?? null
  }
  const refs = await refsFor(c.env.DB, d.id)
  const reviews = await all<{ id: string; author_name: string | null; rating: number; text: string | null; treated_for: string | null; is_verified: number; source: string; created_at: string }>(
    c.env.DB, 'SELECT id, author_name, rating, text, treated_for, is_verified, source, created_at FROM reviews WHERE doctor_id = ? AND is_published = 1 ORDER BY created_at DESC LIMIT 50', d.id)
  const faqs = await all<{ question: string; answer: string }>(c.env.DB, 'SELECT question, answer FROM page_faqs WHERE page_key = ? ORDER BY sort_order', `doctor:${d.slug}`)
  const primaryClinic = clinics[0]
  const profile = {
    id: d.id, slug: d.slug, name: d.name, gender: d.gender, patientsTreated: d.patients_treated,
    photoUrl: d.photo_key ? `${c.env.MEDIA_URL}/${d.photo_key}` : null,
    qualifications: jsonStringArray(d.qualifications),
    primarySpecialty: refs.primary ?? refs.specialties[0] ?? { slug: 'sexologist', name: 'Sexologist' },
    specialties: refs.specialties, experienceYears: d.experience_years, languages: jsonStringArray(d.languages),
    isVerified: d.is_verified === 1, verifiedAt: d.verified_at, registrationNumber: d.registration_number, registrationCouncil: d.registration_council,
    videoConsult: d.video_consult === 1, videoFee: d.video_fee,
    ratingAvg: d.rating_avg, reviewCount: d.review_count, recommendPct: d.recommend_pct, googleRating: d.google_rating, googleReviewCount: d.google_review_count,
    conditions: refs.conditions, bio: d.bio, phone: d.phone, whatsapp: d.whatsapp, website: d.website, googleMapsUrl: d.google_maps_url,
    clinic: primaryClinic ? { ...clinicJson(primaryClinic, c.env.MEDIA_URL), distanceKm: null } : null,
    clinicCount: clinics.length,
    clinics: clinics.map((cl) => clinicJson(cl, c.env.MEDIA_URL)),
    reviews: reviews.map((r) => ({ id: r.id, authorName: r.author_name, rating: r.rating, text: r.text, treatedFor: r.treated_for, isVerified: r.is_verified === 1, source: r.source, createdAt: r.created_at })),
    faqs: faqs.map((f) => ({ q: f.question, a: f.answer })),
  }
  return ok(c, profile)
})

api.get('/clinics/:slug', async (c) => {
  const slug = c.req.param('slug')
  if (!SLUG.test(slug)) return c.json({ ok: false, error: 'invalid slug' }, 400)
  const cl = await one<ClinicRow>(c.env.DB, `${CLINIC_SELECT} WHERE c.slug = ? AND c.is_published = 1`, slug)
  if (!cl) return c.json({ ok: false, error: 'Not found' }, 404)
  const rows = await all<CandidateRow>(
    c.env.DB,
    `SELECT d.id d_id, d.slug d_slug, d.name d_name, d.gender d_gender, d.patients_treated d_patients, d.photo_key d_photo_key,
            d.qualifications d_qualifications, d.registration_number d_reg_no, d.registration_council d_reg_council, d.is_verified d_verified,
            d.experience_years d_exp, d.languages d_languages, d.video_consult d_video, d.video_fee d_video_fee,
            d.rating_avg d_rating, d.review_count d_reviews, d.recommend_pct d_recommend, d.google_rating d_grating, d.google_review_count d_greviews,
            c.id c_id, c.slug c_slug, c.name c_name, c.locality c_locality, c.area_id c_area_id, a.slug c_area_slug,
            c.address c_address, c.lat c_lat, c.lng c_lng, c.phone c_phone, c.whatsapp c_whatsapp, dc.consultation_fee fee
       FROM doctor_clinics dc JOIN doctors d ON d.id = dc.doctor_id JOIN clinics c ON c.id = dc.clinic_id LEFT JOIN areas a ON a.id = c.area_id
      WHERE dc.clinic_id = ? AND d.is_published = 1`,
    cl.id,
  )
  const ranked = rankCandidates(rows, { center: null, areaId: null, sort: 'relevance' })
  const doctors: DoctorCard[] = []
  for (const r of ranked) {
    const refs = await refsFor(c.env.DB, r.row.d_id)
    doctors.push(toCard(r, c.env.MEDIA_URL, refs.specialties, refs.primary, refs.conditions))
  }
  return ok(c, { ...clinicJson(cl, c.env.MEDIA_URL), doctors })
})

// ---- sitemap ----

api.get('/sitemap', async (c) => {
  const type = c.req.query('type')
  const db = c.env.DB
  const site = c.env.SITE_URL
  const min = Number(c.env.MIN_DOCTORS_PER_PAGE) || 3
  type Row = { loc: string; lastmod: string | null; n?: number }
  let rows: Row[] = []
  switch (type) {
    case 'cities':
      rows = (await all<{ slug: string; n: number }>(db, `SELECT ci.slug, (SELECT COUNT(DISTINCT d.id) FROM doctors d JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics cl ON cl.id = dc.clinic_id WHERE d.is_published = 1 AND cl.is_published = 1 AND cl.city_id = ci.id) n FROM cities ci WHERE ci.is_published = 1`))
        .filter((r) => r.n >= min).map((r) => ({ loc: `${site}/${r.slug}/sexologist`, lastmod: null }))
      break
    case 'areas': {
      // Same inclusion rule as the listing: clinic inside the area OR within its radius.
      const areas = await all<{ id: string; city_id: string; city: string; slug: string; lat: number; lng: number; r: number }>(db, 'SELECT a.id, a.city_id, ci.slug city, a.slug, a.lat, a.lng, a.default_radius_km r FROM areas a JOIN cities ci ON ci.id = a.city_id WHERE a.is_published = 1 AND ci.is_published = 1')
      const places = await all<{ d: string; city_id: string; area_id: string | null; lat: number; lng: number }>(db, `SELECT d.id d, cl.city_id, cl.area_id, cl.lat, cl.lng FROM doctors d JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics cl ON cl.id = dc.clinic_id
         WHERE d.is_published = 1 AND cl.is_published = 1 AND EXISTS (SELECT 1 FROM doctor_specialties ds JOIN specialties s ON s.id = ds.specialty_id WHERE ds.doctor_id = d.id AND s.slug = 'sexologist')`)
      rows = areas
        .map((a) => ({ a, n: new Set(places.filter((p) => p.city_id === a.city_id && (p.area_id === a.id || haversineKm(a, p) <= a.r)).map((p) => p.d)).size }))
        .filter((x) => x.n >= min).map((x) => ({ loc: `${site}/${x.a.city}/sexologist/${x.a.slug}`, lastmod: null }))
      break
    }
    case 'doctors':
      rows = (await all<{ slug: string; updated_at: string }>(db, 'SELECT slug, updated_at FROM doctors WHERE is_published = 1 ORDER BY updated_at DESC'))
        .map((r) => ({ loc: `${site}/doctor/${r.slug}`, lastmod: r.updated_at }))
      break
    case 'clinics':
      rows = (await all<{ slug: string; updated_at: string }>(db, 'SELECT c.slug, c.updated_at FROM clinics c WHERE c.is_published = 1 AND EXISTS (SELECT 1 FROM doctor_clinics dc JOIN doctors d ON d.id = dc.doctor_id WHERE dc.clinic_id = c.id AND d.is_published = 1)'))
        .map((r) => ({ loc: `${site}/clinic/${r.slug}`, lastmod: r.updated_at }))
      break
    case 'conditions':
      rows = (await all<{ city: string; cond: string; n: number }>(db, `SELECT ci.slug city, cn.slug cond, (SELECT COUNT(DISTINCT d.id) FROM doctors d JOIN doctor_conditions dcn ON dcn.doctor_id = d.id AND dcn.condition_id = cn.id JOIN doctor_clinics dc ON dc.doctor_id = d.id JOIN clinics cl ON cl.id = dc.clinic_id WHERE d.is_published = 1 AND cl.is_published = 1 AND cl.city_id = ci.id) n FROM cities ci CROSS JOIN conditions cn WHERE ci.is_published = 1`))
        .filter((r) => r.n >= min).map((r) => ({ loc: `${site}/${r.city}/${r.cond}-doctor`, lastmod: null }))
      break
    default:
      return c.json({ ok: false, error: 'type must be one of cities|areas|doctors|clinics|conditions' }, 400)
  }
  return ok(c, rows.map((r) => ({ loc: r.loc, lastmod: r.lastmod ? new Date(r.lastmod.replace(' ', 'T') + (r.lastmod.includes('Z') ? '' : 'Z')).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10) })))
})

// ---- bookings ----

type Timings = Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string][]>>
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

/** Timings JSON → object, or null when empty/invalid (= hours unknown, so no check). */
export function parseTimings(raw: string | null | undefined): Timings | null {
  if (!raw) return null
  try {
    const t = JSON.parse(raw)
    return t && typeof t === 'object' && Object.keys(t).length > 0 ? (t as Timings) : null
  } catch {
    return null
  }
}

const minutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

/** True when a slot like "12:30 PM" on YYYY-MM-DD falls inside one of that weekday's opening ranges. */
export function slotWithinTimings(timings: Timings, date: string, slot: string): boolean {
  const m = slot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!m) return false
  const t = ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2])
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
  const ranges: [string, string][] = timings[DAY_KEYS[weekday]] ?? []
  return ranges.some(([open, close]) => t >= minutes(open) && t + 30 <= minutes(close))
}


api.post('/bookings', async (c) => {
  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return c.json({ ok: false, error: 'Invalid JSON body' }, 400)
  const s = (k: string, max: number) => (typeof body[k] === 'string' ? (body[k] as string).trim().slice(0, max) : '')
  const doctorId = s('doctorId', 64), clinicId = s('clinicId', 64) || null, mode = s('mode', 10), date = s('date', 10), slot = s('slot', 40), name = s('name', 120), phone = s('phone', 20).replace(/[\s-]/g, ''), note = s('note', 1000) || null
  if (!doctorId) return c.json({ ok: false, error: 'doctorId is required' }, 400)
  if (mode !== 'clinic' && mode !== 'video') return c.json({ ok: false, error: "mode must be 'clinic' or 'video'" }, 400)
  if (mode === 'clinic' && !clinicId) return c.json({ ok: false, error: 'clinicId is required for clinic bookings' }, 400)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return c.json({ ok: false, error: 'date must be YYYY-MM-DD' }, 400)
  if (!slot) return c.json({ ok: false, error: 'slot is required' }, 400)
  if (name.length < 2) return c.json({ ok: false, error: 'name is required' }, 400)
  if (!/^(\+91)?[6-9]\d{9}$/.test(phone)) return c.json({ ok: false, error: 'phone must be a valid Indian mobile number' }, 400)
  const doctor = await one<{ id: string }>(c.env.DB, 'SELECT id FROM doctors WHERE id = ? AND is_published = 1', doctorId)
  if (!doctor) return c.json({ ok: false, error: 'Unknown doctor' }, 404)
  if (clinicId) {
    const link = await one<{ clinic_id: string; timings: string | null; clinic_timings: string }>(c.env.DB, 'SELECT dc.clinic_id, dc.timings, cl.timings clinic_timings FROM doctor_clinics dc JOIN clinics cl ON cl.id = dc.clinic_id WHERE dc.doctor_id = ? AND dc.clinic_id = ?', doctorId, clinicId)
    if (!link) return c.json({ ok: false, error: 'Doctor does not consult at this clinic' }, 400)
    // Reject slots outside the clinic's opening hours (the widget hides them, but the API must not trust it).
    const timings = parseTimings(link.timings) ?? parseTimings(link.clinic_timings)
    if (timings && !slotWithinTimings(timings, date, slot)) return c.json({ ok: false, error: 'The clinic is closed at that time' }, 400)
  }
  const id = uuid()
  await run(c.env.DB, 'INSERT INTO bookings (id, doctor_id, clinic_id, mode, date, slot, name, phone, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, doctorId, clinicId, mode, date, slot, name, phone, note)
  return c.json({ ok: true, data: { id } }, 201)
})
