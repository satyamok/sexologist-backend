/** R2 helpers for doctor/clinic photos. Keys: doctors/<slug>.jpg, clinics/<slug>.jpg */

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function photoKey(kind: 'doctors' | 'clinics', slug: string): string {
  return `${kind}/${slug}.jpg`
}

export async function putPhoto(bucket: R2Bucket, key: string, body: ArrayBuffer, contentType = 'image/jpeg'): Promise<void> {
  await bucket.put(key, body, { httpMetadata: { contentType, cacheControl: 'public, max-age=31536000' } })
}

export async function deletePhoto(bucket: R2Bucket, key: string | null): Promise<void> {
  if (key) await bucket.delete(key)
}

/** Validates an uploaded File from a multipart form. Returns null when no file was sent. */
export async function readUpload(file: unknown): Promise<{ body: ArrayBuffer; contentType: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null
  if (!ALLOWED.has(file.type)) return { error: 'Photo must be a JPEG, PNG or WebP image.' }
  if (file.size > MAX_UPLOAD_BYTES) return { error: 'Photo must be smaller than 5 MB.' }
  return { body: await file.arrayBuffer(), contentType: file.type }
}
