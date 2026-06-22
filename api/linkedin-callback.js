import { sql, ensureTables } from './_db.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://etb2b-events.vercel.app';

function page(heading, body, isError, state) {
  const color = isError ? '#dc2626' : '#0a66c2';
  const msgPayload = isError
    ? `{type:"linkedin_auth_error",error:${JSON.stringify(String(body || ''))}}`
    : `{type:"linkedin_auth_success",state:${JSON.stringify(String(state || ''))}}`;

  const broadcastJs = `(function(){
    var m=${msgPayload};
    var ws=[window.opener,window.parent,window.top,
            window.opener&&window.opener.parent,window.opener&&window.opener.top];
    for(var i=0;i<ws.length;i++){try{if(ws[i]&&ws[i]!==window)ws[i].postMessage(m,"*");}catch(e){}}
  })();`;
  const autoCloseJs = `setTimeout(function(){try{window.close();}catch(e){}},800);
setTimeout(function(){try{window.close();}catch(e){}},2000);`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body{font-family:Inter,Arial,sans-serif;display:flex;align-items:center;justify-content:center;
    min-height:100vh;margin:0;background:#f8fafc;padding:24px;box-sizing:border-box;text-align:center}
    .c{max-width:340px;width:100%}
    h2{font-size:16px;font-weight:700;color:${color};margin:0 0 4px}
    p{font-size:13px;color:#64748b;margin:0 0 20px}
    button{padding:10px 24px;background:${color};color:#fff;border:none;border-radius:10px;
    font-size:14px;font-weight:600;cursor:pointer}
  </style>
</head>
<body>
  <div class="c">
    <h2>${heading}</h2>
    <p>${body}</p>
    <button onclick="window.close()">Close &amp; Continue</button>
  </div>
  <script>${broadcastJs}${autoCloseJs}</script>
</body>
</html>`;
}

export default async function handler(req, res) {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.status(200).send(page(
      '&#10007; LinkedIn denied access',
      String(error_description || error).replace(/</g, '&lt;'),
      true, state
    ));
  }

  if (!code || !state) {
    return res.status(200).send(page('&#10007; Bad request', 'Missing code or state.', true, state));
  }

  try {
    await ensureTables();

    const { rows } = await sql`
      SELECT state FROM oauth_sessions
      WHERE state = ${state} AND type = 'linkedin_state' AND expires_at > NOW()`;
    if (!rows[0]) {
      return res.status(200).send(page('&#10007; Authorisation failed', 'Session expired or invalid state.', true, state));
    }
    await sql`DELETE FROM oauth_sessions WHERE state = ${state} AND type = 'linkedin_state'`;

    const REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${APP_BASE_URL}/api/linkedin-callback`;
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'authorization_code',
        code,
        redirect_uri:  REDIRECT_URI,
        client_id:     process.env.LINKEDIN_CLIENT_ID     || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      throw new Error('Token exchange failed: ' + JSON.stringify(tokenData));
    }

    const ttl = Number(tokenData.expires_in) || 3600;
    await sql`
      INSERT INTO oauth_sessions (state, type, data, expires_at)
      VALUES (${state}, 'linkedin_token', ${JSON.stringify({ token: tokenData.access_token, expires: Date.now() + ttl * 1000 })}, NOW() + (${ttl} * INTERVAL '1 second'))
      ON CONFLICT (state, type) DO UPDATE SET data = EXCLUDED.data, expires_at = EXCLUDED.expires_at`;

    return res.status(200).send(page('&#10003; LinkedIn connected!', 'Closing automatically&hellip;', false, state));
  } catch (e) {
    return res.status(200).send(page('&#10007; Authorisation failed', String(e.message).replace(/</g, '&lt;'), true, state));
  }
}
