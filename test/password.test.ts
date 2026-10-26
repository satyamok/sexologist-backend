import { describe, it, expect } from 'vitest'
import { pbkdf2Sync } from 'node:crypto'
import { hashPassword, verifyPassword, constantTimeEqual, PBKDF2_ITERATIONS } from '../src/lib/password'

describe('password hashing', () => {
  it('produces the documented format and verifies', async () => {
    const h = await hashPassword('correct horse battery staple')
    const parts = h.split('$')
    expect(parts).toHaveLength(4)
    expect(parts[0]).toBe('pbkdf2')
    expect(parts[1]).toBe(String(PBKDF2_ITERATIONS))
    expect(await verifyPassword('correct horse battery staple', h)).toBe(true)
    expect(await verifyPassword('wrong', h)).toBe(false)
  })

  it('uses a fresh salt each time', async () => {
    const a = await hashPassword('x'.repeat(12))
    const b = await hashPassword('x'.repeat(12))
    expect(a).not.toBe(b)
  })

  it('verifies a hash produced by scripts/seed-admin.mjs (node:crypto pbkdf2)', async () => {
    const salt = Buffer.from('0123456789abcdef')
    const hash = pbkdf2Sync('Secret-Pass-123', salt, 100000, 32, 'sha256')
    const stored = `pbkdf2$100000$${salt.toString('base64')}$${hash.toString('base64')}`
    expect(await verifyPassword('Secret-Pass-123', stored)).toBe(true)
    expect(await verifyPassword('Secret-Pass-124', stored)).toBe(false)
  })

  it('rejects malformed hashes', async () => {
    expect(await verifyPassword('x', 'plaintext')).toBe(false)
    expect(await verifyPassword('x', 'pbkdf2$10$abc$def')).toBe(false)
    expect(await verifyPassword('x', 'bcrypt$100000$aa$bb')).toBe(false)
  })

  it('constant-time compare', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(constantTimeEqual(new Uint8Array([1]), new Uint8Array([1, 0]))).toBe(false)
  })
})
