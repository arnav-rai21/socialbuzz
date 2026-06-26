import { sql, ensureTables } from './_db.js';
import { handleCors } from './_cors.js';

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@socialbuzz.app';

async function isApprovedAdmin(email) {
  if (!email) return false;
  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return true;
  const { rows } = await sql`SELECT email FROM admins_approved WHERE LOWER(email) = LOWER(${email})`;
  return rows.length > 0;
}

async function checkGoogleToken(state) {
  if (!state) return { ready: false };
  const { rows } = await sql`
    SELECT data FROM oauth_sessions
    WHERE state = ${state} AND type = 'google' AND expires_at > NOW()`;
  if (!rows[0]) return { ready: false };
  await sql`DELETE FROM oauth_sessions WHERE state = ${state} AND type = 'google'`;
  const session = rows[0].data;
  return { ready: true, email: session.email || '', name: session.name || '', approved: await isApprovedAdmin(session.email) };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    await ensureTables();

    if (req.method === 'POST') {
      const { action, state, email, name } = req.body || {};

      if (action === 'storeGoogleSession') {
        if (!state || !email) throw new Error('Missing state or email.');
        await sql`
          INSERT INTO oauth_sessions (state, type, data, expires_at)
          VALUES (${state}, 'google', ${JSON.stringify({ email, name: name || email })}, NOW() + INTERVAL '600 seconds')
          ON CONFLICT (state, type) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`;
        return res.status(200).json({ success: true, data: { success: true } });
      }

      if (action === 'checkGoogleToken') {
        return res.status(200).json({ success: true, data: await checkGoogleToken(state) });
      }

      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    if (req.method === 'GET') {
      const { action, state } = req.query;

      if (action === 'checkGoogleToken') {
        return res.status(200).json({ success: true, data: await checkGoogleToken(state) });
      }

      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
