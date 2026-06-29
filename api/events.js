import { sql, ensureTables } from './_db.js';
import { handleCors } from './_cors.js';

const DEFAULT_SLOT = { x: 880, y: 640, width: 520, height: 520, radius: 32 };

async function getEventsList() {
  const { rows } = await sql`SELECT slug, name, created_at, updated_at FROM events_list ORDER BY created_at DESC`;
  return { events: rows.map(r => ({ slug: r.slug, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at })) };
}

async function createEvent(slug, name) {
  if (!slug || !name) throw new Error('slug and name are required');
  slug = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) throw new Error('Invalid slug');

  const { rows } = await sql`SELECT slug FROM events_list WHERE slug = ${slug}`;
  if (rows.length > 0) throw new Error('Event with this slug already exists');

  await sql`INSERT INTO events_list (slug, name) VALUES (${slug}, ${String(name)})`;
  await sql`
    INSERT INTO events_config (slug, image_slot)
    VALUES (${slug}, ${JSON.stringify(DEFAULT_SLOT)})
    ON CONFLICT (slug) DO NOTHING`;

  return { success: true, slug, name: String(name) };
}

async function deleteEvent(slug) {
  if (!slug || slug === 'default') throw new Error('Cannot delete the default event');
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
      return res.status(200).json({ success: true, data: await getEventsList() });
    }

    if (req.method === 'POST') {
      const { action, slug, name, visitorId } = req.body || {};
      if (action === 'getEventsList') return res.status(200).json({ success: true, data: await getEventsList() });
      if (action === 'createEvent')   return res.status(200).json({ success: true, data: await createEvent(slug, name) });
      if (action === 'deleteEvent')   return res.status(200).json({ success: true, data: await deleteEvent(slug) });
      if (action === 'deleteActivity') return res.status(200).json({ success: true, data: await deleteActivity(slug, visitorId) });
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
