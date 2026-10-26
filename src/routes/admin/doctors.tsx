import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, one, run, uuid, doctorSlug, jsonStringArray, toInt, str } from '../../lib/db'
import { parseDoctorForm, doctorColumns, relationStatements } from '../../lib/doctorForm'
import { photoKey, putPhoto, deletePhoto, readUpload } from '../../lib/media'
import { AdminLayout, yesNo } from './layout'
import { DoctorFields } from './doctorFormView'
import { lookups, redirectWithFlash, ID_RE } from './common'

export const doctorsAdmin = new Hono<AppEnv>()

type DoctorRow = {
  id: string; slug: string; name: string; gender: string; patients_treated: string; photo_key: string | null; photo_attribution: string | null
  qualifications: string; registration_number: string | null; registration_council: string | null; is_verified: number
  experience_years: number | null; languages: string; bio: string | null; video_consult: number; video_fee: number | null
  phone: string | null; whatsapp: string | null; email: string | null; website: string | null; google_maps_url: string | null
  google_place_id: string | null; rating_avg: number | null; review_count: number; is_published: number; source: string; updated_at: string
}

type ClinicLink = { clinic_id: string; name: string; slug: string; address: string; city_name: string; consultation_fee: number | null; is_primary: number; photo_count: number }

doctorsAdmin.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 80)
  const status = c.req.query('status') ?? ''
  const where: string[] = []
  const params: (string | number)[] = []
  if (q) { where.push('(d.name LIKE ? OR d.slug LIKE ?)'); params.push(`%${q}%`, `%${q}%`) }
  if (status === 'published') where.push('d.is_published = 1')
  if (status === 'draft') where.push('d.is_published = 0')
  if (status === 'unverified') where.push('d.is_verified = 0')
  const rows = await all<DoctorRow & { clinic_count: number; city_names: string | null }>(
    c.env.DB,
    `SELECT d.*, (SELECT COUNT(*) FROM doctor_clinics dc WHERE dc.doctor_id = d.id) clinic_count,
            (SELECT GROUP_CONCAT(DISTINCT ci.name) FROM doctor_clinics dc JOIN clinics cl ON cl.id = dc.clinic_id JOIN cities ci ON ci.id = cl.city_id WHERE dc.doctor_id = d.id) city_names
       FROM doctors d ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.updated_at DESC LIMIT 200`,
    ...params,
  )
  return c.html(
    <AdminLayout title="Doctors" user={c.get('user')} flash={c.req.query('flash')}>
      <h1>Doctors <span class="muted">({rows.length})</span></h1>
      <form method="get" class="card filters">
        <div><label>Search</label><input type="search" name="q" value={q} placeholder="Name or slug" /></div>
        <div><label>Status</label>
          <select name="status">
            <option value="">All</option>
            <option value="published" selected={status === 'published'}>Published</option>
            <option value="draft" selected={status === 'draft'}>Draft</option>
            <option value="unverified" selected={status === 'unverified'}>Not verified</option>
          </select>
        </div>
        <div style="flex:0"><button class="btn" type="submit">Filter</button></div>
        <div style="flex:0"><a class="btn secondary" href="/admin/doctors/new">New doctor</a></div>
        <div style="flex:0"><a class="btn secondary" href="/admin/import">Import</a></div>
      </form>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>Cities</th><th>Clinics</th><th>Verified</th><th>Published</th><th>Source</th><th></th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr>
                <td><a href={`/admin/doctors/${d.id}`}>{d.name}</a><div class="muted">{d.slug}</div></td>
                <td>{d.city_names ?? '—'}</td>
                <td>{d.clinic_count}</td>
                <td>
                  <form method="post" action={`/admin/doctors/${d.id}/toggle`} class="inline">
                    <input type="hidden" name="field" value="is_verified" />
                    <button class={`btn small ${d.is_verified ? '' : 'secondary'}`} type="submit" disabled={!d.registration_number} title={d.registration_number ? '' : 'Needs registration number'}>{yesNo(d.is_verified)}</button>
                  </form>
                </td>
                <td>
                  <form method="post" action={`/admin/doctors/${d.id}/toggle`} class="inline">
                    <input type="hidden" name="field" value="is_published" />
                    <button class={`btn small ${d.is_published ? '' : 'secondary'}`} type="submit">{yesNo(d.is_published)}</button>
                  </form>
                </td>
                <td><span class="badge">{d.source}</span></td>
                <td><a href={`/admin/doctors/${d.id}`}>Edit</a></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colspan={7} class="muted">No doctors yet. Use Import or New doctor.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AdminLayout>,
  )
})

