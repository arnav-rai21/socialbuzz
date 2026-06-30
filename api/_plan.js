import { sql } from './_db.js';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@socialbuzz.app').toLowerCase();

// Free-tier hard limits. Pro = unlimited / all features on.
export const FREE_LIMITS = {
  maxEvents: 1,
  maxTemplatesPerEvent: 1,
  cutout: false,    // remove background / enhance
  csvExport: false, // per-visitor journey CSV
  widget: false,    // embeddable widget
};

export function isSuperAdmin(email) {
  return !!email && String(email).toLowerCase() === ADMIN_EMAIL;
}

// Resolve an account's plan: super-admin is always Pro; otherwise look it up
// (default 'free' when unknown). Never throws.
export async function getPlan(email) {
  if (!email) return 'free';
  if (isSuperAdmin(email)) return 'pro';
  try {
    const { rows } = await sql`SELECT plan FROM account_plans WHERE LOWER(email) = LOWER(${email})`;
    return rows[0]?.plan === 'pro' ? 'pro' : 'free';
  } catch {
    return 'free';
  }
}

// Auto-provision a Free account row on first sign-in (idempotent).
export async function ensureAccount(email) {
  if (!email || isSuperAdmin(email)) return;
  try {
    await sql`INSERT INTO account_plans (email) VALUES (LOWER(${email})) ON CONFLICT (email) DO NOTHING`;
  } catch { /* best-effort */ }
}

export async function getEventOwner(slug) {
  if (!slug) return '';
  try {
    const { rows } = await sql`SELECT owner_email FROM events_list WHERE slug = ${slug}`;
    return rows[0]?.owner_email || '';
  } catch {
    return '';
  }
}

// Plan of the account that owns a given event (drives per-event / attendee gates).
export async function getEventOwnerPlan(slug) {
  return getPlan(await getEventOwner(slug));
}
