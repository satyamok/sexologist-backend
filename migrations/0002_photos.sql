-- Photo galleries. owner_type 'clinic' = office/interior photos shown on the clinic page.
-- 'doctor' is reserved; the doctor's profile picture stays in doctors.photo_key.
-- clinics.photo_key stays as the denormalised "cover" (= first gallery photo) and is kept in sync by the app.
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('clinic','doctor')),
  owner_id TEXT NOT NULL,
  key TEXT NOT NULL,
  caption TEXT,
  attribution TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_photos_owner ON photos(owner_type, owner_id, sort_order);

-- Existing single clinic photos become the first gallery photo.
INSERT INTO photos (id, owner_type, owner_id, key, caption, attribution, sort_order)
SELECT lower(hex(randomblob(16))), 'clinic', id, photo_key, NULL, photo_attribution, 0
  FROM clinics WHERE photo_key IS NOT NULL AND photo_key <> '';
