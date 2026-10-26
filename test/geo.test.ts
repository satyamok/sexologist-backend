import { describe, it, expect } from 'vitest'
import { haversineKm, boundingBox, isValidLatLng, roundKm } from '../src/lib/geo'

const delhi = { lat: 28.6139, lng: 77.209 }
const bangalore = { lat: 12.9716, lng: 77.5946 }
const lajpat = { lat: 28.5677, lng: 77.2433 }

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(delhi, delhi)).toBe(0)
  })
  it('matches known distances', () => {
    expect(haversineKm(delhi, bangalore)).toBeGreaterThan(1730)
    expect(haversineKm(delhi, bangalore)).toBeLessThan(1760)
    expect(haversineKm(delhi, lajpat)).toBeGreaterThan(5)
    expect(haversineKm(delhi, lajpat)).toBeLessThan(7)
  })
  it('is symmetric', () => {
    expect(haversineKm(delhi, lajpat)).toBeCloseTo(haversineKm(lajpat, delhi))
  })
})

describe('boundingBox', () => {
  it('contains points within the radius', () => {
    const box = boundingBox(delhi, 6)
    expect(lajpat.lat).toBeGreaterThan(box.minLat)
    expect(lajpat.lat).toBeLessThan(box.maxLat)
    expect(lajpat.lng).toBeGreaterThan(box.minLng)
    expect(lajpat.lng).toBeLessThan(box.maxLng)
    expect(bangalore.lat).toBeLessThan(box.minLat)
  })
  it('widens longitude away from the equator', () => {
    const eq = boundingBox({ lat: 0, lng: 0 }, 10)
    const north = boundingBox({ lat: 60, lng: 0 }, 10)
    expect(north.maxLng - north.minLng).toBeGreaterThan(eq.maxLng - eq.minLng)
  })
})

describe('misc', () => {
  it('validates coordinates', () => {
    expect(isValidLatLng(28.6, 77.2)).toBe(true)
    expect(isValidLatLng(null, 77.2)).toBe(false)
    expect(isValidLatLng(91, 0)).toBe(false)
    expect(isValidLatLng(0, 181)).toBe(false)
  })
  it('rounds to one decimal', () => {
    expect(roundKm(5.678)).toBe(5.7)
  })
})
