#!/usr/bin/env node
/**
 * Upserts a master_admin user into D1 via `wrangler d1 execute`.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' ADMIN_NAME='You' npm run seed:admin -- --local
 *   (omit --local to target the remote/production database)
 *
 * Password hash format matches src/lib/password.ts: pbkdf2$100000$<salt b64>$<hash b64>
 */
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const ITERATIONS = 100000
const DB_NAME = 'sexologistindia-db'

const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase()
const password = process.env.ADMIN_PASSWORD ?? ''
const name = (process.env.ADMIN_NAME ?? 'Admin').trim()
const local = process.argv.includes('--local')

if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
  console.error('ADMIN_EMAIL is required and must be a valid email.')
  process.exit(1)
}
if (password.length < 10) {
  console.error('ADMIN_PASSWORD is required (at least 10 characters).')
  process.exit(1)
}

const salt = randomBytes(16)
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256')
const passwordHash = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`

/** SQL string literal: double single quotes. Values here are ours (email/name/hash), not arbitrary SQL. */
const q = (s) => `'${String(s).replace(/'/g, "''")}'`

const sql = `INSERT INTO users (id, email, password_hash, name, role, is_active)
VALUES (${q(randomUUID())}, ${q(email)}, ${q(passwordHash)}, ${q(name)}, 'master_admin', 1)
ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, name = excluded.name, role = 'master_admin', is_active = 1, updated_at = datetime('now');`

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = ['wrangler', 'd1', 'execute', DB_NAME, local ? '--local' : '--remote', '--command', sql]
console.log(`Upserting master_admin ${email} into ${local ? 'local' : 'REMOTE'} D1 (${DB_NAME})...`)
const result = spawnSync('npx', args, { cwd: projectRoot, stdio: 'inherit', env: process.env })
if (result.status !== 0) {
  console.error('wrangler d1 execute failed.')
  process.exit(result.status ?? 1)
}
console.log('Done. Sign in at /admin/login.')
