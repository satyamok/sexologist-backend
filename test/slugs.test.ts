import { describe, expect, it } from 'vitest'
import { normaliseSlug, SLUG_RE } from '../src/lib/slugs'

describe('slug normalisation', () => {
  it('cleans free text into a slug', () => {
    expect(normaliseSlug(' Dr. Vijayant Govinda Gupta – Urologist, Delhi ')).toBe('dr-vijayant-govinda-gupta-urologist-delhi')
    expect(normaliseSlug('dr-arjun-mehta-urologist-delhi')).toBe('dr-arjun-mehta-urologist-delhi')
  })
  it('rejects empty or symbol-only input', () => {
    expect(normaliseSlug('---')).toBeNull()
    expect(normaliseSlug('')).toBeNull()
  })
  it('matches the public slug pattern', () => {
    expect(SLUG_RE.test('a-b-c')).toBe(true)
    expect(SLUG_RE.test('a--b')).toBe(false)
    expect(SLUG_RE.test('-a')).toBe(false)
  })
})
