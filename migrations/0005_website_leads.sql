-- Sales pipeline: doctors to pitch a website to. "Has website" is computed live from
-- doctors.website / clinics.website, so it stays correct when a website is added later.
CREATE TABLE website_leads (
  id TEXT PRIMARY KEY,
  doctor_id TEXT NOT NULL UNIQUE REFERENCES doctors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'new',   -- new | called | interested | not_interested | won
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_website_leads_status ON website_leads(status);
