async function logActivity(eventType, eventSlug, name, designation, company, email, platform, imageUrl, caption) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return;
  try {
    const { sql } = await import('@vercel/postgres');
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(),
        event_type TEXT, event_slug TEXT, user_name TEXT, designation TEXT,
        company TEXT, email TEXT, platform TEXT, image_url TEXT, caption TEXT
      )`;
    await sql`
      INSERT INTO activity_log (event_type, event_slug, user_name, designation, company, email, platform, image_url, caption)
      VALUES (${eventType}, ${eventSlug}, ${name}, ${designation}, ${company}, ${email}, ${platform}, ${imageUrl}, ${caption})`;
  } catch (e) {
    console.error('Analytics log failed:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { data } = req.body || {};
    if (data) {
      await logActivity('Shared',
        data.eventSlug   || 'default', data.name        || '',
        data.designation || '',        data.company     || '',
        data.email       || '',        data.platform    || '',
        data.imageUrl    || '',        data.caption     || '');
    }
    return res.status(200).json({ success: true, data: { success: true } });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
