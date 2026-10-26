import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, one, run, uuid, str } from '../../lib/db'
import { hashPassword } from '../../lib/password'
import { requireRole } from '../../lib/auth'
import { AdminLayout, Field, Select, fmtDate } from './layout'
import { redirectWithFlash, ID_RE } from './common'

export const usersAdmin = new Hono<AppEnv>()
usersAdmin.use('*', requireRole('master_admin'))

type User = { id: string; email: string; name: string; role: string; is_active: number; created_at: string }
const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'master_admin', label: 'Master admin' },
]

usersAdmin.get('/', async (c) => {
  const users = await all<User>(c.env.DB, 'SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at')
  const me = c.get('user')
  return c.html(
    <AdminLayout title="Users" user={me} flash={c.req.query('flash')} error={c.req.query('error')}>
      <h1>Admin users</h1>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Created</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td><span class="badge">{u.role}</span></td>
                <td>{u.is_active ? 'Yes' : 'No'}</td>
                <td class="muted">{fmtDate(u.created_at)}</td>
                <td>
                  {u.id !== me.id ? (
                    <form method="post" action={`/admin/users/${u.id}/toggle`} class="inline"><button class="btn small secondary" type="submit">{u.is_active ? 'Deactivate' : 'Activate'}</button></form>
                  ) : <span class="muted">you</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Create user</h2>
      <form method="post" action="/admin/users" class="card">
        <div class="grid-2">
          <Field label="Name"><input type="text" name="name" required /></Field>
          <Field label="Email"><input type="email" name="email" required /></Field>
          <Field label="Password" help="At least 10 characters"><input type="password" name="password" required minlength={10} autocomplete="new-password" /></Field>
          <Field label="Role"><Select name="role" value="admin" options={ROLES} /></Field>
        </div>
        <div class="actions"><button class="btn" type="submit">Create</button></div>
      </form>
      <h2>Reset a password</h2>
      <form method="post" action="/admin/users/password" class="card">
        <div class="grid-2">
          <Field label="User"><Select name="user_id" value="" options={users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }))} blank="Select…" required /></Field>
          <Field label="New password"><input type="password" name="password" required minlength={10} autocomplete="new-password" /></Field>
        </div>
        <div class="actions"><button class="btn" type="submit">Set password</button></div>
      </form>
    </AdminLayout>,
  )
})

usersAdmin.post('/', async (c) => {
  const b = await c.req.parseBody()
  const name = str(b.name), email = str(b.email)?.toLowerCase(), password = typeof b.password === 'string' ? b.password : '', role = b.role
  if (!name || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return c.redirect(`/admin/users?error=${encodeURIComponent('Valid name and email are required.')}`)
  if (password.length < 10) return c.redirect(`/admin/users?error=${encodeURIComponent('Password must be at least 10 characters.')}`)
  if (role !== 'admin' && role !== 'master_admin') return c.redirect(`/admin/users?error=${encodeURIComponent('Invalid role.')}`)
  if (await one(c.env.DB, 'SELECT id FROM users WHERE email = ?', email)) return c.redirect(`/admin/users?error=${encodeURIComponent('Email already in use.')}`)
  await run(c.env.DB, 'INSERT INTO users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)', uuid(), email, await hashPassword(password), name, role)
  return c.redirect(redirectWithFlash('/admin/users', `User ${email} created.`))
})

usersAdmin.post('/password', async (c) => {
  const b = await c.req.parseBody()
  const userId = typeof b.user_id === 'string' && ID_RE.test(b.user_id) ? b.user_id : null
  const password = typeof b.password === 'string' ? b.password : ''
  if (!userId || password.length < 10) return c.redirect(`/admin/users?error=${encodeURIComponent('Pick a user and a password of at least 10 characters.')}`)
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").bind(await hashPassword(password), userId),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').bind(userId, c.get('sessionId')),
  ])
  return c.redirect(redirectWithFlash('/admin/users', 'Password updated; other sessions signed out.'))
})

usersAdmin.post('/:id/toggle', async (c) => {
  const id = c.req.param('id')
  if (!ID_RE.test(id) || id === c.get('user').id) return c.redirect('/admin/users')
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET is_active = CASE is_active WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?").bind(id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id),
  ])
  return c.redirect(redirectWithFlash('/admin/users', 'User updated.'))
})
