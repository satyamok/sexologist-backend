-- Admin-typed translations for the multilingual directory (no machine translation).
-- A NULL column means "fall back to the English value". `lang` is a site language code, never 'en'.
CREATE TABLE doctor_translations (
  doctor_id TEXT NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,                -- hi, ta, ... (never en)
  name TEXT, bio TEXT, qualifications_note TEXT,   -- all nullable; NULL = fall back to English
  is_reviewed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (doctor_id, lang)
);
CREATE TABLE clinic_translations (
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  lang TEXT NOT NULL,
  name TEXT, address TEXT, locality TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (clinic_id, lang)
);
CREATE TABLE city_translations (city_id TEXT NOT NULL, lang TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY (city_id, lang));
CREATE TABLE area_translations (area_id TEXT NOT NULL, lang TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY (area_id, lang));
