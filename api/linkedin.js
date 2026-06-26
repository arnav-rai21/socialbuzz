import { sql, ensureTables } from './_db.js';
import crypto from 'crypto';
import { handleCors } from './_cors.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://socialbuzz.vercel.app';

function getRedirectUri() {
  return process.env.LINKEDIN_REDIRECT_URI || `${APP_BASE_URL}/api/linkedin-callback`;
}

async function getLinkedInAuthUrl() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) throw new Error('LINKEDIN_CLIENT_ID not configured.');

  const state       = crypto.randomBytes(16).toString('hex').slice(0, 20);
  const nonce       = crypto.randomBytes(16).toString('hex');
  const redirectUri = getRedirectUri();

  await sql`
    INSERT INTO oauth_sessions (state, type, data, expires_at)
    VALUES (${state}, 'linkedin_state', '{}', NOW() + INTERVAL '600 seconds')
    ON CONFLICT (state, type) DO UPDATE SET expires_at = EXCLUDED.expires_at`;

  const authUrl =
    'https://www.linkedin.com/oauth/v2/authorization' +
    `?response_type=code&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${state}&scope=${encodeURIComponent('openid profile email w_member_social')}&nonce=${nonce}` +
    // Request LinkedIn's extended sign-in options (Google, Apple, passkey, password).
    // LinkedIn decides whether to actually show them per device/browser/account/rollout.
    `&enable_extended_login=true`;

  return { authUrl, state, redirectUri };
}

async function getLinkedInPersonUrn(accessToken) {
  const r    = await fetch('https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await r.json();
  if (!data.sub) throw new Error('Could not retrieve LinkedIn user ID: ' + JSON.stringify(data));
  return `urn:li:person:${data.sub}`;
}

async function registerUpload(accessToken, personUrn) {
  const r = await fetch('https://api.linkedin.com/v2/assets?action=registerUpload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }),
  });
  const data = await r.json();
  if (!data.value) throw new Error('LinkedIn upload registration failed: ' + JSON.stringify(data));
  const mechanism = data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'];
  return { assetUrn: data.value.asset, uploadUrl: mechanism.uploadUrl, uploadHeaders: mechanism.headers || {} };
}

async function uploadImage(uploadUrl, extraHeaders, imageBytes) {
  const r = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg', ...extraHeaders },
    body: imageBytes,
  });
  if (r.status >= 400) throw new Error(`LinkedIn image upload failed (${r.status}): ${await r.text()}`);
}

async function createPost(accessToken, personUrn, assetUrn, text) {
  const r = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary:    { text },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', media: assetUrn, description: { text: '' }, title: { text: 'Social Media Post' } }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  if (r.status >= 400) throw new Error(`LinkedIn post failed (${r.status}): ${await r.text()}`);
  return r.headers.get('X-RestLi-Id') || r.headers.get('x-restli-id') || '';
}

async function postToLinkedIn(state, imageUrl, caption) {
  const { rows } = await sql`
    SELECT data FROM oauth_sessions
    WHERE state = ${state} AND type = 'linkedin_token' AND expires_at > NOW()`;
  if (!rows[0]) throw new Error('LinkedIn session not found. Please authenticate again.');

  const tokenData   = rows[0].data;
  const accessToken = tokenData.token;
  // Token is kept alive — not deleted — so the same session can post multiple times
  // until the LinkedIn token expires (typically 60 days).

  const personUrn = await getLinkedInPersonUrn(accessToken);
  let imageBytes;
  if (imageUrl?.startsWith('http')) {
    const r = await fetch(imageUrl);
    if (!r.ok) throw new Error(`Could not fetch image (${r.status}).`);
    imageBytes = Buffer.from(await r.arrayBuffer());
  } else if (imageUrl) {
    imageBytes = Buffer.from(imageUrl, 'base64');
  } else {
    throw new Error('No image provided for LinkedIn upload.');
  }

  const uploadData = await registerUpload(accessToken, personUrn);
  await uploadImage(uploadData.uploadUrl, uploadData.uploadHeaders, imageBytes);
  const postId = await createPost(accessToken, personUrn, uploadData.assetUrn, caption || '');

  return { success: true, postUrl: 'https://www.linkedin.com/feed/', postUrn: postId };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  try {
    await ensureTables();

    if (req.method === 'GET') {
      const { action, state } = req.query;

      if (!action || action === 'getLinkedInAuthUrl') {
        return res.status(200).json({ success: true, data: await getLinkedInAuthUrl() });
      }
      if (action === 'checkLinkedInToken') {
        const { rows } = state
          ? await sql`SELECT state FROM oauth_sessions WHERE state = ${state} AND type = 'linkedin_token' AND expires_at > NOW()`
          : { rows: [] };
        return res.status(200).json({ success: true, data: { ready: rows.length > 0 } });
      }
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    if (req.method === 'POST') {
      const { action, state, imageUrl, caption } = req.body || {};

      if (action === 'getLinkedInAuthUrl') {
        return res.status(200).json({ success: true, data: await getLinkedInAuthUrl() });
      }
      if (action === 'postToLinkedIn') {
        return res.status(200).json({ success: true, data: await postToLinkedIn(state, imageUrl, caption) });
      }
      if (action === 'checkLinkedInToken') {
        const { rows } = state
          ? await sql`SELECT state FROM oauth_sessions WHERE state = ${state} AND type = 'linkedin_token' AND expires_at > NOW()`
          : { rows: [] };
        return res.status(200).json({ success: true, data: { ready: rows.length > 0 } });
      }
      return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
