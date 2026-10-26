import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, run } from '../../lib/db'
import { AdminLayout, fmtDate } from './layout'
import { redirectWithFlash, ID_RE } from './common'

export const bookingsAdmin = new Hono<AppEnv>()

type Booking = { id: string; doctor_id: string; doctor_name: string; clinic_name: string | null; mode: string; date: string; slot: string; name: string; phone: string; note: string | null; status: string; created_at: string }
const STATUSES = ['new', 'contacted', 'confirmed', 'cancelled'] as const

bookingsAdmin.get('/', async (c) => {
  const status = c.req.query('status') ?? 'new'
  const rows = await all<Booking>(
    c.env.DB,
    `SELECT b.*, d.name doctor_name, cl.name clinic_name FROM bookings b JOIN doctors d ON d.id = b.doctor_id LEFT JOIN clinics cl ON cl.id = b.clinic_id
      WHERE (? = 'all' OR b.status = ?) ORDER BY b.created_at DESC LIMIT 200`,
    status, status,
  )
  return c.html(
    <AdminLayout title="Bookings" user={c.get('user')} flash={c.req.query('flash')}>
      <h1>Booking requests</h1>
      <p class="actions">{['new', 'contacted', 'confirmed', 'cancelled', 'all'].map((s) => <a class={`btn small ${s === status ? '' : 'secondary'}`} href={`/admin/bookings?status=${s}`}>{s}</a>)}</p>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Received</th><th>Patient</th><th>Doctor</th><th>Mode</th><th>When</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((b) => (
              <tr>
                <td class="muted">{fmtDate(b.created_at)}</td>
                <td>{b.name}<div class="muted">{b.phone}</div></td>
                <td><a href={`/admin/doctors/${b.doctor_id}`}>{b.doctor_name}</a>{b.clinic_name ? <div class="muted">{b.clinic_name}</div> : null}</td>
                <td>{b.mode}</td>
                <td>{b.date} {b.slot}</td>
                <td>{b.note}</td>
                <td>
                  <form method="post" action={`/admin/bookings/${b.id}`} class="actions" style="margin:0">
                    <select name="status">{STATUSES.map((s) => <option value={s} selected={s === b.status}>{s}</option>)}</select>
                    <button class="btn small secondary" type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colspan={7} class="muted">No bookings.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AdminLayout>,
  )
})

bookingsAdmin.post('/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.parseBody()
  const status = typeof b.status === 'string' && (STATUSES as readonly string[]).includes(b.status) ? b.status : null
  if (!ID_RE.test(id) || !status) return c.redirect('/admin/bookings')
  await run(c.env.DB, 'UPDATE bookings SET status = ? WHERE id = ?', status, id)
  return c.redirect(redirectWithFlash(`/admin/bookings?status=${status}`, 'Booking updated.'))
})
