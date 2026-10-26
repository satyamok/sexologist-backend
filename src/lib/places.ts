/** Google Places API (New) client + response parsing used by the admin import flow. */

const BASE = 'https://places.googleapis.com/v1'

const PLACE_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'primaryType',
  'primaryTypeDisplayName', 'types', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri',
  'googleMapsUri', 'businessStatus', 'photos', 'addressComponents', 'regularOpeningHours',
]

export type LocalizedText = { text?: string; languageCode?: string }

export type PlacePhoto = {
  name: string
  widthPx?: number
  heightPx?: number
  authorAttributions?: { displayName?: string; uri?: string; photoUri?: string }[]
}

export type AddressComponent = { longText?: string; shortText?: string; types?: string[] }

export type OpeningPeriodPoint = { day: number; hour: number; minute: number }

export type Place = {
  id: string
  displayName?: LocalizedText
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  primaryType?: string
  primaryTypeDisplayName?: LocalizedText
  types?: string[]
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  googleMapsUri?: string
  businessStatus?: string
  photos?: PlacePhoto[]
  addressComponents?: AddressComponent[]
  regularOpeningHours?: { periods?: { open?: OpeningPeriodPoint; close?: OpeningPeriodPoint }[]; weekdayDescriptions?: string[] }
  reviews?: unknown[]
  editorialSummary?: LocalizedText
}

export class PlacesError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

async function readError(res: Response): Promise<PlacesError> {
  let detail = ''
  try {
    const body = (await res.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? ''
  } catch {
    /* ignore */
  }
  return new PlacesError(`Places API ${res.status}${detail ? `: ${detail}` : ''}`, res.status)
}

export type SearchOptions = { textQuery: string; center?: { lat: number; lng: number }; radiusMeters?: number }

export async function searchText(apiKey: string, opts: SearchOptions, fetcher: typeof fetch = fetch): Promise<Place[]> {
  const body: Record<string, unknown> = {
    textQuery: opts.textQuery,
    regionCode: 'IN',
    languageCode: 'en',
    pageSize: 20,
  }
  if (opts.center) {
    body.locationBias = {
      circle: {
        center: { latitude: opts.center.lat, longitude: opts.center.lng },
        radius: Math.min(50_000, Math.max(100, opts.radiusMeters ?? 10_000)),
      },
    }
  }
  const res = await fetcher(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': PLACE_FIELDS.map((f) => `places.${f}`).join(','),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await readError(res)
  const data = (await res.json()) as { places?: Place[] }
  return data.places ?? []
}

export async function placeDetails(apiKey: string, placeId: string, fetcher: typeof fetch = fetch): Promise<Place> {
  const res = await fetcher(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [...PLACE_FIELDS, 'reviews', 'editorialSummary'].join(','),
    },
  })
  if (!res.ok) throw await readError(res)
  return (await res.json()) as Place
}

/** Returns the JPEG bytes of a photo resource (`places/.../photos/...`). */
export async function fetchPhoto(apiKey: string, photoName: string, fetcher: typeof fetch = fetch, maxWidthPx = 1200): Promise<ArrayBuffer> {
  const url = `${BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${encodeURIComponent(apiKey)}`
  const res = await fetcher(url, { redirect: 'follow' })
  if (!res.ok) throw await readError(res)
  return res.arrayBuffer()
}

// ---------- parsing ----------

export type ClinicType = 'clinic' | 'hospital' | 'ayurvedic' | 'online'
export type Timings = Record<string, [string, string][]>

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function componentText(place: Place, ...types: string[]): string | null {
  for (const t of types) {
    const c = place.addressComponents?.find((x) => x.types?.includes(t))
    if (c?.longText) return c.longText
  }
  return null
}

export function parseLocality(place: Place): string | null {
  return componentText(place, 'sublocality_level_1', 'sublocality', 'neighborhood', 'sublocality_level_2')
}

export function parsePincode(place: Place): string | null {
  const fromComponent = componentText(place, 'postal_code')
  if (fromComponent) return fromComponent
  const m = place.formattedAddress?.match(/\b[1-9]\d{5}\b/)
  return m ? m[0] : null
}

export function parseCityName(place: Place): string | null {
  return componentText(place, 'locality', 'administrative_area_level_3', 'administrative_area_level_2')
}

function hhmm(p: OpeningPeriodPoint): string {
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute ?? 0).padStart(2, '0')}`
}

/** regularOpeningHours.periods -> {mon:[["10:00","13:00"],...]} */
export function parseTimings(place: Place): Timings {
  const out: Timings = {}
  for (const period of place.regularOpeningHours?.periods ?? []) {
    if (!period.open) continue
    const key = DAY_KEYS[period.open.day]
    if (!key) continue
    const close = period.close ? hhmm(period.close) : '23:59'
    ;(out[key] ??= []).push([hhmm(period.open), close])
  }
  return out
}

export function guessClinicType(place: Place): ClinicType {
  const types = place.types ?? []
  const name = (place.displayName?.text ?? '').toLowerCase()
  if (types.includes('hospital') || /\bhospital\b/.test(name)) return 'hospital'
  if (/ayur|vedic|unani|herbal/.test(name) || types.some((t) => t.includes('ayur'))) return 'ayurvedic'
  return 'clinic'
}

/** If the listing is a practitioner ("Dr. X - Sexologist"), guess the doctor's name; else null. */
export function guessDoctorName(place: Place): string | null {
  const raw = place.displayName?.text?.trim() ?? ''
  if (!/^dr\.?\s/i.test(raw)) return null
  const first = raw.split(/\s[-|,(:]\s?|\s[-|]\s|\s\(|\s–\s|\s—\s/)[0] ?? raw
  const cleaned = first.replace(/^dr\.?\s*/i, 'Dr. ').replace(/\s+/g, ' ').trim()
  return cleaned.length > 3 ? cleaned : null
}

export function photoAttribution(photo: PlacePhoto | undefined): string | null {
  const names = (photo?.authorAttributions ?? []).map((a) => a.displayName).filter((n): n is string => !!n)
  return names.length ? `Photo: ${names.join(', ')} via Google` : null
}

export type ParsedPlace = {
  placeId: string
  name: string
  address: string
  locality: string | null
  pincode: string | null
  cityName: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  mapsUrl: string | null
  rating: number | null
  reviewCount: number | null
  timings: Timings
  clinicType: ClinicType
  doctorNameGuess: string | null
  photoName: string | null
  photoAttribution: string | null
  /** Up to MAX_GOOGLE_PHOTOS photos for the clinic gallery (never used for the doctor profile picture). */
  photos: { name: string; attribution: string | null }[]
}

export const MAX_GOOGLE_PHOTOS = 5

export function parsePlacePhotos(place: Place, max = MAX_GOOGLE_PHOTOS): { name: string; attribution: string | null }[] {
  return (place.photos ?? [])
    .filter((p): p is PlacePhoto => !!p?.name)
    .slice(0, max)
    .map((p) => ({ name: p.name, attribution: photoAttribution(p) }))
}

export function parsePlace(place: Place): ParsedPlace {
  const photo = place.photos?.[0]
  return {
    photos: parsePlacePhotos(place),
    placeId: place.id,
    name: place.displayName?.text ?? '',
    address: place.formattedAddress ?? '',
    locality: parseLocality(place),
    pincode: parsePincode(place),
    cityName: parseCityName(place),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
    timings: parseTimings(place),
    clinicType: guessClinicType(place),
    doctorNameGuess: guessDoctorName(place),
    photoName: photo?.name ?? null,
    photoAttribution: photoAttribution(photo),
  }
}
