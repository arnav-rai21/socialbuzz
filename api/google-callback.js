import { sql, ensureTables } from './_db.js';

const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI  = process.env.GOOGLE_REDIRECT_URI || 'https://etb2b-events.vercel.app/api/google-callback';
const ALLOWED_DOMAIN       = 'timesinternet.in';

function popupPage(status, data) {
  const icon    = status === 'success' ? '✅' : '❌';
  const message = data.message || (status === 'success' ? 'Sign-in successful. Closing…' : 'Sign-in failed.');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Signing in…</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .card{background:#fff;border-radius:20px;padding:36px 32px;text-align:center;
    max-width:340px;width:100%;box-shadow:0 4px 32px rgba(0,0,0,0.10)}
  .icon{font-size:44px;margin-bottom:16px}
  .msg{color:#475569;font-size:14px;line-height:1.5}
  .sub{color:#94a3b8;font-size:12px;margin-top:8px}
</style>
</head>
<body>
<div class="card">
  <div class="icon">${icon}</div>
  <p class="msg">${message}</p>
  <p class="sub">This window will close automatically.</p>
</div>
<script>
(function(){
  var payload = ${JSON.stringify({ type: 'google_auth_result', ...data })};
  try { if (window.opener) window.opener.postMessage(payload, '*'); } catch(e){}
  setTimeout(function(){ try { window.close(); } catch(e){} }, 1500);
})();
</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    const msg = decodeURIComponent(
      (String(error_description || error || 'Authentication failed')).replace(/\+/g, ' ')
    );
    return res.status(200).send(popupPage('error', { status: 'error', message: msg, state: state || '' }));
  }

  if (!code || !state) {
    return res.status(200).send(popupPage('error', { status: 'error', message: 'Missing parameters.', state: '' }));
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  GOOGLE_REDIRECT_URI,
        grant_type:    'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();

    if (tokens.error) {
      return res.status(200).send(popupPage('error', {
        status: 'error', message: tokens.error_description || tokens.error, state,
      }));
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user   = await userRes.json();
    const email  = (user.email || '').toLowerCase();
    const domain = email.split('@')[1] || '';

    if (domain !== ALLOWED_DOMAIN) {
      return res.status(200).send(popupPage('error', {
        status: 'domain_error',
        message: `Access is restricted to @${ALLOWED_DOMAIN} accounts. You signed in as ${user.email}.`,
        state,
      }));
    }

    await ensureTables();
    await sql`
      INSERT INTO oauth_sessions (state, type, data, expires_at)
      VALUES (${state}, 'google', ${JSON.stringify({ email: user.email, name: user.name || '' })}, NOW() + INTERVAL '600 seconds')
      ON CONFLICT (state, type) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`;

    return res.status(200).send(popupPage('success', {
      status: 'success', state, email: user.email, name: user.name || '', picture: user.picture || '',
    }));
  } catch (err) {
    return res.status(200).send(popupPage('error', {
      status: 'error', message: err.message || 'Unexpected error.', state: state || '',
    }));
  }
}
