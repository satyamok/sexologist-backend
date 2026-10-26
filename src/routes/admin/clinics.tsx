import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, one, run, uuid, uniqueSlug, toInt, toFloat, str, bool, jsonObject } from '../../lib/db'
import { isValidLatLng, haversineKm } from '../../lib/geo'
import { photoKey, putPhoto, deletePhoto, readUpload } from '../../lib/media'
import { AdminLayout, Field, Select } from './layout'
import { lookups, redirectWithFlash, ID_RE, CLINIC_TYPES, type AreaOpt } from './common'

export const clinicsAdmin = new Hono<AppEnv>()

export type ClinicRow = {
  id: string; slug: string; name: string; address: string; pincode: string | null; area_id: string | null; city_id: string; locality: string | null
  lat: number; lng: number; phone: string | null; whatsapp: string | null; website: string | null; timings: string
  google_place_id: string | null; google_maps_url: string | null; google_rating: number | null; google_review_count: number | null
  photo_key: string | null; photo_attribution: string | null; clinic_type: string | null; is_published: number; source: string
}

export type ClinicInput = {
  name: string; address: string; pincode: string | null; area_id: string | null; city_id: string; locality: string | null
  lat: number; lng: number; phone: string | null; whatsapp: string | null; website: string | null; timings: string
  clinic_type: string | null; is_published: number; google_maps_url: string | null
}

type Body = Record<string, string | File | (string | File)[]>
const f = (body: Body, k: string): string | undefined => (typeof body[k] === 'string' ? (body[k] as string) : undefined)

/** Nearest published area of the city whose radius covers the point. */
export function nearestArea(areas: AreaOpt[], cityId: string, lat: number, lng: number): AreaOpt | null {
  let best: { a: AreaOpt; d: number } | null = null
  for (const a of areas) {
    if (a.city_id !== cityId) continue
    const d = haversineKm({ lat, lng }, a)
    if (d <= a.default_radius_km && (!best || d < best.d)) best = { a, d }
  }
  return best?.a ?? null
}

