-- SexologistIndia.com initial schema (D1 / SQLite). See SPEC.md for the contract.
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,        -- "pbkdf2$<iter>$<salt-b64>$<hash-b64>"
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master_admin','admin','doctor','patient')),
  doctor_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  lat REAL,
  lng REAL,
  is_published INTEGER NOT NULL DEFAULT 1,
  intro_html TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE areas (
  id TEXT PRIMARY KEY,
  city_id TEXT NOT NULL REFERENCES cities(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  pincode TEXT,
  zone TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  default_radius_km REAL NOT NULL DEFAULT 6,
  is_published INTEGER NOT NULL DEFAULT 1,
  intro_html TEXT,
  UNIQUE (city_id, slug)
);

CREATE TABLE specialties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  plural TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE conditions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  gender_focus TEXT NOT NULL CHECK (gender_focus IN ('male','female','all')),
  description TEXT
);

CREATE TABLE doctors (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male','female','other')),
  patients_treated TEXT NOT NULL DEFAULT 'both' CHECK (patients_treated IN ('men','women','both')),
  photo_key TEXT,
  photo_attribution TEXT,
  qualifications TEXT NOT NULL DEFAULT '[]',
  registration_number TEXT,
  registration_council TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  verified_by TEXT,
  experience_years INTEGER,
  languages TEXT NOT NULL DEFAULT '[]',
  bio TEXT,
  video_consult INTEGER NOT NULL DEFAULT 0,
  video_fee INTEGER,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  google_place_id TEXT,
  google_maps_url TEXT,
  rating_avg REAL,
  review_count INTEGER NOT NULL DEFAULT 0,
  recommend_pct INTEGER,
  google_rating REAL,
  google_review_count INTEGER,
  is_published INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE clinics (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT,
  area_id TEXT REFERENCES areas(id),
  city_id TEXT NOT NULL REFERENCES cities(id),
  locality TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  timings TEXT NOT NULL DEFAULT '{}',
  google_place_id TEXT UNIQUE,
  google_maps_url TEXT,
  google_rating REAL,
  google_review_count INTEGER,
  photo_key TEXT,
  photo_attribution TEXT,
  clinic_type TEXT,
  is_published INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE doctor_clinics (
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  consultation_fee INTEGER,
  is_primary INTEGER NOT NULL DEFAULT 0,
  timings TEXT,
  PRIMARY KEY (doctor_id, clinic_id)
);

CREATE TABLE doctor_specialties (
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  specialty_id TEXT NOT NULL REFERENCES specialties(id),
  is_primary INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (doctor_id, specialty_id)
);

CREATE TABLE doctor_conditions (
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  condition_id TEXT NOT NULL REFERENCES conditions(id),
  PRIMARY KEY (doctor_id, condition_id)
);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  clinic_id TEXT,
  author_name TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text TEXT,
  treated_for TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'site',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE page_faqs (
  id TEXT PRIMARY KEY,
  page_key TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE place_imports (
  id TEXT PRIMARY KEY,
  google_place_id TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  imported_as TEXT NOT NULL CHECK (imported_as IN ('doctor','clinic','both')),
  doctor_id TEXT,
  clinic_id TEXT,
  imported_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  clinic_id TEXT REFERENCES clinics(id),
  mode TEXT NOT NULL CHECK (mode IN ('clinic','video')),
  date TEXT NOT NULL,
  slot TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_clinics_city ON clinics(city_id);
CREATE INDEX idx_clinics_area ON clinics(area_id);
CREATE INDEX idx_clinics_latlng ON clinics(lat, lng);
CREATE INDEX idx_areas_city ON areas(city_id);
CREATE INDEX idx_doctors_published ON doctors(is_published);
CREATE INDEX idx_doctors_place ON doctors(google_place_id);
CREATE INDEX idx_doctor_clinics_clinic ON doctor_clinics(clinic_id);
CREATE INDEX idx_doctor_specialties_specialty ON doctor_specialties(specialty_id);
CREATE INDEX idx_doctor_conditions_condition ON doctor_conditions(condition_id);
CREATE INDEX idx_reviews_doctor ON reviews(doctor_id);
CREATE INDEX idx_place_imports_place ON place_imports(google_place_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_page_faqs_key ON page_faqs(page_key);
CREATE INDEX idx_bookings_doctor ON bookings(doctor_id);
