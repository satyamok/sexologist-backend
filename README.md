# sexologistbe — SexologistIndia.com backend

Hono on Cloudflare Workers with D1 (SQLite) and R2. Serves the public JSON API consumed by the HonoX frontend, plus a server-rendered admin UI (`/admin`) with a Google Places import tool.

The field names in the API are a contract with the frontend; see `SPEC.md` (shared with the frontend team) before renaming anything.

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars      # fill in secrets for local dev
npm run db:migrate:local            # create tables in the local D1
npm run db:seed:local               # specialties, conditions, cities, areas
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='min 10 chars' ADMIN_NAME='You' npm run seed:admin -- --local
npm run dev                         # http://localhost:8787
```

Open http://localhost:8787/admin/login and sign in with the seeded account.

### Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `wrangler dev --port 8787` (local D1 + R2 in `.wrangler/`) |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm test` | vitest unit tests (`test/`) |
| `npm run db:migrate:local` / `db:migrate` | apply `migrations/*.sql` to local / remote D1 |
| `npm run db:seed:local` / `db:seed` | run `seed/seed.sql` (idempotent `INSERT OR IGNORE`) |
| `npm run db:seed:doctors:local` / `db:seed:doctors` | run `seed/seed-doctors.sql` — **sample doctors for development only**, see below |
| `npm run seed:admin [-- --local]` | upsert a `master_admin` user (env: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`) |
| `npm run deploy` | `wrangler deploy` |

## Configuration

`wrangler.jsonc`:

- D1 binding `DB` → database `sexologistindia-db`
- R2 binding `MEDIA` → bucket `sexologistindia` (served publicly at `MEDIA_URL`)
- vars: `MEDIA_URL`, `SITE_URL`, `MIN_DOCTORS_PER_PAGE` (thin-page threshold, default 3), `CORS_ORIGINS` (comma separated)

Secrets (never committed):

| Secret | Purpose |
| --- | --- |
| `GOOGLE_PLACES_API_KEY` | Places API (New) key for `/admin/import`. Optional: without it the import page shows setup instructions. |
| `SESSION_SECRET` | reserved for signed tokens; sessions are currently random IDs stored in the `sessions` table |

Production: `npx wrangler secret put GOOGLE_PLACES_API_KEY` (and `SESSION_SECRET`). Local: put them in `.dev.vars`.

## Database

- `migrations/0001_init.sql` — full schema (users, cities, areas, specialties, conditions, doctors, clinics, doctor_clinics, doctor_specialties, doctor_conditions, reviews, page_faqs, place_imports, sessions, bookings) and indexes. Add new migrations as `migrations/000N_*.sql`; never edit an applied file.
- `migrations/0002_photos.sql` — `photos` table (clinic photo galleries: `owner_type`, `owner_id`, `key`, `caption`, `attribution`, `sort_order`) and a data migration that turns every existing `clinics.photo_key` into the first gallery photo. Apply to production with `npm run db:migrate`.
- `seed/seed.sql` — reference data: 8 specialties, 12 conditions, 10 cities (Delhi, Bangalore, Indore, Mumbai, Hyderabad, Chennai, Pune, Kolkata, Ahmedabad, Jaipur), 15 Delhi areas, 8 Bangalore areas, 4 Indore areas with coordinates, zone, pincode and default radius (6 km inner, 10 km outer).
- `seed/seed-doctors.sql` — **sample data for development only**: 14 fictional published doctors (slugs match the article links in the frontend, e.g. `dr-arjun-mehta`), 15 clinics across Delhi, Bangalore and Indore, fees, specialties, conditions and published reviews. Registration numbers are placeholders like `DMC/R/SAMPLE-001`. Run `npm run db:seed:doctors:local` after `db:seed:local`; do not run it against production.
- JSON columns: `doctors.qualifications`, `doctors.languages` are string arrays; `clinics.timings` / `doctor_clinics.timings` are `{"mon":[["10:00","13:00"],["17:00","20:00"]], ...}`.

All SQL uses prepared statements with bound parameters (`src/lib/db.ts` helpers). Multi-row writes use `DB.batch()` so they are atomic.

## Auth

- `POST /auth/login` `{email,password}` (JSON or form) → sets cookie `si_admin` (httpOnly, SameSite=Lax, Secure on https, 30 days) and returns `{ ok, data: { token, expiresAt, user } }`. The `token` can be sent as `Authorization: Bearer <token>` for API clients.
- `POST /auth/logout`, `GET /auth/me`.
- Passwords: PBKDF2-SHA256, 100k iterations, WebCrypto; stored as `pbkdf2$100000$<salt b64>$<hash b64>`. `scripts/seed-admin.mjs` produces the same format with `node:crypto`.
- Roles: `master_admin` (everything incl. `/admin/users`), `admin` (doctors/clinics/import/cities/FAQs/bookings), `doctor`, `patient` (reserved).
- Admin pages are plain HTML forms protected by `hono/csrf` (Origin / Sec-Fetch-Site check).

## Admin UI (`/admin`)

Server-rendered Hono JSX, one inline stylesheet, no framework.

- `/admin` dashboard counts
- `/admin/doctors` list (search, publish toggle, verify toggle), `/admin/doctors/new`, `/admin/doctors/:id` edit: profile, specialties, conditions, photo upload to R2 (`doctors/<slug>.jpg`), locations table with per-clinic fee, **Add location** (search existing clinics and attach with a fee, create a clinic manually, or *Import another location from Google Maps* which opens `/admin/import?doctor_id=…` so the review screen attaches the clinic to this doctor).
- "Mark as verified" is disabled in the browser until a registration number is filled, and rejected server-side as well (`src/lib/doctorForm.ts`).
- `/admin/clinics`, `/admin/clinics/:id` edit with lat/lng inputs and a Leaflet 1.9.4 (cdnjs) draggable pin. Leaving Area blank auto-matches the nearest published area whose radius covers the point. **Clinic photos** section: multi-file upload (JPEG/PNG/WebP, 5 MB each, max 12 per clinic), per-photo caption, move up/down, *Use as cover*, remove (also deletes from R2).

### Photos: profile picture vs clinic gallery

- `doctors.photo_key` is the doctor's **profile picture** (face photo), managed on the doctor page under "Profile picture". It is never filled from Google.
- Clinic/office photos live in the `photos` table (`owner_type = 'clinic'`), keys `clinics/<slug>-N-<version>.<ext>` from `photoKey()`. `clinics.photo_key` / `photo_attribution` are the denormalised **cover** = first gallery photo; every gallery write batches `syncCoverStmt()` (`src/lib/photos.ts`) so they never drift. Pure helpers (`orderPhotos`, `coverKey`, `reorderIds`, `remainingSlots`) are unit tested.
- `/admin/cities` + `/admin/cities/:id` (city fields + areas CRUD)
- `/admin/faqs?page_key=…` editable FAQs per listing page (fallback templates in `src/lib/listing.ts` apply when none exist)
- `/admin/bookings` booking requests with status
- `/admin/users` (master_admin only) create admins, reset passwords, deactivate

## Google Places import flow

1. `/admin/import`: query + city (location bias) + radius. Calls `places:searchText` (Places API New) with the field mask from the spec. Results show an **already imported** badge when `google_place_id` matches an existing clinic or doctor, plus buttons *Import as clinic* / *Import as doctor + clinic*. If `GOOGLE_PLACES_API_KEY` is missing the page renders setup instructions instead of erroring.
2. `/admin/import/review?place_id=…&as=doctor|clinic[&doctor_id=…]`: fetches place details and prefills a form. `src/lib/places.ts` parses locality (`sublocality_level_1`), pincode (`postal_code`, fallback regex on the address), city (matched by name against `cities`), nearest area (within its radius), timings (`regularOpeningHours.periods` → JSON), `clinic_type` (types/name heuristics) and a doctor name guess when the listing starts with "Dr". A search box lets you attach the clinic to an existing doctor instead of creating a duplicate (same doctor, different location). The raw place JSON travels in a hidden field.
3. `POST /admin/import/save`: one `DB.batch()` — upsert clinic by `google_place_id`, create or attach the doctor, `doctor_clinics` link (first clinic becomes primary), specialties/conditions, and a `place_imports` audit row with the raw JSON. If *Import photos* was ticked, up to 5 Google photos (`maxWidthPx=1200`) are fetched afterwards into the **clinic gallery** (`photos` rows with attribution from `authorAttributions`, respecting the 12-photo cap). Google photos are office/storefront shots, so they are never written to the doctor's profile picture. Redirects to `/admin/doctors/:id` (or the clinic when no doctor is involved).

Imported doctors start unpublished; review and tick *Published* when the profile is complete.

## Public API

All responses are `{ ok: true, data }` or `{ ok: false, error }`. GETs send `Cache-Control: public, s-maxage=300`. CORS is enabled for `CORS_ORIGINS`.

| Endpoint | Returns |
| --- | --- |
| `GET /api/cities` | `City[]` `{id,slug,name,state,lat,lng,doctorCount,areas:[{slug,name,zone,doctorCount}]}` |
| `GET /api/meta` | `{specialties:[{slug,name,plural}], conditions:[{slug,name,genderFocus}]}` |
| `GET /api/listing?city=delhi&specialty=sexologist[&area=][&condition=][&doctorGender=male\|female][&online=1][&exp=5\|10\|15\|20][&fee=0-500\|500\|1000\|2000][&video=1][&lang=hindi][&rating=4][&sort=relevance\|distance\|experience\|fee_asc\|fee_desc\|reviews][&page=1]` | `{city, area, specialty, condition, total, page, perPage:20, indexable, items: DoctorCard[], nearbyAreas, otherSpecialties, faqs:[{q,a}], aggregate:{ratingAvg,reviewCount}}`. When neither `specialty` nor `condition` is given, `specialty` defaults to `sexologist`. `city` may be omitted only with `online=1` (India-wide video listing; `city` is then `null` and `nearbyAreas` empty). |
| `GET /api/doctors/:slug` | DoctorCard fields + `bio, clinics[] (address, timings, fee, lat/lng, photos[], photoUrl), specialties[], conditions[], reviews[], faqs[]`. `photoUrl` on the doctor itself is the profile picture. |
| `GET /api/clinics/:slug` | clinic (`citySlug, cityName, areaSlug, areaName, locality, pincode, timings, googleMapsUrl, website, clinicType, photoUrl` = cover, `photos: [{url, caption, attribution}]` ordered gallery) + `doctors: DoctorCard[]`. Listing cards' `clinic` object carries the same `photoUrl`/`photos`. |
| `GET /api/sitemap?type=cities\|areas\|doctors\|clinics\|conditions` | `[{loc,lastmod}]`, only published and indexable pages |
| `POST /api/bookings` | body `{doctorId, clinicId\|null, mode:'clinic'\|'video', date:'YYYY-MM-DD', slot, name, phone, note}` → `{id}` (201). Indian mobile numbers only. |

Relevance (`src/lib/listing.ts`): with an area, clinics physically inside the area (`clinic.area_id`) first, then distance from the area centre, then `rating_avg` desc, `review_count` desc; without an area, rating/reviews then experience. A doctor with several clinics collapses to one card using the nearest clinic, `clinicCount` carries the total. `indexable = total >= MIN_DOCTORS_PER_PAGE` and no filter/sort/page params beyond city/specialty/area/condition/doctorGender/online.

Geo: SQL bounding box (`src/lib/geo.ts`) pre-filters clinics near an area, exact haversine in JS decides inclusion and distance. Coordinates never come from geocoding at request time; they come from Google Places on import or from the admin map pin.

## Adding a city or area

Through the admin: `/admin/cities` → *Add city* (name, state, lat/lng) → open the city → *Add area* (name, zone, pincode, lat/lng, default radius: 6 km for dense inner areas, ~10 km for outer suburbs). Slugs are derived from the name. Or append `INSERT OR IGNORE` rows to `seed/seed.sql` and run `npm run db:seed` so the data is reproducible across environments.

Clinics saved without an explicit area are auto-matched to the nearest published area of their city whose radius covers them; existing clinics are not re-matched when a new area is added, so edit and save them (or run an UPDATE) if needed.

## Tests

`npm test` runs pure unit tests (no Workers runtime): password hashing (incl. compatibility with `seed-admin.mjs`), slugify and form coercions, geo maths, Places response parsing against `test/fixtures/place.json`, listing ranking/collapse/indexable logic, the doctor form validator, and clinic gallery helpers (ordering, cover, reorder, upload cap, Google photo selection). `npm run typecheck` must pass as well.

## Layout

```
migrations/0001_init.sql   schema
seed/seed.sql              reference data
scripts/seed-admin.mjs     master_admin upsert
src/index.ts               app, CORS, error handler, mounts
src/env.ts                 Bindings / context types
src/lib/                   db, password, auth, geo, places, listing, doctorForm, media, photos (clinic galleries)
src/routes/auth.ts         /auth/*
src/routes/api.ts          /api/*
src/routes/admin/          layout + pages (index, doctors, clinics, import, cities, faqs, users, bookings)
test/                      vitest
```
