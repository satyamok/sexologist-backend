const EARTH_RADIUS_KM = 6371

export type LatLng = { lat: number; lng: number }

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(s)))
}

export type BoundingBox = { minLat: number; maxLat: number; minLng: number; maxLng: number }

/** Approximate box around a point; used to pre-filter in SQL before exact haversine in JS. */
export function boundingBox(center: LatLng, radiusKm: number): BoundingBox {
  const dLat = radiusKm / 111.32
  const cosLat = Math.cos((center.lat * Math.PI) / 180)
  const dLng = radiusKm / (111.32 * Math.max(cosLat, 0.01))
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  }
}

export function roundKm(km: number): number {
  return Math.round(km * 10) / 10
}

export function isValidLatLng(lat: number | null, lng: number | null): lat is number {
  return lat !== null && lng !== null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}
