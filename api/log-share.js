import { handleCors } from './_cors.js';
import { sql } from './_db.js';

async function logActivity(eventType, eventSlug, name, designation, company, email, platform, imageUrl, caption, visitorId) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(),
        event_type TEXT, event_slug TEXT, user_name TEXT, designation TEXT,
        company TEXT, email TEXT, platform TEXT, image_url TEXT, caption TEXT, visitor_id TEXT
      )`;
    await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS visitor_id TEXT`;
    await sql`
      INSERT INTO activity_log (event_type, event_slug, user_name, designation, company, email, platform, image_url, caption, visitor_id)
      VALUES (${eventType}, ${eventSlug}, ${name}, ${designation}, ${company}, ${email}, ${platform}, ${imageUrl}, ${caption}, ${visitorId})`;
  } catch (e) {
    console.error('Analytics log failed:', e.message);
  }
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { data } = req.body || {};
    if (data) {
      // Default to 'Shared'; 'Opened' is used for reach tracking (widget / page views).
      const eventType = data.eventType === 'Opened' ? 'Opened' : 'Shared';
      await logActivity(eventType,
        data.eventSlug   || 'default', data.name        || '',
        data.designation || '',        data.company     || '',
        data.email       || '',        data.platform    || '',
        data.imageUrl    || '',        data.caption     || '',
        data.visitorId   || '');
    }
    return res.status(200).json({ success: true, data: { success: true } });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