doctorsAdmin.get('/new', async (c) => {
  const lk = await lookups(c.env.DB)
  const sexologist = lk.specialties.find((s) => s.slug === 'sexologist')
  return c.html(
    <AdminLayout title="New doctor" user={c.get('user')}>
      <h1>New doctor</h1>
      <form method="post" action="/admin/doctors" class="card">
        <DoctorFields v={{ specialty_ids: sexologist ? [sexologist.id] : [], patients_treated: 'both' }} specialties={lk.specialties} conditions={lk.conditions} />
        <div class="actions"><button class="btn" type="submit">Create doctor</button><a class="btn secondary" href="/admin/doctors">Cancel</a></div>
      </form>
    </AdminLayout>,
  )
})

doctorsAdmin.post('/', async (c) => {
  const body = await c.req.parseBody({ all: true })
  const parsed = parseDoctorForm(body)
  if (!parsed.ok) {
    const lk = await lookups(c.env.DB)
    return c.html(
      <AdminLayout title="New doctor" user={c.get('user')} error={parsed.errors.join(' ')}>
        <h1>New doctor</h1>
        <form method="post" action="/admin/doctors" class="card">
          <DoctorFields v={{ name: str(body.doctor_name as string), specialty_ids: [] }} specialties={lk.specialties} conditions={lk.conditions} />
          <div class="actions"><button class="btn" type="submit">Create doctor</button></div>
        </form>
      </AdminLayout>,
      400,
    )
  }
  const d = parsed.value
  const id = uuid()
  const slug = await doctorSlug(c.env.DB, d.name, d.primary_specialty_id ?? d.specialty_ids[0], null)
  const { cols, vals } = doctorColumns(d, c.get('user').id)
  const stmts = [
    c.env.DB.prepare(`INSERT INTO doctors (id, slug, source, created_by, ${cols.join(', ')}) VALUES (?, ?, 'manual', ?, ${cols.map(() => '?').join(', ')})`).bind(id, slug, c.get('user').id, ...vals),
    ...relationStatements(c.env.DB, id, d),
  ]
  await c.env.DB.batch(stmts)
  return c.redirect(redirectWithFlash(`/admin/doctors/${id}`, 'Doctor created. Now add a clinic location below.'))
})

async function loadDoctor(db: D1Database, id: string): Promise<DoctorRow | null> {
  if (!ID_RE.test(id)) return null
  return one<DoctorRow>(db, 'SELECT * FROM doctors WHERE id = ?', id)
}

