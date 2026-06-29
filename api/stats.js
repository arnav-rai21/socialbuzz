import { handleCors } from './_cors.js';
import { sql } from './_db.js';

const EMPTY_STATS = {
  totalGenerates: 0, totalShares: 0, byPlatform: {}, recentUsers: [],
  uniqueUsers: 0, uniqueCompanies: 0, shareRate: 0,
  generatesToday: 0, generates7d: 0, lastActivity: '',
  topCompanies: [], daily: [],
  totalViews: 0, widgetOpens: 0, pageViews: 0, conversionRate: 0,
  uniqueVisitors: 0, journeys: [],
};

// Per-visitor journey: one row per visitor_id with visit/generate/share counts and
// the most-recent non-empty identity. Shared by the JSON response and the CSV export.
async function loadJourneys(sql, slug) {
  const { rows } = await sql`
    SELECT visitor_id,
      MIN(created_at) AS first_seen,
      MAX(created_at) AS last_seen,
      COUNT(*) FILTER (WHERE event_type = 'Opened')::int    AS visits,
      COUNT(*) FILTER (WHERE event_type = 'Generated')::int AS generates,
      COUNT(*) FILTER (WHERE event_type = 'Shared')::int    AS shares,
      (array_agg(user_name ORDER BY created_at DESC) FILTER (WHERE NULLIF(user_name, '') IS NOT NULL))[1] AS name,
      (array_agg(company   ORDER BY created_at DESC) FILTER (WHERE NULLIF(company, '')   IS NOT NULL))[1] AS company,
      (array_agg(email     ORDER BY created_at DESC) FILTER (WHERE NULLIF(email, '')     IS NOT NULL))[1] AS email,
      string_agg(DISTINCT NULLIF(platform, ''), ', ') FILTER (WHERE event_type = 'Shared') AS platforms
    FROM activity_log
    WHERE event_slug = ${slug} AND COALESCE(visitor_id, '') <> ''
    GROUP BY visitor_id
    ORDER BY last_seen DESC
    LIMIT 500`;
  return rows.map(r => ({
    visitorId: r.visitor_id,
    name:      r.name      || '',
    company:   r.company   || '',
    email:     r.email     || '',
    visits:    r.visits    || 0,
    generates: r.generates || 0,
    shares:    r.shares    || 0,
    platforms: r.platforms || '',
    firstSeen: r.first_seen ? String(r.first_seen) : '',
    lastSeen:  r.last_seen  ? String(r.last_seen)  : '',
  }));
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function journeysToCsv(journeys) {
  const header = ['Visitor ID', 'Name', 'Company', 'Email', 'Visits', 'Generated', 'Shared', 'Shared Platforms', 'First Seen', 'Last Seen'];
  const lines = [header.join(',')];
  for (const j of journeys) {
    lines.push([
      j.visitorId, j.name || 'Anonymous', j.company, j.email,
      j.visits, j.generates, j.shares, j.platforms, j.firstSeen, j.lastSeen,
    ].map(csvCell).join(','));
  }
  return lines.join('\r\n');
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  const slug = req.query.slug || req.body?.slug || 'default';

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS activity_log (
        id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW(),
        event_type TEXT, event_slug TEXT, user_name TEXT, designation TEXT,
        company TEXT, email TEXT, platform TEXT, image_url TEXT, caption TEXT, visitor_id TEXT
      )`;
    await sql`ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS visitor_id TEXT`;
    await sql`CREATE INDEX IF NOT EXISTS activity_log_slug_idx ON activity_log (event_slug, created_at DESC)`;

    // CSV export of the per-visitor journey (served by this same route — no extra function).
    if (req.query.format === 'csv') {
      const journeys = await loadJourneys(sql, slug);
      const safeSlug = String(slug).replace(/[^a-z0-9_-]/gi, '') || 'event';
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="event-${safeSlug}-journeys.csv"`);
      return res.status(200).send(journeysToCsv(journeys));
    }

    // Headline aggregates in a single pass.
    const aggRes = await sql`
      SELECT
        COUNT(*) FILTER (WHERE event_type = 'Generated')::int AS generates,
        COUNT(*) FILTER (WHERE event_type = 'Shared')::int    AS shares,
        COUNT(DISTINCT NULLIF(lower(email), '')) FILTER (WHERE event_type = 'Generated')::int AS unique_users,
        COUNT(DISTINCT NULLIF(company, ''))      FILTER (WHERE event_type = 'Generated')::int AS unique_companies,
        COUNT(*) FILTER (WHERE event_type = 'Generated' AND created_at >= now() - interval '1 day')::int  AS gen_today,
        COUNT(*) FILTER (WHERE event_type = 'Generated' AND created_at >= now() - interval '7 days')::int AS gen_7d,
        COUNT(*) FILTER (WHERE event_type = 'Opened')::int                            AS views,
        COUNT(*) FILTER (WHERE event_type = 'Opened' AND platform = 'widget')::int    AS widget_opens,
        COUNT(*) FILTER (WHERE event_type = 'Opened' AND platform = 'direct')::int    AS page_views,
        COUNT(DISTINCT NULLIF(visitor_id, ''))::int                                   AS unique_visitors,
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

    // Recent activity feed — only named events (exclude anonymous 'Opened' views).
    const recent = (await sql`
      SELECT event_type, user_name, designation, company, email, platform, image_url, created_at
      FROM activity_log WHERE event_slug = ${slug} AND event_type IN ('Generated', 'Shared')
      ORDER BY created_at DESC LIMIT 25`).rows;

    // Per-visitor journeys for the report table.
    const journeys = await loadJourneys(sql, slug);

    const totalGenerates = agg.generates || 0;
    const totalShares    = agg.shares    || 0;
    const totalViews     = agg.views     || 0;
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
        totalViews,
        widgetOpens:     agg.widget_opens || 0,
        pageViews:       agg.page_views   || 0,
        conversionRate:  totalViews ? Math.round((totalGenerates / totalViews) * 100) : 0,
        uniqueVisitors:  agg.unique_visitors || 0,
        journeys,
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
