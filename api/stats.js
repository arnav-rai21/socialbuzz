const EMPTY_STATS = { totalGenerates: 0, totalShares: 0, byPlatform: {}, recentUsers: [] };

export default async function handler(req, res) {
  const slug = req.query.slug || req.body?.slug || 'default';

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return res.status(200).json({ success: true, data: EMPTY_STATS });
  }

  try {
    const { sql } = await import('@vercel/postgres');
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(),
        event_type TEXT, event_slug TEXT, user_name TEXT, designation TEXT,
        company TEXT, email TEXT, platform TEXT, image_url TEXT, caption TEXT
      )`;
    await sql`CREATE INDEX IF NOT EXISTS activity_log_slug_idx ON activity_log (event_slug, created_at DESC)`;

    const rows = await sql`
      SELECT event_type, user_name, company, email, platform, created_at
      FROM activity_log WHERE event_slug = ${slug}
      ORDER BY created_at DESC LIMIT 500`;

    let totalGenerates = 0, totalShares = 0;
    const byPlatform = {};
    const recentUsers = [];

    for (const row of rows.rows) {
      if (row.event_type === 'Generated') totalGenerates++;
      if (row.event_type === 'Shared') {
        totalShares++;
        if (row.platform) byPlatform[row.platform] = (byPlatform[row.platform] || 0) + 1;
      }
      if (recentUsers.length < 20) {
        recentUsers.push({
          timestamp: String(row.created_at || ''),
          eventType: row.event_type || '',
          name:      row.user_name  || '',
          company:   row.company    || '',
          email:     row.email      || '',
          platform:  row.platform   || '',
        });
      }
    }

    return res.status(200).json({ success: true, data: { totalGenerates, totalShares, byPlatform, recentUsers } });
  } catch (err) {
    console.error('Stats error:', err.message);
    return res.status(200).json({ success: true, data: EMPTY_STATS });
  }
}
