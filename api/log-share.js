import { handleCors } from './_cors.js';
import { sql } from './_db.js';

// Verify a Google One Tap ID token server-side via Google's tokeninfo endpoint
// (no extra dependency). Returns {name,email,picture} only if the token is valid,
// minted for OUR client id, and the email is verified — otherwise null.
async function verifyGoogleIdToken(credential) {
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!r.ok) return null;
    const p = await r.json();
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!p || !clientId || p.aud !== clientId) return null;
    if (p.email_verified !== true && p.email_verified !== 'true') return null;
    return { name: p.name || '', email: (p.email || '').toLowerCase(), picture: p.picture || '' };
  } catch {
    return null;
  }
}

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
    const body = req.body || {};

    // Attendee auto-login: verify a Google One Tap ID token, then log a
    // server-trusted identity row so visit-only attendees aren't "Anonymous".
    if (body.action === 'identifyVisitor') {
      const { credential, eventSlug, visitorId } = body;
      if (!credential) return res.status(200).json({ success: false, error: 'Missing credential' });
      const user = await verifyGoogleIdToken(credential);
      if (!user) return res.status(200).json({ success: false, error: 'Invalid Google token' });
      await logActivity('Identified', eventSlug || 'default', user.name, '', '', user.email, '', '', '', visitorId || '');
      return res.status(200).json({ success: true, data: { name: user.name, email: user.email, picture: user.picture } });
    }

    const { data } = body;
    if (data) {
      // Allowlist of event types; anything else defaults to 'Shared'.
      // 'Opened' = reach, 'Generated'/'Shared' = engagement, 'Identified' = auto-login identity.
      const ALLOWED = new Set(['Opened', 'Generated', 'Shared', 'Identified']);
      const eventType = ALLOWED.has(data.eventType) ? data.eventType : 'Shared';
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
