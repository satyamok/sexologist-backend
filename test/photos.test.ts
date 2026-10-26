import { describe, it, expect } from 'vitest'
import { orderPhotos, coverKey, reorderIds, remainingSlots, photosJson, MAX_PHOTOS_PER_CLINIC, type PhotoRow } from '../src/lib/photos'
import { parsePlacePhotos, parsePlace, type Place } from '../src/lib/places'
import place from './fixtures/place.json'

const row = (id: string, sort: number, created = '2026-10-01 10:00:00', extra: Partial<PhotoRow> = {}): PhotoRow => ({
  id, owner_type: 'clinic', owner_id: 'c1', key: `clinics/x-${id}.jpg`, caption: null, attribution: null, sort_order: sort, created_at: created, ...extra,
})

describe('gallery ordering', () => {
  it('orders by sort_order, then created_at, then id', () => {
    const photos = [row('b', 1), row('c', 0, '2026-10-02 00:00:00'), row('a', 0, '2026-10-01 00:00:00'), row('d', 0, '2026-10-01 00:00:00')]
    expect(orderPhotos(photos).map((p) => p.id)).toEqual(['a', 'd', 'c', 'b'])
  })
  it('does not mutate the input', () => {
    const photos = [row('b', 1), row('a', 0)]
    orderPhotos(photos)
    expect(photos[0]!.id).toBe('b')
  })
})

describe('coverKey (clinics.photo_key sync)', () => {
  it('is the first photo in gallery order', () => {
    expect(coverKey([row('b', 5), row('a', 2)])).toBe('clinics/x-a.jpg')
  })
  it('is null for an empty gallery', () => {
    expect(coverKey([])).toBeNull()
  })
})

describe('reorderIds', () => {
  const ids = ['a', 'b', 'c', 'd']
  it('moves up / down by one', () => {
    expect(reorderIds(ids, 'c', 'up')).toEqual(['a', 'c', 'b', 'd'])
    expect(reorderIds(ids, 'b', 'down')).toEqual(['a', 'c', 'b', 'd'])
  })
  it('is a no-op at the edges and for unknown ids', () => {
    expect(reorderIds(ids, 'a', 'up')).toEqual(ids)
    expect(reorderIds(ids, 'd', 'down')).toEqual(ids)
    expect(reorderIds(ids, 'zzz', 'cover')).toEqual(ids)
  })
  it('"cover" moves the photo to the front and keeps the rest in order', () => {
    expect(reorderIds(ids, 'c', 'cover')).toEqual(['c', 'a', 'b', 'd'])
    expect(reorderIds(ids, 'a', 'cover')).toEqual(ids)
  })
})

describe('remainingSlots (max 12 per clinic)', () => {
  it('caps uploads at the limit', () => {
    expect(MAX_PHOTOS_PER_CLINIC).toBe(12)
    expect(remainingSlots(0, 3)).toBe(3)
    expect(remainingSlots(10, 5)).toBe(2)
    expect(remainingSlots(12, 1)).toBe(0)
    expect(remainingSlots(13, 1)).toBe(0)
  })
})

describe('photosJson', () => {
  it('maps ordered photos to {url, caption, attribution}', () => {
    const out = photosJson([row('b', 1, undefined, { caption: 'Reception' }), row('a', 0, undefined, { attribution: 'Photo: X via Google' })], 'https://media.example')
    expect(out).toEqual([
      { url: 'https://media.example/clinics/x-a.jpg', caption: null, attribution: 'Photo: X via Google' },
      { url: 'https://media.example/clinics/x-b.jpg', caption: 'Reception', attribution: null },
    ])
  })
})

describe('Google import photos', () => {
  it('takes at most 5 photos with attribution, skipping entries without a name', () => {
    const p: Place = {
      id: 'x',
      photos: [
        { name: 'places/x/photos/1', authorAttributions: [{ displayName: 'A' }] },
        { name: '' } as never,
        { name: 'places/x/photos/2' },
        { name: 'places/x/photos/3' },
        { name: 'places/x/photos/4' },
        { name: 'places/x/photos/5' },
        { name: 'places/x/photos/6' },
      ],
    }
    const photos = parsePlacePhotos(p)
    expect(photos).toHaveLength(5)
    expect(photos[0]).toEqual({ name: 'places/x/photos/1', attribution: 'Photo: A via Google' })
    expect(photos[1]).toEqual({ name: 'places/x/photos/2', attribution: null })
    expect(photos.map((x) => x.name)).not.toContain('places/x/photos/6')
  })
  it('parsePlace exposes the gallery list next to the legacy first-photo fields', () => {
    const parsed = parsePlace(place as Place)
    expect(parsed.photos).toEqual([{ name: parsed.photoName, attribution: parsed.photoAttribution }])
  })
})
