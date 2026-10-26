import { describe, it, expect, vi } from 'vitest'
import fixture from './fixtures/place.json'
import { parsePlace, parseTimings, guessDoctorName, guessClinicType, parseLocality, parsePincode, searchText, placeDetails, PlacesError, type Place } from '../src/lib/places'

const place = fixture as Place

describe('Places response parsing', () => {
  it('extracts locality from sublocality_level_1 and pincode from postal_code', () => {
    expect(parseLocality(place)).toBe('Lajpat Nagar')
    expect(parsePincode(place)).toBe('110024')
  })

  it('falls back to a pincode found in the formatted address', () => {
    expect(parsePincode({ id: 'x', formattedAddress: 'Somewhere, Indore 452010' })).toBe('452010')
    expect(parsePincode({ id: 'x', formattedAddress: 'No pin' })).toBeNull()
  })

  it('converts opening periods to the timings JSON shape', () => {
    expect(parseTimings(place)).toEqual({
      sun: [['11:00', '14:00']],
      mon: [['10:00', '13:00'], ['17:00', '20:30']],
      tue: [['10:00', '13:00']],
    })
  })

  it('guesses the doctor name only when the listing starts with Dr', () => {
    expect(guessDoctorName(place)).toBe('Dr. Rakesh Sharma')
    expect(guessDoctorName({ id: 'x', displayName: { text: 'Dr Meera Nair | Gynaecologist' } })).toBe('Dr. Meera Nair')
    expect(guessDoctorName({ id: 'x', displayName: { text: 'Apollo Clinic Saket' } })).toBeNull()
  })

  it('guesses clinic type from types / name', () => {
    expect(guessClinicType(place)).toBe('clinic')
    expect(guessClinicType({ id: 'x', types: ['hospital'], displayName: { text: 'Max Hospital' } })).toBe('hospital')
    expect(guessClinicType({ id: 'x', displayName: { text: 'Shree Ayurvedic Sexology Centre' } })).toBe('ayurvedic')
  })

  it('produces a full parsed record with photo attribution', () => {
    const p = parsePlace(place)
    expect(p).toMatchObject({
      placeId: 'ChIJTestLajpatNagar123',
      name: 'Dr. Rakesh Sharma - Sexologist in Lajpat Nagar',
      cityName: 'New Delhi',
      lat: 28.5689,
      lng: 77.2412,
      phone: '098110 12345',
      website: 'https://example.com/dr-rakesh',
      rating: 4.6,
      reviewCount: 212,
      clinicType: 'clinic',
      doctorNameGuess: 'Dr. Rakesh Sharma',
      photoName: 'places/ChIJTestLajpatNagar123/photos/abc',
      photoAttribution: 'Photo: Rakesh Sharma via Google',
    })
  })
})

describe('Places API client', () => {
  it('sends the field mask, key and location bias on searchText', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body.textQuery).toBe('sexologist in Lajpat Nagar')
      expect(body.regionCode).toBe('IN')
      expect((body.locationBias as { circle: { radius: number } }).circle.radius).toBe(6000)
      const headers = init?.headers as Record<string, string>
      expect(headers['X-Goog-Api-Key']).toBe('KEY')
      expect(headers['X-Goog-FieldMask']).toContain('places.addressComponents')
      return new Response(JSON.stringify({ places: [place] }), { status: 200 })
    })
    const results = await searchText('KEY', { textQuery: 'sexologist in Lajpat Nagar', center: { lat: 28.56, lng: 77.24 }, radiusMeters: 6000 }, fetcher as unknown as typeof fetch)
    expect(results).toHaveLength(1)
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://places.googleapis.com/v1/places:searchText')
  })

  it('throws PlacesError with the API message', async () => {
    const fetcher = async () => new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 403 })
    await expect(placeDetails('KEY', 'abc', fetcher as unknown as typeof fetch)).rejects.toBeInstanceOf(PlacesError)
    await expect(placeDetails('KEY', 'abc', fetcher as unknown as typeof fetch)).rejects.toThrow(/403.*API key not valid/)
  })
})
