import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import type { AppEnv } from '../../env'
import { requireRole, sessionIdFromRequest, userForSession } from '../../lib/auth'
import { loginHandler } from '../auth'
import { one } from '../../lib/db'
import { AdminLayout } from './layout'
import { doctorsAdmin } from './doctors'
import { clinicsAdmin } from './clinics'
import { importAdmin } from './import'
import { citiesAdmin } from './cities'
import { faqsAdmin } from './faqs'
import { usersAdmin } from './users'
import { bookingsAdmin } from './bookings'

export const admin = new Hono<AppEnv>()

admin.use('*', csrf())

admin.get('/login', async (c) => {
  const sid = sessionIdFromRequest(c)
  if (sid && (await userForSession(c.env.DB, sid))) return c.redirect('/admin')
  const error = c.req.query('error')
  const next = c.req.query('next') ?? '/admin'
  const msg = error === 'invalid' ? 'Invalid email or password.' : error === 'missing' ? 'Please enter your email and password.' : null
  return c.html(
    <AdminLayout title="Login" error={msg}>
      <div class="card login">
        <h1>Sign in</h1>
        <form method="post" action="/admin/login">
          <input type="hidden" name="next" value={next} />
          <label>Email</label>
          <input type="email" name="email" required autocomplete="username" />
          <label>Password</label>
          <input type="password" name="password" required autocomplete="current-password" />
          <div class="actions">
            <button class="btn" type="submit">Sign in</button>
          </div>
        </form>
      </div>
    </AdminLayout>,
  )
})

// The login form posts here so the Hono CSRF middleware covers it; handler lives in routes/auth.
admin.post('/login', loginHandler)

admin.use('*', requireRole('admin', 'master_admin'))

admin.get('/', async (c) => {
  const db = c.env.DB
  const count = async (sql: string) => (await one<{ n: number }>(db, sql))?.n ?? 0
  const [doctors, published, verified, clinics, cities, bookings, imports] = await Promise.all([
    count('SELECT COUNT(*) n FROM doctors'),
    count('SELECT COUNT(*) n FROM doctors WHERE is_published = 1'),
    count('SELECT COUNT(*) n FROM doctors WHERE is_verified = 1'),
    count('SELECT COUNT(*) n FROM clinics'),
    count('SELECT COUNT(*) n FROM cities WHERE is_published = 1'),
    count("SELECT COUNT(*) n FROM bookings WHERE status = 'new'"),
    count('SELECT COUNT(*) n FROM place_imports'),
  ])
  return c.html(
    <AdminLayout title="Dashboard" user={c.get('user')} flash={c.req.query('flash')}>
      <h1>Dashboard</h1>
      <div class="grid">
        <div class="stat"><b>{doctors}</b>Doctors ({published} published, {verified} verified)</div>
        <div class="stat"><b>{clinics}</b>Clinics</div>
        <div class="stat"><b>{cities}</b>Published cities</div>
        <div class="stat"><b>{bookings}</b>New booking requests</div>
        <div class="stat"><b>{imports}</b>Google imports</div>
      </div>
      <div class="actions">
        <a class="btn" href="/admin/import">Import from Google Maps</a>
        <a class="btn secondary" href="/admin/doctors/new">Add doctor manually</a>
        <a class="btn secondary" href="/admin/clinics/new">Add clinic</a>
      </div>
    </AdminLayout>,
  )
})

admin.route('/doctors', doctorsAdmin)
admin.route('/clinics', clinicsAdmin)
admin.route('/import', importAdmin)
admin.route('/cities', citiesAdmin)
admin.route('/faqs', faqsAdmin)
admin.route('/users', usersAdmin)
admin.route('/bookings', bookingsAdmin)