export async function parseClinicForm(db: D1Database, body: Body, prefix = 'clinic_'): Promise<{ ok: true; value: ClinicInput } | { ok: false; errors: string[] }> {
  const g = (k: string) => f(body, prefix + k)
  const errors: string[] = []
  const name = str(g('name'))
  if (!name || name.length < 3) errors.push('Clinic name is required.')
  const address = str(g('address'))
  if (!address) errors.push('Address is required.')
  const city_id = str(g('city_id'))
  const city = city_id && ID_RE.test(city_id) ? await one<{ id: string }>(db, 'SELECT id FROM cities WHERE id = ?', city_id) : null
  if (!city) errors.push('Choose a city.')
  const lat = toFloat(g('lat')), lng = toFloat(g('lng'))
  if (!isValidLatLng(lat, lng) || lat === 0) errors.push('Latitude/longitude are required (drag the map pin or paste coordinates).')
  let area_id = str(g('area_id'))
  if (area_id) {
    const area = ID_RE.test(area_id) ? await one<{ id: string }>(db, 'SELECT id FROM areas WHERE id = ? AND city_id = ?', area_id, city_id ?? '') : null
    if (!area) errors.push('Area does not belong to the selected city.')
  } else if (city_id && lat !== null && lng !== null) {
    const areas = await all<AreaOpt>(db, 'SELECT id, city_id, name, slug, lat, lng, default_radius_km FROM areas WHERE city_id = ? AND is_published = 1', city_id)
    area_id = nearestArea(areas, city_id, lat, lng)?.id ?? null
  }
  const website = str(g('website'))
  if (website && !/^https?:\/\//i.test(website)) errors.push('Website must start with http:// or https://')
  const timingsRaw = str(g('timings')) ?? '{}'
  let timings = '{}'
  try {
    const parsed: unknown = JSON.parse(timingsRaw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
    timings = JSON.stringify(parsed)
  } catch {
    errors.push('Timings must be a JSON object like {"mon":[["10:00","13:00"]]}.')
  }
  const clinic_type = str(g('clinic_type'))
  if (clinic_type && !CLINIC_TYPES.some((t) => t.value === clinic_type)) errors.push('Invalid clinic type.')
  if (errors.length) return { ok: false, errors }
  return {
    ok: true,
    value: {
      name: name!, address: address!, pincode: str(g('pincode')), area_id, city_id: city_id!, locality: str(g('locality')),
      lat: lat!, lng: lng!, phone: str(g('phone')), whatsapp: str(g('whatsapp')), website, timings, clinic_type,
      is_published: bool(g('is_published')), google_maps_url: str(g('google_maps_url')),
    },
  }
}

const MAP_SCRIPT = `
(function(){var latI=document.getElementById('lat'),lngI=document.getElementById('lng'),el=document.getElementById('map');if(!el||!window.L)return;
var lat=parseFloat(latI.value)||28.6139,lng=parseFloat(lngI.value)||77.2090;
var map=L.map('map').setView([lat,lng],parseFloat(latI.value)?15:11);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);
var m=L.marker([lat,lng],{draggable:true}).addTo(map);
function set(ll){latI.value=ll.lat.toFixed(6);lngI.value=ll.lng.toFixed(6);}
m.on('dragend',function(){set(m.getLatLng());});map.on('click',function(e){m.setLatLng(e.latlng);set(e.latlng);});
function fromInputs(){var a=parseFloat(latI.value),b=parseFloat(lngI.value);if(isFinite(a)&&isFinite(b)){m.setLatLng([a,b]);map.panTo([a,b]);}}
latI.addEventListener('change',fromInputs);lngI.addEventListener('change',fromInputs);
var citySel=document.getElementById('city_id');if(citySel){citySel.addEventListener('change',function(){var o=citySel.options[citySel.selectedIndex];var a=parseFloat(o.dataset.lat),b=parseFloat(o.dataset.lng);if(isFinite(a)&&isFinite(b)&&!parseFloat(latI.value)){map.setView([a,b],11);m.setLatLng([a,b]);}
Array.prototype.forEach.call(document.querySelectorAll('#area_id option'),function(op){op.hidden=!!op.value&&op.dataset.city!==citySel.value;});});}
})();`

export const ClinicFields = ({ v, cities, areas, withMap }: { v: Partial<ClinicRow>; cities: { id: string; name: string; lat: number | null; lng: number | null }[]; areas: AreaOpt[]; withMap: boolean }) => (
  <>
    <div class="grid-2">
      <Field label="Clinic name"><input type="text" name="clinic_name" value={v.name ?? ''} required /></Field>
      <Field label="Type"><Select name="clinic_clinic_type" value={v.clinic_type ?? 'clinic'} options={CLINIC_TYPES} /></Field>
      <Field label="City">
        <select name="clinic_city_id" id="city_id" required>
          <option value="">Select…</option>
          {cities.map((ci) => <option value={ci.id} selected={ci.id === v.city_id} data-lat={ci.lat ?? ''} data-lng={ci.lng ?? ''}>{ci.name}</option>)}
        </select>
      </Field>
      <Field label="Area" help="Leave blank to auto-match the nearest area from coordinates.">
        <select name="clinic_area_id" id="area_id">
          <option value="">Auto-match</option>
          {areas.map((a) => <option value={a.id} selected={a.id === v.area_id} data-city={a.city_id} hidden={!!v.city_id && a.city_id !== v.city_id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Locality (shown on cards)"><input type="text" name="clinic_locality" value={v.locality ?? ''} /></Field>
      <Field label="Pincode"><input type="text" name="clinic_pincode" value={v.pincode ?? ''} pattern="[1-9][0-9]{5}" /></Field>
      <Field label="Phone"><input type="tel" name="clinic_phone" value={v.phone ?? ''} /></Field>
      <Field label="WhatsApp"><input type="tel" name="clinic_whatsapp" value={v.whatsapp ?? ''} /></Field>
      <Field label="Website"><input type="url" name="clinic_website" value={v.website ?? ''} /></Field>
      <Field label="Google Maps URL"><input type="url" name="clinic_google_maps_url" value={v.google_maps_url ?? ''} /></Field>
      <Field label="Latitude"><input type="text" id="lat" name="clinic_lat" value={v.lat ?? ''} required inputmode="decimal" /></Field>
      <Field label="Longitude"><input type="text" id="lng" name="clinic_lng" value={v.lng ?? ''} required inputmode="decimal" /></Field>
    </div>
    <Field label="Address"><textarea name="clinic_address" required>{v.address ?? ''}</textarea></Field>
    <Field label="Timings (JSON)" help='{"mon":[["10:00","13:00"],["17:00","20:00"]], ...}'><textarea name="clinic_timings">{v.timings ?? '{}'}</textarea></Field>
    <label class="check"><input type="checkbox" name="clinic_is_published" checked={(v.is_published ?? 1) === 1} />Published</label>
    {withMap ? (
      <>
        <div id="map"></div>
        <p class="help">Drag the pin or click the map to set coordinates.</p>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
        <script dangerouslySetInnerHTML={{ __html: MAP_SCRIPT }} />
      </>
    ) : null}
  </>
)

clinicsAdmin.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 80)
  const rows = await all<ClinicRow & { city_name: string; area_name: string | null; doctor_count: number }>(
    c.env.DB,
    `SELECT cl.*, ci.name city_name, a.name area_name, (SELECT COUNT(*) FROM doctor_clinics dc WHERE dc.clinic_id = cl.id) doctor_count
       FROM clinics cl JOIN cities ci ON ci.id = cl.city_id LEFT JOIN areas a ON a.id = cl.area_id
      WHERE (? = '' OR cl.name LIKE ? OR cl.address LIKE ?) ORDER BY cl.updated_at DESC LIMIT 200`,
    q, `%${q}%`, `%${q}%`,
  )
  return c.html(
    <AdminLayout title="Clinics" user={c.get('user')} flash={c.req.query('flash')}>
      <h1>Clinics <span class="muted">({rows.length})</span></h1>
      <form method="get" class="card filters">
        <div><label>Search</label><input type="search" name="q" value={q} placeholder="Name or address" /></div>
        <div style="flex:0"><button class="btn" type="submit">Filter</button></div>
        <div style="flex:0"><a class="btn secondary" href="/admin/clinics/new">New clinic</a></div>
      </form>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Name</th><th>City / Area</th><th>Doctors</th><th>Type</th><th>Published</th><th>Source</th></tr></thead>
          <tbody>
            {rows.map((cl) => (
              <tr>
                <td><a href={`/admin/clinics/${cl.id}`}>{cl.name}</a><div class="muted">{cl.address}</div></td>
                <td>{cl.city_name}{cl.area_name ? ` / ${cl.area_name}` : ''}</td>
                <td>{cl.doctor_count}</td>
                <td>{cl.clinic_type ?? '—'}</td>
                <td>{cl.is_published ? 'Yes' : 'No'}</td>
                <td><span class="badge">{cl.source}</span></td>
              </tr>
            ))}
            {rows.length === 0 ? <tr><td colspan={6} class="muted">No clinics yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </AdminLayout>,
  )
})

clinicsAdmin.get('/new', async (c) => {
  const lk = await lookups(c.env.DB)
  const doctorId = c.req.query('doctor_id')
  return c.html(
    <AdminLayout title="New clinic" user={c.get('user')}>
      <h1>New clinic</h1>
      <form method="post" action="/admin/clinics" class="card">
        {doctorId && ID_RE.test(doctorId) ? <input type="hidden" name="doctor_id" value={doctorId} /> : null}
        <ClinicFields v={{ is_published: 1 }} cities={lk.cities} areas={lk.areas} withMap />
        {doctorId ? <Field label="Consultation fee for this doctor (Rs)"><input type="number" name="fee" min={0} /></Field> : null}
        <div class="actions"><button class="btn" type="submit">Create clinic</button><a class="btn secondary" href="/admin/clinics">Cancel</a></div>
      </form>
    </AdminLayout>,
  )
})

clinicsAdmin.post('/', async (c) => {
  const body = await c.req.parseBody()
  const parsed = await parseClinicForm(c.env.DB, body)
  if (!parsed.ok) {
    const lk = await lookups(c.env.DB)
    return c.html(
      <AdminLayout title="New clinic" user={c.get('user')} error={parsed.errors.join(' ')}>
        <h1>New clinic</h1>
        <form method="post" action="/admin/clinics" class="card">
          <ClinicFields v={{ name: str(body.clinic_name) ?? undefined, address: str(body.clinic_address) ?? undefined, city_id: str(body.clinic_city_id) ?? undefined, lat: toFloat(body.clinic_lat) ?? undefined, lng: toFloat(body.clinic_lng) ?? undefined }} cities={lk.cities} areas={lk.areas} withMap />
          <div class="actions"><button class="btn" type="submit">Create clinic</button></div>
        </form>
      </AdminLayout>,
      400,
    )
  }
  const v = parsed.value
  const id = uuid()
  const slug = await uniqueSlug(c.env.DB, 'clinics', v.name)
  const stmts = [insertClinicStmt(c.env.DB, id, slug, v, 'manual', null)]
  const doctorId = typeof body.doctor_id === 'string' && ID_RE.test(body.doctor_id) ? body.doctor_id : null
  if (doctorId && (await one(c.env.DB, 'SELECT id FROM doctors WHERE id = ?', doctorId))) {
    stmts.push(c.env.DB.prepare('INSERT INTO doctor_clinics (doctor_id, clinic_id, consultation_fee, is_primary) VALUES (?, ?, ?, (SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END FROM doctor_clinics WHERE doctor_id = ?))').bind(doctorId, id, toInt(body.fee), doctorId))
  }
  await c.env.DB.batch(stmts)
  return c.redirect(doctorId ? redirectWithFlash(`/admin/doctors/${doctorId}`, 'Clinic created and attached.') : redirectWithFlash(`/admin/clinics/${id}`, 'Clinic created.'))
})

export function insertClinicStmt(db: D1Database, id: string, slug: string, v: ClinicInput, source: string, google: { placeId: string; rating: number | null; reviews: number | null } | null): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO clinics (id, slug, name, address, pincode, area_id, city_id, locality, lat, lng, phone, whatsapp, website, timings, clinic_type, is_published, google_maps_url, source, google_place_id, google_rating, google_review_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, slug, v.name, v.address, v.pincode, v.area_id, v.city_id, v.locality, v.lat, v.lng, v.phone, v.whatsapp, v.website, v.timings, v.clinic_type, v.is_published, v.google_maps_url, source, google?.placeId ?? null, google?.rating ?? null, google?.reviews ?? null)
}

clinicsAdmin.get('/:id', async (c) => {
  const id = c.req.param('id')
  const cl = ID_RE.test(id) ? await one<ClinicRow>(c.env.DB, 'SELECT * FROM clinics WHERE id = ?', id) : null
  if (!cl) return c.notFound()
  const lk = await lookups(c.env.DB)
  const doctors = await all<{ id: string; name: string; consultation_fee: number | null }>(c.env.DB, 'SELECT d.id, d.name, dc.consultation_fee FROM doctor_clinics dc JOIN doctors d ON d.id = dc.doctor_id WHERE dc.clinic_id = ? ORDER BY d.name', cl.id)
  return c.html(
    <AdminLayout title={cl.name} user={c.get('user')} flash={c.req.query('flash')} error={c.req.query('error')}>
      <h1>{cl.name}</h1>
      <p class="muted">Slug: <code>{cl.slug}</code> · Source: {cl.source}{cl.google_place_id ? <> · Google place <code>{cl.google_place_id}</code> ({cl.google_rating ?? '-'} ★, {cl.google_review_count ?? 0} reviews)</> : null}</p>
      <form method="post" action={`/admin/clinics/${cl.id}`} class="card">
        <ClinicFields v={{ ...cl, timings: JSON.stringify(jsonObject(cl.timings)) }} cities={lk.cities} areas={lk.areas} withMap />
        <div class="actions"><button class="btn" type="submit">Save clinic</button></div>
      </form>
      <div class="card">
        <h2 style="margin-top:0">Photo</h2>
        {cl.photo_key ? <p><img src={`${c.env.MEDIA_URL}/${cl.photo_key}`} alt="" style="max-width:200px;border-radius:8px;display:block" /><span class="muted">{cl.photo_key}{cl.photo_attribution ? ` · ${cl.photo_attribution}` : ''}</span></p> : <p class="muted">No photo.</p>}
        <form method="post" action={`/admin/clinics/${cl.id}/photo`} enctype="multipart/form-data" class="actions">
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required />
          <input type="text" name="attribution" placeholder="Attribution (optional)" style="max-width:260px" />
          <button class="btn" type="submit">Upload to R2</button>
          {cl.photo_key ? <button class="btn danger" type="submit" formaction={`/admin/clinics/${cl.id}/photo/delete`} formnovalidate>Remove photo</button> : null}
        </form>
      </div>
      <div class="card">
        <h2 style="margin-top:0">Doctors here ({doctors.length})</h2>
        <ul>{doctors.map((d) => <li><a href={`/admin/doctors/${d.id}`}>{d.name}</a>{d.consultation_fee !== null ? <span class="muted"> · Rs {d.consultation_fee}</span> : null}</li>)}</ul>
        {doctors.length === 0 ? <p class="muted">Attach doctors from their edit page ("Add location").</p> : null}
      </div>
      <form method="post" action={`/admin/clinics/${cl.id}/delete`} class="card" onsubmit="return confirm('Delete this clinic? Doctors will be detached.')">
        <button class="btn danger" type="submit">Delete clinic</button>
      </form>
    </AdminLayout>,
  )
})

clinicsAdmin.post('/:id', async (c) => {
  const id = c.req.param('id')
  const cl = ID_RE.test(id) ? await one<ClinicRow>(c.env.DB, 'SELECT * FROM clinics WHERE id = ?', id) : null
  if (!cl) return c.notFound()
  const body = await c.req.parseBody()
  const parsed = await parseClinicForm(c.env.DB, body)
  if (!parsed.ok) return c.redirect(`/admin/clinics/${cl.id}?error=${encodeURIComponent(parsed.errors.join(' '))}`)
  const v = parsed.value
  await run(
    c.env.DB,
    `UPDATE clinics SET name = ?, address = ?, pincode = ?, area_id = ?, city_id = ?, locality = ?, lat = ?, lng = ?, phone = ?, whatsapp = ?, website = ?, timings = ?, clinic_type = ?, is_published = ?, google_maps_url = ?, updated_at = datetime('now') WHERE id = ?`,
    v.name, v.address, v.pincode, v.area_id, v.city_id, v.locality, v.lat, v.lng, v.phone, v.whatsapp, v.website, v.timings, v.clinic_type, v.is_published, v.google_maps_url, cl.id,
  )
  return c.redirect(redirectWithFlash(`/admin/clinics/${cl.id}`, 'Clinic saved.'))
})

clinicsAdmin.post('/:id/photo', async (c) => {
  const id = c.req.param('id')
  const cl = ID_RE.test(id) ? await one<ClinicRow>(c.env.DB, 'SELECT * FROM clinics WHERE id = ?', id) : null
  if (!cl) return c.notFound()
  const body = await c.req.parseBody()
  const upload = await readUpload(body.photo)
  if (!upload) return c.redirect(`/admin/clinics/${cl.id}?error=${encodeURIComponent('Choose a photo file first.')}`)
  if ('error' in upload) return c.redirect(`/admin/clinics/${cl.id}?error=${encodeURIComponent(upload.error)}`)
  const key = photoKey('clinics', cl.slug)
  await putPhoto(c.env.MEDIA, key, upload.body, upload.contentType)
  await run(c.env.DB, "UPDATE clinics SET photo_key = ?, photo_attribution = ?, updated_at = datetime('now') WHERE id = ?", key, str(body.attribution), cl.id)
  return c.redirect(redirectWithFlash(`/admin/clinics/${cl.id}`, 'Photo uploaded.'))
})

clinicsAdmin.post('/:id/photo/delete', async (c) => {
  const id = c.req.param('id')
  const cl = ID_RE.test(id) ? await one<ClinicRow>(c.env.DB, 'SELECT * FROM clinics WHERE id = ?', id) : null
  if (!cl) return c.notFound()
  await deletePhoto(c.env.MEDIA, cl.photo_key)
  await run(c.env.DB, "UPDATE clinics SET photo_key = NULL, photo_attribution = NULL, updated_at = datetime('now') WHERE id = ?", cl.id)
  return c.redirect(redirectWithFlash(`/admin/clinics/${cl.id}`, 'Photo removed.'))
})

clinicsAdmin.post('/:id/delete', async (c) => {
  const id = c.req.param('id')
  const cl = ID_RE.test(id) ? await one<ClinicRow>(c.env.DB, 'SELECT * FROM clinics WHERE id = ?', id) : null
  if (!cl) return c.notFound()
  await deletePhoto(c.env.MEDIA, cl.photo_key)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM doctor_clinics WHERE clinic_id = ?').bind(cl.id),
    c.env.DB.prepare('UPDATE bookings SET clinic_id = NULL WHERE clinic_id = ?').bind(cl.id),
    c.env.DB.prepare('DELETE FROM clinics WHERE id = ?').bind(cl.id),
  ])
  return c.redirect(redirectWithFlash('/admin/clinics', `Deleted ${cl.name}.`))
})
