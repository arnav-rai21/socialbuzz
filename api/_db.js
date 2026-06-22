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
  initialized = true;
}

export { sql };
