import { handleCors } from './_cors.js';
import { sql } from './_db.js';

const EMPTY_STATS = {
  totalGenerates: 0, totalShares: 0, byPlatform: {}, recentUsers: [],
  uniqueUsers: 0, uniqueCompanies: 0, shareRate: 0,
  generatesToday: 0, generates7d: 0, lastActivity: '',
  topCompanies: [], daily: [],
};

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const slug = req.query.slug || req.body?.slug || 'default';

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(),
        event_type TEXT, event_slug TEXT, user_name TEXT, designation TEXT,
        company TEXT, email TEXT, platform TEXT, image_url TEXT, caption TEXT
      )`;
    await sql`CREATE INDEX IF NOT EXISTS activity_log_slug_idx ON activity_log (event_slug, created_at DESC)`;

    // Headline aggregates in a single pass.
    const aggRes = await sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'Generated')::int AS generates,
        COUNT(*) FILTER (WHERE event_type = 'Shared')::int    AS shares,
        COUNT(DISTINCT NULLIF(lower(email), '')) FILTER (WHERE event_type = 'Generated')::int AS unique_users,
        COUNT(DISTINCT NULLIF(company, ''))      FILTER (WHERE event_type = 'Generated')::int AS unique_companies,
        COUNT(*) FILTER (WHERE event_type = 'Generated' AND created_at >= now() - interval '1 day')::int  AS gen_today,
        COUNT(*) FILTER (WHERE event_type = 'Generated' AND created_at >= now() - interval '7 days')::int AS gen_7d,
        MAX(created_at) AS last_activity
      FROM activity_log WHERE event_slug = ${slug}`;
    const agg = aggRes.rows[0] || {};

    // Share platform breakdown.
    const platforms = (await sql`
      SELECT platform, COUNT(*)::int AS n
      FROM activity_log
      WHERE event_slug = ${slug} AND event_type = 'Shared' AND COALESCE(platform, '') <> ''
      GROUP BY platform ORDER BY n DESC`).rows;

    // Top companies by generates.
    const companies = (await sql`
      SELECT company, COUNT(*)::int AS n
      FROM activity_log
      WHERE event_slug = ${slug} AND event_type = 'Generated' AND COALESCE(company, '') <> ''
      GROUP BY company ORDER BY n DESC LIMIT 6`).rows;

    // Daily trend for the last 14 days.
    const daily = (await sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE event_type = 'Generated')::int AS generates,
             COUNT(*) FILTER (WHERE event_type = 'Shared')::int    AS shares
      FROM activity_log
      WHERE event_slug = ${slug} AND created_at >= now() - interval '13 days'
      GROUP BY 1 ORDER BY 1`).rows;

    // Recent activity feed.
    const recent = (await sql`
      SELECT event_type, user_name, designation, company, email, platform, image_url, created_at
      FROM activity_log WHERE event_slug = ${slug}
      ORDER BY created_at DESC LIMIT 25`).rows;

    const totalGenerates = agg.generates || 0;
    const totalShares    = agg.shares    || 0;
    const byPlatform = {};
    platforms.forEach(p => { byPlatform[p.platform] = p.n; });

    return res.status(200).json({
      success: true,
      data: {
        totalGenerates,
        totalShares,
        byPlatform,
        uniqueUsers:     agg.unique_users     || 0,
        uniqueCompanies: agg.unique_companies || 0,
        shareRate:       totalGenerates ? Math.round((totalShares / totalGenerates) * 100) : 0,
        generatesToday:  agg.gen_today || 0,
        generates7d:     agg.gen_7d    || 0,
        lastActivity:    agg.last_activity ? String(agg.last_activity) : '',
        topCompanies:    companies.map(c => ({ company: c.company, count: c.n })),
        daily:           daily.map(d => ({ day: d.day, generates: d.generates, shares: d.shares })),
        recentUsers:     recent.map(r => ({
          timestamp: String(r.created_at || ''),
          eventType: r.event_type || '',
          name:      r.user_name  || '',
          title:     r.designation || '',
          company:   r.company    || '',
          email:     r.email      || '',
          platform:  r.platform   || '',
          imageUrl:  r.image_url  || '',
        })),
      },
    });
  } catch (err) {
    console.error('Stats error:', err.message);
    return res.status(200).json({ success: true, data: EMPTY_STATS });
  }
}