doctorsAdmin.get('/:id', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  const db = c.env.DB
  const [lk, clinics, specIds, condIds, primary] = await Promise.all([
    lookups(db),
    all<ClinicLink>(db, "SELECT dc.clinic_id, cl.name, cl.slug, cl.address, ci.name city_name, dc.consultation_fee, dc.is_primary, (SELECT COUNT(*) FROM photos p WHERE p.owner_type = 'clinic' AND p.owner_id = cl.id) photo_count FROM doctor_clinics dc JOIN clinics cl ON cl.id = dc.clinic_id JOIN cities ci ON ci.id = cl.city_id WHERE dc.doctor_id = ? ORDER BY dc.is_primary DESC, cl.name", d.id),
    all<{ specialty_id: string }>(db, 'SELECT specialty_id FROM doctor_specialties WHERE doctor_id = ?', d.id),
    all<{ condition_id: string }>(db, 'SELECT condition_id FROM doctor_conditions WHERE doctor_id = ?', d.id),
    one<{ specialty_id: string }>(db, 'SELECT specialty_id FROM doctor_specialties WHERE doctor_id = ? AND is_primary = 1', d.id),
  ])
  const clinicQ = (c.req.query('clinic_q') ?? '').trim().slice(0, 80)
  const clinicResults = clinicQ
    ? await all<{ id: string; name: string; address: string; city_name: string }>(db, 'SELECT cl.id, cl.name, cl.address, ci.name city_name FROM clinics cl JOIN cities ci ON ci.id = cl.city_id WHERE cl.name LIKE ? AND cl.id NOT IN (SELECT clinic_id FROM doctor_clinics WHERE doctor_id = ?) ORDER BY cl.name LIMIT 20', `%${clinicQ}%`, d.id)
    : []
  const v = {
    ...d,
    qualifications: jsonStringArray(d.qualifications),
    languages: jsonStringArray(d.languages),
    specialty_ids: specIds.map((s) => s.specialty_id),
    condition_ids: condIds.map((x) => x.condition_id),
    primary_specialty_id: primary?.specialty_id ?? null,
  }
  return c.html(
    <AdminLayout title={d.name} user={c.get('user')} flash={c.req.query('flash')} error={c.req.query('error')}>
      <h1>{d.name} {d.is_published ? <span class="badge ok">published</span> : <span class="badge warn">draft</span>} {d.is_verified ? <span class="badge ok">verified</span> : null}</h1>
      <p class="muted">Slug: <code>{d.slug}</code> · Source: {d.source} · Public page: <a href={`${c.env.SITE_URL}/doctor/${d.slug}`} target="_blank" rel="noopener">{`/doctor/${d.slug}`}</a></p>

      <form method="post" action={`/admin/doctors/${d.id}`} class="card">
        <h2 style="margin-top:0">Profile</h2>
        <DoctorFields v={v} specialties={lk.specialties} conditions={lk.conditions} />
        <div class="actions"><button class="btn" type="submit">Save profile</button></div>
      </form>

      <div class="card">
        <h2 style="margin-top:0">Profile picture</h2>
        <p class="help" style="margin-top:0">Doctor's face photo. Clinic/office photos belong on the clinic page.</p>
        {d.photo_key ? (
          <p><img src={`${c.env.MEDIA_URL}/${d.photo_key}`} alt="" style="max-width:160px;border-radius:8px;display:block" />
            <span class="muted">{d.photo_key}{d.photo_attribution ? ` · ${d.photo_attribution}` : ''}</span></p>
        ) : <p class="muted">No profile picture.</p>}
        <form method="post" action={`/admin/doctors/${d.id}/photo`} enctype="multipart/form-data" class="actions">
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
          <input type="text" name="attribution" placeholder="Attribution (optional)" style="max-width:260px" />
          <button class="btn" type="submit">Upload to R2</button>
          {d.photo_key ? <button class="btn danger" type="submit" formaction={`/admin/doctors/${d.id}/photo/delete`} formnovalidate>Remove photo</button> : null}
        </form>
        {clinics.length ? (
          <>
            <h3 style="font-size:14px;margin:16px 0 4px">Clinic photos</h3>
            <ul style="margin:0">
              {clinics.map((cl) => (
                <li>{cl.name} <span class="muted">({cl.photo_count} {cl.photo_count === 1 ? 'photo' : 'photos'})</span> → <a href={`/admin/clinics/${cl.clinic_id}`}>edit</a></li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div class="card">
        <h2 style="margin-top:0">Locations ({clinics.length})</h2>
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Clinic</th><th>City</th><th>Fee (Rs)</th><th>Primary</th><th></th></tr></thead>
            <tbody>
              {clinics.map((cl) => (
                <tr>
                  <td><a href={`/admin/clinics/${cl.clinic_id}`}>{cl.name}</a><div class="muted">{cl.address}</div></td>
                  <td>{cl.city_name}</td>
                  <td>
                    <form method="post" action={`/admin/doctors/${d.id}/clinics/${cl.clinic_id}`} class="actions" style="margin:0">
                      <input type="number" name="fee" min={0} value={cl.consultation_fee ?? ''} style="width:100px" />
                      <label class="check" style="margin:0"><input type="checkbox" name="is_primary" checked={cl.is_primary === 1} />primary</label>
                      <button class="btn small secondary" type="submit">Save</button>
                    </form>
                  </td>
                  <td>{yesNo(cl.is_primary)}</td>
                  <td>
                    <form method="post" action={`/admin/doctors/${d.id}/clinics/${cl.clinic_id}/remove`} class="inline">
                      <button class="btn small danger" type="submit">Detach</button>
                    </form>
                  </td>
                </tr>
              ))}
              {clinics.length === 0 ? <tr><td colspan={5} class="muted">No clinic attached yet. Doctors without a published clinic do not appear in listings.</td></tr> : null}
            </tbody>
          </table>
        </div>
        <h2>Add location</h2>
        <form method="get" action={`/admin/doctors/${d.id}`} class="filters">
          <div><label>Search existing clinics by name</label><input type="search" name="clinic_q" value={clinicQ} placeholder="e.g. Apollo" /></div>
          <div style="flex:0"><button class="btn secondary" type="submit">Search</button></div>
          <div style="flex:0"><a class="btn" href={`/admin/import?doctor_id=${encodeURIComponent(d.id)}`}>Import another location from Google Maps</a></div>
          <div style="flex:0"><a class="btn secondary" href={`/admin/clinics/new?doctor_id=${encodeURIComponent(d.id)}`}>Create clinic manually</a></div>
        </form>
        {clinicQ ? (
          <table style="margin-top:12px">
            <thead><tr><th>Clinic</th><th>City</th><th>Fee</th><th></th></tr></thead>
            <tbody>
              {clinicResults.map((cl) => (
                <tr>
                  <td>{cl.name}<div class="muted">{cl.address}</div></td>
                  <td>{cl.city_name}</td>
                  <td colspan={2}>
                    <form method="post" action={`/admin/doctors/${d.id}/clinics`} class="actions" style="margin:0">
                      <input type="hidden" name="clinic_id" value={cl.id} />
                      <input type="number" name="fee" min={0} placeholder="Fee Rs" style="width:110px" />
                      <button class="btn small" type="submit">Attach</button>
                    </form>
                  </td>
                </tr>
              ))}
              {clinicResults.length === 0 ? <tr><td colspan={4} class="muted">No unattached clinics match "{clinicQ}".</td></tr> : null}
            </tbody>
          </table>
        ) : null}
      </div>

      <form method="post" action={`/admin/doctors/${d.id}/delete`} class="card" onsubmit="return confirm('Delete this doctor permanently?')">
        <button class="btn danger" type="submit">Delete doctor</button>
      </form>
    </AdminLayout>,
  )
})

doctorsAdmin.post('/:id', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  const body = await c.req.parseBody({ all: true })
  const parsed = parseDoctorForm(body)
  if (!parsed.ok) return c.redirect(`/admin/doctors/${d.id}?error=${encodeURIComponent(parsed.errors.join(' '))}`)
  const input = parsed.value
  const { cols, vals } = doctorColumns(input, c.get('user').id)
  if (!input.is_verified) { cols.push('verified_at', 'verified_by'); vals.push(null, null) }
  const stmts = [
    c.env.DB.prepare(`UPDATE doctors SET ${cols.map((col) => `${col} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...vals, d.id),
    ...relationStatements(c.env.DB, d.id, input),
  ]
  await c.env.DB.batch(stmts)
  return c.redirect(redirectWithFlash(`/admin/doctors/${d.id}`, 'Profile saved.'))
})

doctorsAdmin.post('/:id/toggle', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  const body = await c.req.parseBody()
  const field = body.field
  if (field === 'is_published') {
    await run(c.env.DB, "UPDATE doctors SET is_published = CASE is_published WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?", d.id)
  } else if (field === 'is_verified') {
    if (!d.registration_number) return c.redirect(redirectWithFlash('/admin/doctors', 'Cannot verify: registration number missing.'))
    if (d.is_verified) await run(c.env.DB, "UPDATE doctors SET is_verified = 0, verified_at = NULL, verified_by = NULL, updated_at = datetime('now') WHERE id = ?", d.id)
    else await run(c.env.DB, "UPDATE doctors SET is_verified = 1, verified_at = datetime('now'), verified_by = ?, updated_at = datetime('now') WHERE id = ?", c.get('user').id, d.id)
  }
  return c.redirect(c.req.header('Referer')?.includes('/admin/doctors') ? '/admin/doctors' : `/admin/doctors/${d.id}`)
})

doctorsAdmin.post('/:id/photo', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  const body = await c.req.parseBody()
  const upload = await readUpload(body.photo)
  if (!upload) return c.redirect(`/admin/doctors/${d.id}?error=${encodeURIComponent('Choose a photo file first.')}`)
  if ('error' in upload) return c.redirect(`/admin/doctors/${d.id}?error=${encodeURIComponent(upload.error)}`)
  const key = photoKey('doctors', d.slug, upload.contentType)
  await putPhoto(c.env.MEDIA, key, upload.body, upload.contentType)
  // Remove the previous file so the bucket does not collect stale versions.
  if (d.photo_key && d.photo_key !== key) await deletePhoto(c.env.MEDIA, d.photo_key)
  await run(c.env.DB, "UPDATE doctors SET photo_key = ?, photo_attribution = ?, updated_at = datetime('now') WHERE id = ?", key, str(body.attribution), d.id)
  return c.redirect(redirectWithFlash(`/admin/doctors/${d.id}`, 'Photo uploaded.'))
})

doctorsAdmin.post('/:id/photo/delete', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  await deletePhoto(c.env.MEDIA, d.photo_key)
  await run(c.env.DB, "UPDATE doctors SET photo_key = NULL, photo_attribution = NULL, updated_at = datetime('now') WHERE id = ?", d.id)
  return c.redirect(redirectWithFlash(`/admin/doctors/${d.id}`, 'Photo removed.'))
})

