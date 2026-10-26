import type { Context, MiddlewareHandler } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { AppEnv, Role, SessionUser } from '../env'
import { one, run, uuid } from './db'

export const SESSION_COOKIE = 'si_admin'
const SESSION_DAYS = 30

type UserRow = SessionUser & { is_active: number }

export async function createSession(db: D1Database, userId: string): Promise<{ id: string; expiresAt: string }> {
  const id = uuid() + uuid().replace(/-/g, '')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString()
  await run(db, 'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)', id, userId, expiresAt)
  return { id, expiresAt }
}

export async function deleteSession(db: D1Database, id: string): Promise<void> {
  await run(db, 'DELETE FROM sessions WHERE id = ?', id)
}

export async function userForSession(db: D1Database, sessionId: string): Promise<SessionUser | null> {
  const row = await one<UserRow>(
    db,
    `SELECT u.id, u.email, u.name, u.role, u.doctor_id, u.is_active
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.expires_at > datetime('now')`,
    sessionId,
  )
  if (!row || !row.is_active) return null
  return { id: row.id, email: row.email, name: row.name, role: row.role, doctor_id: row.doctor_id }
}

export function sessionIdFromRequest(c: Context<AppEnv>): string | null {
  const auth = c.req.header('Authorization')
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7).trim() || null
  return getCookie(c, SESSION_COOKIE) ?? null
}

export function isSecureRequest(c: Context<AppEnv>): boolean {
  return new URL(c.req.url).protocol === 'https:'
}

export function setSessionCookie(c: Context<AppEnv>, sessionId: string, expiresAt: string): void {
  setCookie(c, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: isSecureRequest(c),
    path: '/',
    expires: new Date(expiresAt),
  })
}

export function clearSessionCookie(c: Context<AppEnv>): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

/** Loads the user if a session exists; never rejects. */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const sid = sessionIdFromRequest(c)
  if (sid) {
    const user = await userForSession(c.env.DB, sid)
    if (user) {
      c.set('user', user)
      c.set('sessionId', sid)
    }
  }
  await next()
}

/**
 * Requires an authenticated user with one of the given roles.
 * HTML requests (admin UI) redirect to /admin/login; others get JSON 401/403.
 */
export function requireRole(...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const sid = sessionIdFromRequest(c)
    const user = sid ? await userForSession(c.env.DB, sid) : null
    const wantsHtml = (c.req.header('Accept') ?? '').includes('text/html')
    if (!user) {
      if (wantsHtml) {
        const next = encodeURIComponent(new URL(c.req.url).pathname)
        return c.redirect(`/admin/login?next=${next}`)
      }
      return c.json({ ok: false, error: 'Unauthorized' }, 401)
    }
    if (!roles.includes(user.role)) {
      if (wantsHtml) return c.text('Forbidden', 403)
      return c.json({ ok: false, error: 'Forbidden' }, 403)
    }
    c.set('user', user)
    c.set('sessionId', sid ?? '')
    await next()
  }
}
