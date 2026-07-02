import { sql, ensureTables } from './_db.js';
import { handleCors } from './_cors.js';
import { getPlan, isSuperAdmin, FREE_LIMITS } from './_plan.js';

const DEFAULT_SLOT = { x: 880, y: 640, width: 520, height: 520, radius: 32 };

// Per-account: each owner sees only their own events.
async function getEventsList(ownerEmail) {
  if (!ownerEmail) return { events: [] };
  const { rows } = await sql`
    SELECT slug, name, created_at, updated_at FROM events_list
    WHERE LOWER(owner_email) = LOWER(${ownerEmail})
    ORDER BY created_at DESC`;
  return { events: rows.map(r => ({ slug: r.slug, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at })) };
}

async function createEvent(slug, name, ownerEmail) {
  if (!slug || !name) throw new Error('slug and name are required');
  if (!ownerEmail) throw new Error('You must be signed in to create an event.');
  slug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('Invalid slug');

  // Free-tier hard limit: one event per account.
  if (await getPlan(ownerEmail) === 'free') {
    const { rows: cnt } = await sql`SELECT COUNT(*)::int AS n FROM events_list WHERE LOWER(owner_email) = LOWER(${ownerEmail})`;
    if (cnt[0].n >= FREE_LIMITS.maxEvents) {
      throw new Error('UPGRADE_REQUIRED: The Free plan is limited to 1 event. Upgrade to Pro for unlimited events.');
    }
  }

  const { rows } = await sql`SELECT slug FROM events_list WHERE slug = ${slug}`;
  if (rows.length > 0) throw new Error('Event with this slug already exists');

  await sql`INSERT INTO events_list (slug, name, owner_email) VALUES (${slug}, ${String(name)}, LOWER(${ownerEmail}))`;
  await sql`
    INSERT INTO events_config (slug, image_slot)
    VALUES (${slug}, ${JSON.stringify(DEFAULT_SLOT)})
    ON CONFLICT (slug) DO NOTHING`;

  return { success: true, slug, name: String(name) };
}

async function renameEvent(slug, name, ownerEmail) {
  if (!slug) throw new Error('slug is required');
  const newName = String(name || '').trim();
  if (!newName) throw new Error('Event name is required.');
  if (newName.length > 120) throw new Error('Event name is too long (max 120 characters).');

  const owner = (await sql`SELECT owner_email FROM events_list WHERE slug = ${slug}`).rows[0]?.owner_email || '';
  if (!isSuperAdmin(ownerEmail) && owner && owner.toLowerCase() !== String(ownerEmail).toLowerCase()) {
    throw new Error('Not authorized to rename this event.');
  }
  const { rowCount } = await sql`UPDATE events_list SET name = ${newName}, updated_at = NOW() WHERE slug = ${slug}`;
  if (!rowCount) throw new Error('Event not found.');
  return { success: true, slug, name: newName };
}

async function deleteEvent(slug, ownerEmail) {
  if (!slug || slug === 'default') throw new Error('Cannot delete the default event');
  const owner = (await sql`SELECT owner_email FROM events_list WHERE slug = ${slug}`).rows[0]?.owner_email || '';
  if (!isSuperAdmin(ownerEmail) && owner && owner.toLowerCase() !== String(ownerEmail).toLowerCase()) {
    throw new Error('Not authorized to delete this event.');
  }
  await sql`DELETE FROM events_list WHERE slug = ${slug}`;
  await sql`DELETE FROM events_config WHERE slug = ${slug}`;
  await sql`DELETE FROM event_templates WHERE slug = ${slug}`;
  return { success: true };
}

// Delete analytics records (test/junk data). With a visitorId, removes that one
// visitor's journey for the event; without it, clears ALL analytics for the event.
async function deleteActivity(slug, visitorId) {
  if (!slug) throw new Error('slug is required');
  let deleted = 0;
  if (visitorId) {
    const r = await sql`DELETE FROM activity_log WHERE event_slug = ${slug} AND visitor_id = ${visitorId}`;
    deleted = r.rowCount || 0;
  } else {
    const r = await sql`DELETE FROM activity_log WHERE event_slug = ${slug}`;
    deleted = r.rowCount || 0;
  }
  return { success: true, deleted };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    await ensureTables();

    if (req.method === 'GET') {
      return res.status(200).json({ success: true, data: await getEventsList(req.query.adminEmail || '') });
    }

    if (req.method === 'POST') {
      const { action, slug, name, visitorId, adminEmail } = req.body || {};
      if (action === 'getEventsList') return res.status(200).json({ success: true, data: await getEventsList(adminEmail) });
      if (action === 'createEvent')   return res.status(200).json({ success: true, data: await createEvent(slug, name, adminEmail) });
      if (action === 'renameEvent')   return res.status(200).json({ success: true, data: await renameEvent(slug, name, adminEmail) });
      if (action === 'deleteEvent')   return res.status(200).json({ success: true, data: await deleteEvent(slug, adminEmail) });
      if (action === 'deleteActivity') return res.status(200).json({ success: true, data: await deleteActivity(slug, visitorId) });
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
