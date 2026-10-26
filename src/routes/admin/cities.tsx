import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, one, run, uuid, slugify, toFloat, str, bool } from '../../lib/db'
import { isValidLatLng } from '../../lib/geo'
import { AdminLayout, Field } from './layout'
import { redirectWithFlash, ID_RE } from './common'
import { NameTranslationInputs } from './translations'
import { parseNameTranslations, nameTranslationStmts } from '../../lib/translationForm'

/** lang → name for one city/area. */
async function namesFor(db: D1Database, table: 'city_translations' | 'area_translations', id: string): Promise<Map<string, string>> {
  const col = table === 'city_translations' ? 'city_id' : 'area_id'
  const rows = await all<{ lang: string; name: string }>(db, `SELECT lang, name FROM ${table} WHERE ${col} = ?`, id)
  return new Map(rows.map((r) => [r.lang, r.name]))
}

export const citiesAdmin = new Hono<AppEnv>()

type City = { id: string; name: string; slug: string; state: string; lat: number | null; lng: number | null; is_published: number; intro_html: string | null; area_count: number }
type Area = { id: string; city_id: string; name: string; slug: string; pincode: string | null; zone: string | null; lat: number; lng: number; default_radius_km: number; is_published: number; intro_html: string | null }

citiesAdmin.get('/', async (c) => {
  const cities = await all<City>(c.env.DB, 'SELECT ci.*, (SELECT COUNT(*) FROM areas a WHERE a.city_id = ci.id) area_count FROM cities ci ORDER BY ci.name')
  return c.html(
    <AdminLayout title="Cities" user={c.get('user')} flash={c.req.query('flash')} error={c.req.query('error')}>
      <h1>Cities</h1>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>City</th><th>State</th><th>Coordinates</th><th>Areas</th><th>Published</th></tr></thead>
          <tbody>
            {cities.map((ci) => (
              <tr>
                <td><a href={`/admin/cities/${ci.id}`}>{ci.name}</a> <span class="muted">/{ci.slug}</span></td>
                <td>{ci.state}</td>
                <td class="muted">{ci.lat}, {ci.lng}</td>
                <td>{ci.area_count}</td>
                <td>{ci.is_published ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>Add city</h2>
      <form method="post" action="/admin/cities" class="card">
        <div class="grid-2">
          <Field label="Name"><input type="text" name="name" required /></Field>
          <Field label="State"><input type="text" name="state" required /></Field>
          <Field label="Latitude"><input type="text" name="lat" inputmode="decimal" required /></Field>
          <Field label="Longitude"><input type="text" name="lng" inputmode="decimal" required /></Field>
        </div>
        <div class="actions"><button class="btn" type="submit">Add city</button></div>
      </form>
    </AdminLayout>,
  )
})

citiesAdmin.post('/', async (c) => {
  const b = await c.req.parseBody()
  const name = str(b.name), state = str(b.state), lat = toFloat(b.lat), lng = toFloat(b.lng)
  if (!name || !state || !isValidLatLng(lat, lng)) return c.redirect(redirectWithFlash('/admin/cities', 'Name, state and valid coordinates are required.'))
  const slug = slugify(name)
  if (await one(c.env.DB, 'SELECT id FROM cities WHERE slug = ?', slug)) return c.redirect(`/admin/cities?error=${encodeURIComponent('A city with this slug already exists.')}`)
  const id = `city_${slug.replace(/-/g, '_')}`
  await run(c.env.DB, 'INSERT INTO cities (id, name, slug, state, lat, lng) VALUES (?, ?, ?, ?, ?, ?)', id, name, slug, state, lat, lng)
  return c.redirect(redirectWithFlash(`/admin/cities/${id}`, 'City added. Now add its areas.'))
})

citiesAdmin.get('/:id', async (c) => {
  const id = c.req.param('id')
  const city = ID_RE.test(id) ? await one<City>(c.env.DB, 'SELECT ci.*, 0 area_count FROM cities ci WHERE id = ?', id) : null
  if (!city) return c.notFound()
  const areas = await all<Area>(c.env.DB, 'SELECT * FROM areas WHERE city_id = ? ORDER BY name', city.id)
  const editId = c.req.query('area')
  const editing = editId ? areas.find((a) => a.id === editId) ?? null : null
  const cityNames = await namesFor(c.env.DB, 'city_translations', city.id)
  const areaNames = editing ? await namesFor(c.env.DB, 'area_translations', editing.id) : new Map<string, string>()
  return c.html(
    <AdminLayout title={city.name} user={c.get('user')} flash={c.req.query('flash')} error={c.req.query('error')}>
      <h1>{city.name} <span class="muted">/{city.slug}</span></h1>
      <form method="post" action={`/admin/cities/${city.id}`} class="card">
        <div class="grid-2">
          <Field label="Name"><input type="text" name="name" value={city.name} required /></Field>
          <Field label="State"><input type="text" name="state" value={city.state} required /></Field>
          <Field label="Latitude"><input type="text" name="lat" value={city.lat ?? ''} inputmode="decimal" required /></Field>
          <Field label="Longitude"><input type="text" name="lng" value={city.lng ?? ''} inputmode="decimal" required /></Field>
        </div>
        <Field label="Intro HTML (optional, shown on the city page)"><textarea name="intro_html">{city.intro_html ?? ''}</textarea></Field>
        <NameTranslationInputs names={cityNames} />
        <label class="check"><input type="checkbox" name="is_published" checked={city.is_published === 1} />Published</label>
        <div class="actions"><button class="btn" type="submit">Save city</button></div>
      </form>

      <h2>Areas ({areas.length})</h2>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Area</th><th>Zone</th><th>Pincode</th><th>Coordinates</th><th>Radius km</th><th>Published</th><th></th></tr></thead>
          <tbody>
            {areas.map((a) => (
              <tr>
                <td>{a.name} <span class="muted">/{a.slug}</span></td>
                <td>{a.zone ?? '—'}</td>
                <td>{a.pincode ?? '—'}</td>
                <td class="muted">{a.lat}, {a.lng}</td>
                <td>{a.default_radius_km}</td>
                <td>{a.is_published ? 'Yes' : 'No'}</td>
                <td class="actions" style="margin:0">
                  <a class="btn small secondary" href={`/admin/cities/${city.id}?area=${a.id}#area-form`}>Edit</a>
                  <form method="post" action={`/admin/cities/${city.id}/areas/${a.id}/delete`} class="inline" onsubmit="return confirm('Delete area?')"><button class="btn small danger" type="submit">Delete</button></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 id="area-form">{editing ? `Edit area: ${editing.name}` : 'Add area'}</h2>
      <form method="post" action={editing ? `/admin/cities/${city.id}/areas/${editing.id}` : `/admin/cities/${city.id}/areas`} class="card">
        <div class="grid-2">
          <Field label="Name"><input type="text" name="name" value={editing?.name ?? ''} required /></Field>
          <Field label="Zone" help="e.g. South Delhi"><input type="text" name="zone" value={editing?.zone ?? ''} /></Field>
          <Field label="Pincode"><input type="text" name="pincode" value={editing?.pincode ?? ''} /></Field>
          <Field label="Default radius (km)"><input type="number" name="default_radius_km" step="0.5" min={1} max={30} value={editing?.default_radius_km ?? 6} /></Field>
          <Field label="Latitude"><input type="text" name="lat" value={editing?.lat ?? ''} inputmode="decimal" required /></Field>
          <Field label="Longitude"><input type="text" name="lng" value={editing?.lng ?? ''} inputmode="decimal" required /></Field>
        </div>
        <Field label="Intro HTML (optional)"><textarea name="intro_html">{editing?.intro_html ?? ''}</textarea></Field>
        <NameTranslationInputs names={areaNames} />
        <label class="check"><input type="checkbox" name="is_published" checked={(editing?.is_published ?? 1) === 1} />Published</label>
        <div class="actions"><button class="btn" type="submit">{editing ? 'Save area' : 'Add area'}</button>{editing ? <a class="btn secondary" href={`/admin/cities/${city.id}`}>Cancel</a> : null}</div>
      </form>
    </AdminLayout>,
  )
})

citiesAdmin.post('/:id', async (c) => {
  const id = c.req.param('id')
  if (!ID_RE.test(id) || !(await one(c.env.DB, 'SELECT id FROM cities WHERE id = ?', id))) return c.notFound()
  const b = await c.req.parseBody()
  const name = str(b.name), state = str(b.state), lat = toFloat(b.lat), lng = toFloat(b.lng)
  if (!name || !state || !isValidLatLng(lat, lng)) return c.redirect(`/admin/cities/${id}?error=${encodeURIComponent('Name, state and valid coordinates are required.')}`)
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE cities SET name = ?, state = ?, lat = ?, lng = ?, intro_html = ?, is_published = ? WHERE id = ?').bind(name, state, lat, lng, str(b.intro_html), bool(b.is_published), id),
    ...nameTranslationStmts(c.env.DB, 'city_translations', id, parseNameTranslations(b)),
  ])
  return c.redirect(redirectWithFlash(`/admin/cities/${id}`, 'City saved.'))
})

function parseArea(b: Record<string, string | File>): { ok: true; v: Omit<Area, 'id' | 'city_id' | 'slug'> } | { ok: false; error: string } {
  const name = str(b.name), lat = toFloat(b.lat), lng = toFloat(b.lng)
  const radius = toFloat(b.default_radius_km) ?? 6
  if (!name || !isValidLatLng(lat, lng)) return { ok: false, error: 'Area name and valid coordinates are required.' }
  if (radius < 1 || radius > 30) return { ok: false, error: 'Radius must be between 1 and 30 km.' }
  const pincode = str(b.pincode)
  if (pincode && !/^[1-9]\d{5}$/.test(pincode)) return { ok: false, error: 'Pincode must be 6 digits.' }
  return { ok: true, v: { name, zone: str(b.zone), pincode, lat: lat!, lng: lng!, default_radius_km: radius, is_published: bool(b.is_published), intro_html: str(b.intro_html) } }
}

citiesAdmin.post('/:id/areas', async (c) => {
  const cityId = c.req.param('id')
  if (!ID_RE.test(cityId) || !(await one(c.env.DB, 'SELECT id FROM cities WHERE id = ?', cityId))) return c.notFound()
  const body = await c.req.parseBody()
  const parsed = parseArea(body)
  if (!parsed.ok) return c.redirect(`/admin/cities/${cityId}?error=${encodeURIComponent(parsed.error)}`)
  const v = parsed.v
  const slug = slugify(v.name)
  if (await one(c.env.DB, 'SELECT id FROM areas WHERE city_id = ? AND slug = ?', cityId, slug)) return c.redirect(`/admin/cities/${cityId}?error=${encodeURIComponent('An area with this slug already exists in this city.')}`)
  const areaId = `ar_${uuid().slice(0, 8)}`
  await c.env.DB.batch([
    c.env.DB.prepare('INSERT INTO areas (id, city_id, name, slug, pincode, zone, lat, lng, default_radius_km, is_published, intro_html) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(areaId, cityId, v.name, slug, v.pincode, v.zone, v.lat, v.lng, v.default_radius_km, v.is_published, v.intro_html),
    ...nameTranslationStmts(c.env.DB, 'area_translations', areaId, parseNameTranslations(body)),
  ])
  return c.redirect(redirectWithFlash(`/admin/cities/${cityId}`, `Area ${v.name} added.`))
})

citiesAdmin.post('/:id/areas/:areaId', async (c) => {
  const cityId = c.req.param('id'), areaId = c.req.param('areaId')
  if (!ID_RE.test(cityId) || !ID_RE.test(areaId)) return c.notFound()
  const body = await c.req.parseBody()
  const parsed = parseArea(body)
  if (!parsed.ok) return c.redirect(`/admin/cities/${cityId}?area=${areaId}&error=${encodeURIComponent(parsed.error)}`)
  const v = parsed.v
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE areas SET name = ?, pincode = ?, zone = ?, lat = ?, lng = ?, default_radius_km = ?, is_published = ?, intro_html = ? WHERE id = ? AND city_id = ?').bind(v.name, v.pincode, v.zone, v.lat, v.lng, v.default_radius_km, v.is_published, v.intro_html, areaId, cityId),
    ...nameTranslationStmts(c.env.DB, 'area_translations', areaId, parseNameTranslations(body)),
  ])
  return c.redirect(redirectWithFlash(`/admin/cities/${cityId}`, 'Area saved.'))
})

citiesAdmin.post('/:id/areas/:areaId/delete', async (c) => {
  const cityId = c.req.param('id'), areaId = c.req.param('areaId')
  if (!ID_RE.test(cityId) || !ID_RE.test(areaId)) return c.notFound()
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE clinics SET area_id = NULL WHERE area_id = ?').bind(areaId),
    c.env.DB.prepare('DELETE FROM area_translations WHERE area_id = ?').bind(areaId),
    c.env.DB.prepare('DELETE FROM areas WHERE id = ? AND city_id = ?').bind(areaId, cityId),
  ])
  return c.redirect(redirectWithFlash(`/admin/cities/${cityId}`, 'Area deleted.'))
})
