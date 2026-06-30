import { sql, ensureTables } from './_db.js';
import { handleCors } from './_cors.js';
import { getPlan, ensureAccount, isSuperAdmin } from './_plan.js';

async function getPendingRequests() {
  const { rows: reqs } = await sql`SELECT email, name, requested_at, status FROM admin_requests ORDER BY requested_at DESC`;
  const { rows: approved } = await sql`SELECT email FROM admins_approved`;
  return {
    requests: reqs.map(r => ({ email: r.email, name: r.name, requestedAt: r.requested_at, status: r.status })),
    approvedAdmins: approved.map(r => r.email),
  };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    await ensureTables();

    if (req.method === 'GET') {
      const { action, email, adminEmail } = req.query;

      if (action === 'checkAdminAccess') {
        await ensureAccount(email);
        return res.status(200).json({ success: true, data: { approved: !!email, plan: await getPlan(email) } });
      }
      if (action === 'getPendingRequests') {
        if (!isSuperAdmin(adminEmail)) throw new Error('Not authorized.');
        return res.status(200).json({ success: true, data: await getPendingRequests() });
      }
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    if (req.method === 'POST') {
      const { action, email, adminEmail, name } = req.body || {};

      if (action === 'checkAdminAccess') {
        await ensureAccount(email);
        return res.status(200).json({ success: true, data: { approved: !!email, plan: await getPlan(email) } });
      }

      if (action === 'requestAdminAccess') {
        if (!email) throw new Error('Email is required to request access.');
        const { rows } = await sql`SELECT id FROM admin_requests WHERE LOWER(email) = LOWER(${email}) AND status = 'pending'`;
        if (rows.length > 0) return res.status(200).json({ success: true, data: { success: true, alreadyPending: true } });
        await sql`DELETE FROM admin_requests WHERE LOWER(email) = LOWER(${email})`;
        await sql`INSERT INTO admin_requests (email, name, status) VALUES (${email}, ${name || email}, 'pending')`;
        return res.status(200).json({ success: true, data: { success: true } });
      }

      if (action === 'approveAccessRequest') {
        if (!isSuperAdmin(adminEmail)) throw new Error('Not authorized.');
        await sql`INSERT INTO admins_approved (email) VALUES (LOWER(${email})) ON CONFLICT DO NOTHING`;
        await sql`UPDATE admin_requests SET status = 'approved' WHERE LOWER(email) = LOWER(${email})`;
        return res.status(200).json({ success: true, data: { success: true } });
      }

      if (action === 'denyAccessRequest') {
        if (!isSuperAdmin(adminEmail)) throw new Error('Not authorized.');
        await sql`UPDATE admin_requests SET status = 'denied' WHERE LOWER(email) = LOWER(${email})`;
        return res.status(200).json({ success: true, data: { success: true } });
      }

      if (action === 'revokeAdminAccess') {
        if (!isSuperAdmin(adminEmail)) throw new Error('Not authorized.');
        if (isSuperAdmin(email)) throw new Error('Cannot revoke super-admin access.');
        await sql`DELETE FROM admins_approved WHERE LOWER(email) = LOWER(${email})`;
        return res.status(200).json({ success: true, data: { success: true } });
      }

      if (action === 'getPendingRequests') {
        if (!isSuperAdmin(adminEmail)) throw new Error('Not authorized.');
        return res.status(200).json({ success: true, data: await getPendingRequests() });
      }

      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
