import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, run } from '../../lib/db'
import { AdminLayout } from './layout'
import { redirectWithFlash, ID_RE } from './common'

/** Sales: doctors to call and pitch a website to. Stored in the website_leads table. */
export const salesAdmin = new Hono<AppEnv>()

export const LEAD_STATUSES = ['new', 'called', 'interested', 'not_interested', 'won'] as const

type Lead = {
  id: string; doctor_id: string; doctor_name: string; doctor_slug: string; phone: string | null
  city: string | null; has_website: number; status: string; notes: string | null
}

/** SQL expression: 1 when the doctor or any of their clinics has a website. */
const HAS_WEBSITE = `(CASE WHEN COALESCE(TRIM(d.website),'') <> '' OR EXISTS (
  SELECT 1 FROM doctor_clinics dc JOIN clinics c2 ON c2.id = dc.clinic_id
  WHERE dc.doctor_id = d.id AND COALESCE(TRIM(c2.website),'') <> '') THEN 1 ELSE 0 END)`

/** Add every doctor without a website as a lead (idempotent). */
export async function syncWebsiteLeads(db: D1Database): Promise<number> {
  const r = await run(
    db,
    `INSERT OR IGNORE INTO website_leads (id, doctor_id)
     SELECT lower(hex(randomblob(16))), d.id FROM doctors d WHERE ${HAS_WEBSITE} = 0`,
  )
  return r.meta.changes ?? 0
}

salesAdmin.get('/', async (c) => {
  const status = c.req.query('status') ?? 'all'
  const city = c.req.query('city') ?? ''
  const rows = await all<Lead>(
    c.env.DB,
    `SELECT l.id, l.doctor_id, d.name doctor_name, d.slug doctor_slug, COALESCE(d.phone, (
        SELECT c3.phone FROM doctor_clinics dc3 JOIN clinics c3 ON c3.id = dc3.clinic_id WHERE dc3.doctor_id = d.id AND c3.phone IS NOT NULL LIMIT 1)) phone,
       (SELECT ci.name FROM doctor_clinics dc4 JOIN clinics c4 ON c4.id = dc4.clinic_id JOIN cities ci ON ci.id = c4.city_id WHERE dc4.doctor_id = d.id LIMIT 1) city,
       ${HAS_WEBSITE} has_website, l.status, l.notes
     FROM website_leads l JOIN doctors d ON d.id = l.doctor_id
     WHERE (? = 'all' OR l.status = ?)
     ORDER BY city, d.name LIMIT 500`,
    status, status,
  )
  const shown = city ? rows.filter((r) => r.city === city) : rows
  const cities = [...new Set(rows.map((r) => r.city).filter((x): x is string => !!x))].sort()
  return c.html(
    <AdminLayout title="Sales" user={c.get('user')} flash={c.req.query('flash')}>
      <h1>Sales</h1>
      <p class="muted">Doctors to call and pitch a website. Click a name to open the doctor.</p>
      <p class="actions">
        {['all', ...LEAD_STATUSES].map((s) => <a class={`btn small ${s === status ? '' : 'secondary'}`} href={`/admin/sales?status=${s}${city ? `&city=${encodeURIComponent(city)}` : ''}`}>{s.replace('_', ' ')}</a>)}
      </p>
      <form method="get" action="/admin/sales" class="actions">
        <input type="hidden" name="status" value={status} />
        <select name="city"><option value="">All cities</option>{cities.map((x) => <option value={x} selected={x === city}>{x}</option>)}</select>
        <button class="btn small secondary" type="submit">Filter</button>
      </form>
      <form method="post" action="/admin/sales/sync" class="actions">
        <button class="btn small" type="submit">Add all doctors without a website</button>
      </form>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Doctor name</th><th>City</th><th>Has website</th><th>Phone</th><th>Status / notes</th></tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr>
                <td><a href={`/admin/doctors/${l.doctor_id}`}>{l.doctor_name}</a><div class="muted"><a href={`https://sexologistindia.com/doctor/${l.doctor_slug}`} target="_blank" rel="noopener">public page</a></div></td>
                <td>{l.city ?? '—'}</td>
                <td>{l.has_website ? 'Yes' : 'No'}</td>
                <td>{l.phone ? <a href={`tel:${l.phone}`}>{l.phone}</a> : '—'}</td>
                <td>
                  <form method="post" action={`/admin/sales/${l.id}`} class="actions" style="margin:0">
                    <select name="status">{LEAD_STATUSES.map((s) => <option value={s} selected={s === l.status}>{s.replace('_', ' ')}</option>)}</select>
                    <input name="notes" value={l.notes ?? ''} placeholder="Notes" maxlength={500} />
                    <button class="btn small secondary" type="submit">Save</button>
                  </form>
                </td>
              </tr>
            ))}
            {shown.length === 0 ? <tr><td colspan={5} class="muted">No leads.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AdminLayout>,
  )
})

salesAdmin.post('/sync', async (c) => {
  const n = await syncWebsiteLeads(c.env.DB)
  return c.redirect(redirectWithFlash('/admin/sales', `${n} lead(s) added.`))
})

salesAdmin.post('/:id', async (c) => {
  const id = c.req.param('id')
  const b = await c.req.parseBody()
  const status = typeof b.status === 'string' && (LEAD_STATUSES as readonly string[]).includes(b.status) ? b.status : null
  const notes = typeof b.notes === 'string' ? b.notes.trim().slice(0, 500) || null : null
  if (!ID_RE.test(id) || !status) return c.redirect('/admin/sales')
  await run(c.env.DB, `UPDATE website_leads SET status = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`, status, notes, id)
  return c.redirect(redirectWithFlash('/admin/sales', 'Lead updated.'))
})

