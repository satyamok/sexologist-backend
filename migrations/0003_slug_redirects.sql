-- Old doctor/clinic slugs keep working: the public site answers them with a 301 to the current slug.
CREATE TABLE slug_redirects (
  old_slug TEXT NOT NULL,
  entity TEXT NOT NULL CHECK (entity IN ('doctor','clinic')),
  entity_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (entity, old_slug)
);
CREATE INDEX idx_slug_redirects_entity ON slug_redirects(entity, entity_id);