doctorsAdmin.post('/:id/clinics', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  const body = await c.req.parseBody()
  const clinicId = typeof body.clinic_id === 'string' && ID_RE.test(body.clinic_id) ? body.clinic_id : null
  if (!clinicId || !(await one(c.env.DB, 'SELECT id FROM clinics WHERE id = ?', clinicId))) return c.redirect(`/admin/doctors/${d.id}?error=Unknown+clinic`)
  const fee = toInt(body.fee)
  const hasAny = await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) n FROM doctor_clinics WHERE doctor_id = ?', d.id)
  await run(c.env.DB, 'INSERT INTO doctor_clinics (doctor_id, clinic_id, consultation_fee, is_primary) VALUES (?, ?, ?, ?) ON CONFLICT (doctor_id, clinic_id) DO UPDATE SET consultation_fee = excluded.consultation_fee', d.id, clinicId, fee, hasAny?.n ? 0 : 1)
  return c.redirect(redirectWithFlash(`/admin/doctors/${d.id}`, 'Location attached.'))
})

doctorsAdmin.post('/:id/clinics/:clinicId', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  const clinicId = c.req.param('clinicId')
  if (!d || !ID_RE.test(clinicId)) return c.notFound()
  const body = await c.req.parseBody()
  const fee = toInt(body.fee)
  const primary = body.is_primary === 'on' ? 1 : 0
  const stmts = [c.env.DB.prepare('UPDATE doctor_clinics SET consultation_fee = ?, is_primary = ? WHERE doctor_id = ? AND clinic_id = ?').bind(fee, primary, d.id, clinicId)]
  if (primary) stmts.unshift(c.env.DB.prepare('UPDATE doctor_clinics SET is_primary = 0 WHERE doctor_id = ?').bind(d.id))
  await c.env.DB.batch(stmts)
  return c.redirect(redirectWithFlash(`/admin/doctors/${d.id}`, 'Location updated.'))
})

