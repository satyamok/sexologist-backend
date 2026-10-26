import { Hono, type Handler } from 'hono'
import type { Context } from 'hono'
import type { AppEnv } from '../env'
import { one } from '../lib/db'
import { verifyPassword } from '../lib/password'
import { createSession, deleteSession, setSessionCookie, clearSessionCookie, sessionIdFromRequest, userForSession } from '../lib/auth'

type UserRow = { id: string; email: string; name: string; role: string; doctor_id: string | null; password_hash: string; is_active: number }

export const auth = new Hono<AppEnv>()

async function readCredentials(c: Context<AppEnv>): Promise<{ email: string; password: string; next: string | null } | null> {
  const ct = c.req.header('Content-Type') ?? ''
  let email: unknown, password: unknown, next: unknown
  if (ct.includes('application/json')) {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    email = body.email; password = body.password; next = body.next
  } else {
    const body = await c.req.parseBody()
    email = body.email; password = body.password; next = body.next
  }
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) return null
  return { email: email.trim().toLowerCase(), password, next: typeof next === 'string' ? next : null }
}

function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
}

/** Shared by POST /auth/login (JSON or form) and the admin login form at POST /admin/login. */
export const loginHandler: Handler<AppEnv> = async (c) => {
  const creds = await readCredentials(c)
  const wantsHtml = (c.req.header('Accept') ?? '').includes('text/html')
  if (!creds) {
    return wantsHtml ? c.redirect('/admin/login?error=missing') : c.json({ ok: false, error: 'email and password are required' }, 400)
  }
  const user = await one<UserRow>(c.env.DB, 'SELECT id, email, name, role, doctor_id, password_hash, is_active FROM users WHERE email = ?', creds.email)
  const valid = user !== null && user.is_active === 1 && (await verifyPassword(creds.password, user.password_hash))
  if (!valid || !user) {
    return wantsHtml ? c.redirect('/admin/login?error=invalid') : c.json({ ok: false, error: 'Invalid email or password' }, 401)
  }
  const session = await createSession(c.env.DB, user.id)
  setSessionCookie(c, session.id, session.expiresAt)
  if (wantsHtml) return c.redirect(safeNext(creds.next))
  return c.json({
    ok: true,
    data: { token: session.id, expiresAt: session.expiresAt, user: { id: user.id, email: user.email, name: user.name, role: user.role, doctorId: user.doctor_id } },
  })
}

auth.post('/login', loginHandler)

auth.post('/logout', async (c) => {
  const sid = sessionIdFromRequest(c)
  if (sid) await deleteSession(c.env.DB, sid)
  clearSessionCookie(c)
  if ((c.req.header('Accept') ?? '').includes('text/html')) return c.redirect('/admin/login')
  return c.json({ ok: true, data: null })
})

auth.get('/me', async (c) => {
  const sid = sessionIdFromRequest(c)
  const user = sid ? await userForSession(c.env.DB, sid) : null
  if (!user) return c.json({ ok: false, error: 'Unauthorized' }, 401)
  return c.json({ ok: true, data: { id: user.id, email: user.email, name: user.name, role: user.role, doctorId: user.doctor_id } })
})
