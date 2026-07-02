import { createPool } from '@vercel/postgres';

const pool = createPool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});

const sql = pool.sql.bind(pool);

let initialized = false;

export async function ensureTables() {
  if (initialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS events_list (
      slug        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )`;
  // Multi-tenancy: every event is owned by the account that created it.
  await sql`ALTER TABLE events_list ADD COLUMN IF NOT EXISTS owner_email TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS events_config (
      slug                 TEXT PRIMARY KEY,
      cloudinary_url       TEXT,
      cloudinary_public_id TEXT,
      template_name        TEXT,
      image_slot           JSONB,
      text_slot            JSONB,
      font_settings        JSONB,
      sharing_settings     JSONB,
      field_settings       JSONB,
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`ALTER TABLE events_config ADD COLUMN IF NOT EXISTS field_settings JSONB`;
  await sql`ALTER TABLE events_config ADD COLUMN IF NOT EXISTS photo_tools_settings JSONB`;

  // ── Multi-template: one row per template, many per event slug ──────────────
  await sql`
    CREATE TABLE IF NOT EXISTS event_templates (
      id            SERIAL PRIMARY KEY,
      slug          TEXT NOT NULL,
      template_name TEXT,
      image_url     TEXT,
      image_key     TEXT,
      image_slot    JSONB,
      text_slot     JSONB,
      font_settings JSONB,
      position      INT DEFAULT 0,
      is_default    BOOLEAN DEFAULT FALSE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_event_templates_slug ON event_templates (slug)`;

  // Idempotent migration: lift each legacy single-template events_config row
  // (which still has its image in cloudinary_url) into event_templates, unless
  // that slug already has templates. Zero data loss for existing events.
  await sql`
    INSERT INTO event_templates (slug, template_name, image_url, image_key, image_slot, text_slot, font_settings, position, is_default)
    SELECT ec.slug, ec.template_name, ec.cloudinary_url, ec.cloudinary_public_id,
           ec.image_slot, ec.text_slot, ec.font_settings, 0, TRUE
    FROM events_config ec
    WHERE ec.cloudinary_url IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM event_templates et WHERE et.slug = ec.slug)`;

  await sql`
    CREATE TABLE IF NOT EXISTS admins_approved (
      email       TEXT PRIMARY KEY,
      approved_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS admin_requests (
      id           SERIAL PRIMARY KEY,
      email        TEXT NOT NULL,
      name         TEXT,
      requested_at TIMESTAMPTZ DEFAULT NOW(),
      status       TEXT DEFAULT 'pending'
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS oauth_sessions (
      state      TEXT NOT NULL,
      type       TEXT NOT NULL,
      data       JSONB,
      expires_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (state, type)
    )`;
  await sql`DELETE FROM oauth_sessions WHERE expires_at < NOW()`;

  // ── Plans (Free/Pro entitlements, keyed by account email) ──────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS account_plans (
      email      TEXT PRIMARY KEY,
      plan       TEXT DEFAULT 'free',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
  // Backfill: existing (pre-multi-tenancy) events belong to the super-admin (Pro).
  const SUPER_ADMIN = (process.env.ADMIN_EMAIL || 'admin@socialbuzz.app').toLowerCase();
  await sql`UPDATE events_list SET owner_email = ${SUPER_ADMIN} WHERE owner_email IS NULL`;

  initialized = true;
}

export { sql };