doctorsAdmin.post('/:id/clinics/:clinicId/remove', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  const clinicId = c.req.param('clinicId')
  if (!d || !ID_RE.test(clinicId)) return c.notFound()
  await run(c.env.DB, 'DELETE FROM doctor_clinics WHERE doctor_id = ? AND clinic_id = ?', d.id, clinicId)
  return c.redirect(redirectWithFlash(`/admin/doctors/${d.id}`, 'Location detached.'))
})

doctorsAdmin.post('/:id/delete', async (c) => {
  const d = await loadDoctor(c.env.DB, c.req.param('id'))
  if (!d) return c.notFound()
  await deletePhoto(c.env.MEDIA, d.photo_key)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM doctor_clinics WHERE doctor_id = ?').bind(d.id),
    c.env.DB.prepare('DELETE FROM doctor_specialties WHERE doctor_id = ?').bind(d.id),
    c.env.DB.prepare('DELETE FROM doctor_conditions WHERE doctor_id = ?').bind(d.id),
    c.env.DB.prepare('DELETE FROM reviews WHERE doctor_id = ?').bind(d.id),
    c.env.DB.prepare('DELETE FROM bookings WHERE doctor_id = ?').bind(d.id),
    c.env.DB.prepare('DELETE FROM doctors WHERE id = ?').bind(d.id),
  ])
  return c.redirect(redirectWithFlash('/admin/doctors', `Deleted ${d.name}.`))
})
