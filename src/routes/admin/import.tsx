import { Hono } from 'hono'
import type { AppEnv } from '../../env'
import { all, one, uuid, uniqueSlug, doctorSlug as makeDoctorSlug, toInt } from '../../lib/db'
import { searchText, placeDetails, fetchPhoto, parsePlace, PlacesError, type Place } from '../../lib/places'
import { parseDoctorForm, doctorColumns, relationStatements } from '../../lib/doctorForm'
import { photoKey, putPhoto } from '../../lib/media'
import { AdminLayout, Field, Select } from './layout'
import { DoctorFields } from './doctorFormView'
import { ClinicFields, parseClinicForm, insertClinicStmt, nearestArea, type ClinicRow } from './clinics'
import { lookups, redirectWithFlash, ID_RE } from './common'

export const importAdmin = new Hono<AppEnv>()

const SetupInstructions = () => (
  <div class="card">
    <h2 style="margin-top:0">Google Places API key is not configured</h2>
    <p>The import tool uses the Google Places API (New). Create a key in Google Cloud Console with <b>Places API (New)</b> enabled, then:</p>
    <p><b>Production</b> (stored as a Worker secret):</p>
    <pre>npx wrangler secret put GOOGLE_PLACES_API_KEY</pre>
    <p><b>Local development</b> — add to <code>.dev.vars</code> in the backend folder (copy <code>.dev.vars.example</code>):</p>
    <pre>GOOGLE_PLACES_API_KEY=AIza...</pre>
    <p class="muted">Restart <code>wrangler dev</code> after editing .dev.vars. Billing: Text Search (Pro SKU) and Place Details are charged per request; photos are only fetched when "Import photo" is ticked.</p>
  </div>
)

type DoctorBrief = { id: string; name: string; slug: string }

async function doctorBrief(db: D1Database, id: string | undefined): Promise<DoctorBrief | null> {
  if (!id || !ID_RE.test(id)) return null
  return one<DoctorBrief>(db, 'SELECT id, name, slug FROM doctors WHERE id = ?', id)
}

importAdmin.get('/', async (c) => {
  const user = c.get('user')
  const lk = await lookups(c.env.DB)
  const targetDoctor = await doctorBrief(c.env.DB, c.req.query('doctor_id'))
  const q = (c.req.query('q') ?? '').trim().slice(0, 120)
  const cityId = c.req.query('city_id') ?? ''
  const radiusKm = Math.min(50, Math.max(1, toInt(c.req.query('radius_km')) ?? 10))
  const apiKey = c.env.GOOGLE_PLACES_API_KEY

  let results: Place[] = []
  let error: string | null = null
  const imported = new Map<string, { kind: 'doctor' | 'clinic'; id: string }>()
  if (apiKey && q) {
    const city = lk.cities.find((ci) => ci.id === cityId)
    try {
      results = await searchText(apiKey, { textQuery: q, center: city?.lat !== null && city?.lat !== undefined && city.lng !== null ? { lat: city.lat, lng: city.lng } : undefined, radiusMeters: radiusKm * 1000 })
    } catch (e) {
      error = e instanceof PlacesError ? e.message : 'Places search failed.'
    }
    if (results.length) {
      const ids = results.map((r) => r.id)
      const ph = ids.map(() => '?').join(',')
      const [cls, drs] = await Promise.all([
        all<{ id: string; google_place_id: string }>(c.env.DB, `SELECT id, google_place_id FROM clinics WHERE google_place_id IN (${ph})`, ...ids),
        all<{ id: string; google_place_id: string }>(c.env.DB, `SELECT id, google_place_id FROM doctors WHERE google_place_id IN (${ph})`, ...ids),
      ])
      for (const r of cls) imported.set(r.google_place_id, { kind: 'clinic', id: r.id })
      for (const r of drs) imported.set(r.google_place_id, { kind: 'doctor', id: r.id })
    }
  }
  const extra = targetDoctor ? `&doctor_id=${encodeURIComponent(targetDoctor.id)}` : ''
  return c.html(
    <AdminLayout title="Import from Google Maps" user={user} error={error} flash={c.req.query('flash')}>
      <h1>Import Doctor / Clinic from Google Maps</h1>
      {targetDoctor ? <div class="flash">Importing a new location for <b>{targetDoctor.name}</b>. The review screen will attach the clinic to this doctor. <a href="/admin/import">Cancel</a></div> : null}
      {!apiKey ? <SetupInstructions /> : null}
      <form method="get" class="card filters">
        {targetDoctor ? <input type="hidden" name="doctor_id" value={targetDoctor.id} /> : null}
        <div style="flex:3 1 260px"><label>Search query</label><input type="search" name="q" value={q} placeholder='e.g. "sexologist in Lajpat Nagar Delhi"' required /></div>
        <div><label>City (location bias)</label>
          <Select name="city_id" value={cityId} options={lk.cities.map((ci) => ({ value: ci.id, label: ci.name }))} blank="No bias" />
        </div>
        <div style="flex:0 1 110px"><label>Radius (km)</label><input type="number" name="radius_km" min={1} max={50} value={radiusKm} /></div>
        <div style="flex:0"><button class="btn" type="submit" disabled={!apiKey}>Search</button></div>
      </form>
      {q && apiKey ? (
        <div class="tbl-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Rating</th><th>Address</th><th>Status</th><th>Import</th></tr></thead>
            <tbody>
              {results.map((p) => {
                const done = imported.get(p.id)
                return (
                  <tr>
                    <td>{p.displayName?.text}<div class="muted">{p.googleMapsUri ? <a href={p.googleMapsUri} target="_blank" rel="noopener">Maps</a> : null}</div></td>
                    <td>{p.primaryTypeDisplayName?.text ?? p.primaryType ?? '—'}</td>
                    <td>{p.rating ?? '—'} ★ <span class="muted">({p.userRatingCount ?? 0})</span></td>
                    <td>{p.formattedAddress}</td>
                    <td>{done ? <a class="badge ok" href={done.kind === 'doctor' ? `/admin/doctors/${done.id}` : `/admin/clinics/${done.id}`}>already imported ({done.kind})</a> : p.businessStatus && p.businessStatus !== 'OPERATIONAL' ? <span class="badge warn">{p.businessStatus}</span> : null}</td>
                    <td>
                      <div class="actions" style="margin:0">
                        <a class="btn small secondary" href={`/admin/import/review?place_id=${encodeURIComponent(p.id)}&as=clinic${extra}`}>{targetDoctor ? 'Add as location' : 'Import as clinic'}</a>
                        {!targetDoctor ? <a class="btn small" href={`/admin/import/review?place_id=${encodeURIComponent(p.id)}&as=doctor`}>Import as doctor + clinic</a> : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {results.length === 0 && !error ? <tr><td colspan={6} class="muted">No results.</td></tr> : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </AdminLayout>,
  )
})

importAdmin.get('/review', async (c) => {
  const apiKey = c.env.GOOGLE_PLACES_API_KEY
  const user = c.get('user')
  if (!apiKey) return c.html(<AdminLayout title="Import" user={user}><SetupInstructions /></AdminLayout>)
  const placeId = c.req.query('place_id') ?? ''
  const as = c.req.query('as') === 'doctor' ? 'doctor' : 'clinic'
  if (!/^[A-Za-z0-9_-]{5,300}$/.test(placeId)) return c.text('Invalid place_id', 400)
  const targetDoctor = await doctorBrief(c.env.DB, c.req.query('doctor_id'))

  let place: Place
  try {
    place = await placeDetails(apiKey, placeId)
  } catch (e) {
    return c.html(<AdminLayout title="Import" user={user} error={e instanceof PlacesError ? e.message : 'Place details failed.'}><a href="/admin/import">Back to search</a></AdminLayout>, 502)
  }
  const parsed = parsePlace(place)
  const lk = await lookups(c.env.DB)
  const existing = await one<ClinicRow>(c.env.DB, 'SELECT * FROM clinics WHERE google_place_id = ?', placeId)
  const cityName = (parsed.cityName ?? '').toLowerCase()
  const city = existing ? lk.cities.find((ci) => ci.id === existing.city_id) : lk.cities.find((ci) => ci.name.toLowerCase() === cityName || cityName.includes(ci.name.toLowerCase()) || (ci.slug === 'bangalore' && cityName.includes('bengaluru')))
  const area = city && parsed.lat !== null && parsed.lng !== null ? nearestArea(lk.areas, city.id, parsed.lat, parsed.lng) : null
  const sexologist = lk.specialties.find((s) => s.slug === 'sexologist')
  const clinicValues: Partial<ClinicRow> = existing ?? {
    name: parsed.name, address: parsed.address, pincode: parsed.pincode, locality: parsed.locality, city_id: city?.id, area_id: area?.id ?? null,
    lat: parsed.lat ?? undefined, lng: parsed.lng ?? undefined, phone: parsed.phone, website: parsed.website, google_maps_url: parsed.mapsUrl,
    timings: JSON.stringify(parsed.timings), clinic_type: parsed.clinicType, is_published: 1,
  }
  const doctorQ = (c.req.query('doctor_q') ?? '').trim().slice(0, 80)
  const doctorMatches = doctorQ ? await all<DoctorBrief>(c.env.DB, 'SELECT id, name, slug FROM doctors WHERE name LIKE ? ORDER BY name LIMIT 15', `%${doctorQ}%`) : []
  const attachId = targetDoctor?.id ?? c.req.query('attach_doctor_id') ?? ''
  const attached = attachId && attachId !== targetDoctor?.id ? await doctorBrief(c.env.DB, attachId) : targetDoctor
  const reviewUrl = `/admin/import/review?place_id=${encodeURIComponent(placeId)}&as=${as}${targetDoctor ? `&doctor_id=${encodeURIComponent(targetDoctor.id)}` : ''}`

  return c.html(
    <AdminLayout title="Review import" user={user} error={c.req.query('error')}>
      <h1>Review import: {parsed.name}</h1>
      <p class="muted">Google rating {parsed.rating ?? '—'} ★ ({parsed.reviewCount ?? 0} reviews) · {parsed.mapsUrl ? <a href={parsed.mapsUrl} target="_blank" rel="noopener">Open in Maps</a> : null}{existing ? <> · <span class="badge ok">clinic already exists — fields below update it</span></> : null}{!city ? <> · <span class="badge warn">city not matched: "{parsed.cityName ?? '?'}" — choose one</span></> : null}</p>
      {as === 'doctor' && !attached ? (
        <div class="card" style="background:#f8fafc">
          <b>Same doctor, different location?</b> Search existing doctors to attach this clinic instead of creating a duplicate.
          {/* Separate form: HTML forbids nesting it inside the save form below. */}
          <form method="get" action="/admin/import/review" class="filters" style="margin-top:8px">
            <input type="hidden" name="place_id" value={placeId} /><input type="hidden" name="as" value={as} />
            <div><input type="search" name="doctor_q" value={doctorQ} placeholder="Doctor name" /></div>
            <div style="flex:0"><button class="btn small secondary" type="submit">Search</button></div>
          </form>
          {doctorQ ? (
            <ul>
              {doctorMatches.map((d) => <li><a href={`${reviewUrl}&attach_doctor_id=${encodeURIComponent(d.id)}`}>{d.name}</a> <span class="muted">{d.slug}</span></li>)}
              {doctorMatches.length === 0 ? <li class="muted">No match.</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      <form method="post" action="/admin/import/save" class="card">
        <input type="hidden" name="place_id" value={placeId} />
        <input type="hidden" name="as" value={as} />
        {attached ? <input type="hidden" name="attach_doctor_id" value={attached.id} /> : null}
        <input type="hidden" name="raw_json" value={JSON.stringify(place)} />
        <fieldset>
          <legend>Clinic</legend>
          <ClinicFields v={clinicValues} cities={lk.cities} areas={lk.areas} withMap />
          <Field label="Consultation fee at this clinic (Rs)"><input type="number" name="fee" min={0} /></Field>
        </fieldset>
        {as === 'doctor' || attached ? (
          <fieldset>
            <legend>Doctor</legend>
            {attached ? (
              <p>Attach this clinic to existing doctor <b>{attached.name}</b> (<code>{attached.slug}</code>).{targetDoctor ? null : <> <a href={reviewUrl}>Create a new doctor instead</a></>}</p>
            ) : (
              <>
                <DoctorFields
                  v={{ name: parsed.doctorNameGuess ?? '', patients_treated: 'both', specialty_ids: sexologist ? [sexologist.id] : [], google_maps_url: parsed.mapsUrl, phone: parsed.phone, website: parsed.website, is_published: 0 }}
                  specialties={lk.specialties}
                  conditions={lk.conditions}
                />
              </>
            )}
          </fieldset>
        ) : null}
        <fieldset>
          <legend>Photo</legend>
          {parsed.photoName ? (
            <label class="check"><input type="checkbox" name="import_photo" checked={false} />Import first Google photo to R2 ({as === 'doctor' && !attached ? 'doctor + clinic' : 'clinic'}). Attribution stored: {parsed.photoAttribution ?? 'none'}</label>
          ) : <p class="muted">This place has no photos.</p>}
        </fieldset>
        <div class="actions">
          <button class="btn" type="submit">Save import</button>
          <a class="btn secondary" href="/admin/import">Back to search</a>
        </div>
      </form>
    </AdminLayout>,
  )
})

importAdmin.post('/save', async (c) => {
  const apiKey = c.env.GOOGLE_PLACES_API_KEY
  const user = c.get('user')
  const body = await c.req.parseBody({ all: true })
  const placeId = typeof body.place_id === 'string' ? body.place_id : ''
  const as = body.as === 'doctor' ? 'doctor' : 'clinic'
  const rawJson = typeof body.raw_json === 'string' ? body.raw_json : '{}'
  if (!/^[A-Za-z0-9_-]{5,300}$/.test(placeId)) return c.text('Invalid place_id', 400)
  let raw: Place
  try {
    raw = JSON.parse(rawJson) as Place
  } catch {
    return c.text('Invalid raw_json', 400)
  }
  const parsed = parsePlace(raw)
  const back = (msg: string) => c.redirect(`/admin/import/review?place_id=${encodeURIComponent(placeId)}&as=${as}${typeof body.attach_doctor_id === 'string' ? `&attach_doctor_id=${encodeURIComponent(body.attach_doctor_id)}` : ''}&error=${encodeURIComponent(msg)}`)

  const clinicParsed = await parseClinicForm(c.env.DB, body)
  if (!clinicParsed.ok) return back(clinicParsed.errors.join(' '))
  const clinic = clinicParsed.value
  const fee = toInt(typeof body.fee === 'string' ? body.fee : undefined)

  const attachDoctor = await doctorBrief(c.env.DB, typeof body.attach_doctor_id === 'string' ? body.attach_doctor_id : undefined)
  const createDoctor = as === 'doctor' && !attachDoctor
  let doctorInput: ReturnType<typeof parseDoctorForm> | null = null
  if (createDoctor) {
    doctorInput = parseDoctorForm(body)
    if (!doctorInput.ok) return back(doctorInput.errors.join(' '))
  }

  const db = c.env.DB
  const stmts: D1PreparedStatement[] = []
  const existing = await one<{ id: string; slug: string }>(db, 'SELECT id, slug FROM clinics WHERE google_place_id = ?', placeId)
  const clinicId = existing?.id ?? uuid()
  const clinicSlug = existing?.slug ?? (await uniqueSlug(db, 'clinics', `${clinic.name} ${clinic.locality ?? ''}`))
  const google = { placeId, rating: parsed.rating, reviews: parsed.reviewCount }
  if (existing) {
    stmts.push(
      db.prepare(
        `UPDATE clinics SET name = ?, address = ?, pincode = ?, area_id = ?, city_id = ?, locality = ?, lat = ?, lng = ?, phone = ?, whatsapp = ?, website = ?, timings = ?, clinic_type = ?, is_published = ?, google_maps_url = ?, google_rating = ?, google_review_count = ?, updated_at = datetime('now') WHERE id = ?`,
      ).bind(clinic.name, clinic.address, clinic.pincode, clinic.area_id, clinic.city_id, clinic.locality, clinic.lat, clinic.lng, clinic.phone, clinic.whatsapp, clinic.website, clinic.timings, clinic.clinic_type, clinic.is_published, clinic.google_maps_url, google.rating, google.reviews, clinicId),
    )
  } else {
    stmts.push(insertClinicStmt(db, clinicId, clinicSlug, clinic, 'google_places', google))
  }

  let doctorId: string | null = attachDoctor?.id ?? null
  let doctorSlug: string | null = attachDoctor?.slug ?? null
  if (createDoctor && doctorInput && doctorInput.ok) {
    const d = doctorInput.value
    doctorId = uuid()
    doctorSlug = await makeDoctorSlug(db, d.name, d.primary_specialty_id ?? d.specialty_ids[0], clinic.city_id)
    const { cols, vals } = doctorColumns(d, user.id)
    stmts.push(
      db.prepare(`INSERT INTO doctors (id, slug, source, created_by, google_place_id, google_rating, google_review_count, ${cols.join(', ')}) VALUES (?, ?, 'google_places', ?, ?, ?, ?, ${cols.map(() => '?').join(', ')})`)
        .bind(doctorId, doctorSlug, user.id, placeId, parsed.rating, parsed.reviewCount, ...vals),
      ...relationStatements(db, doctorId, d),
    )
  }
  if (doctorId) {
    stmts.push(
      db.prepare('INSERT INTO doctor_clinics (doctor_id, clinic_id, consultation_fee, is_primary) VALUES (?, ?, ?, (SELECT CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END FROM doctor_clinics WHERE doctor_id = ?)) ON CONFLICT (doctor_id, clinic_id) DO UPDATE SET consultation_fee = COALESCE(excluded.consultation_fee, doctor_clinics.consultation_fee)')
        .bind(doctorId, clinicId, fee, doctorId),
    )
  }
  stmts.push(
    db.prepare('INSERT INTO place_imports (id, google_place_id, raw_json, imported_as, doctor_id, clinic_id, imported_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(uuid(), placeId, rawJson, createDoctor ? 'both' : 'clinic', doctorId, clinicId, user.id),
  )
  await db.batch(stmts)

  // Photo import happens after the batch so a Google error never leaves a half-saved import.
  let photoNote = ''
  if (body.import_photo === 'on' && parsed.photoName && apiKey) {
    try {
      const bytes = await fetchPhoto(apiKey, parsed.photoName)
      const clinicKey = photoKey('clinics', clinicSlug)
      await putPhoto(c.env.MEDIA, clinicKey, bytes)
      const after: D1PreparedStatement[] = [db.prepare('UPDATE clinics SET photo_key = ?, photo_attribution = ? WHERE id = ?').bind(clinicKey, parsed.photoAttribution, clinicId)]
      if (createDoctor && doctorId && doctorSlug) {
        const docKey = photoKey('doctors', doctorSlug)
        await putPhoto(c.env.MEDIA, docKey, bytes)
        after.push(db.prepare('UPDATE doctors SET photo_key = ?, photo_attribution = ? WHERE id = ?').bind(docKey, parsed.photoAttribution, doctorId))
      }
      await db.batch(after)
      photoNote = ' Photo imported.'
    } catch (e) {
      photoNote = ` Photo import failed: ${e instanceof Error ? e.message : 'unknown error'}.`
    }
  }
  const target = doctorId ? `/admin/doctors/${doctorId}` : `/admin/clinics/${clinicId}`
  return c.redirect(redirectWithFlash(target, `Imported from Google Maps.${photoNote}`))
})

