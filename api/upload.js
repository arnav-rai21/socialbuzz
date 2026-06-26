import crypto from 'crypto';
import { uploadToS3 } from './_s3.js';
import { handleCors } from './_cors.js';
import { sql } from './_db.js';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://socialbuzz.vercel.app';

// ── Cutout.Pro background removal ────────────────────────────────────────────
// Folded into this endpoint (instead of its own api/cutout.js) to stay within
// the platform's 12 serverless-function limit. Triggered via action:'removeBackground'.
const CUTOUT_OPS = {
  removeBg: 'https://www.cutout.pro/api/v1/matting2?mattingType=6&crop=false',
  enhance:  'https://www.cutout.pro/api/v1/photoEnhance',
};
const MAX_BASE64_LENGTH = 20 * 1024 * 1024; // ~15 MB binary — Cutout.Pro's limit
const CUTOUT_BUDGET_MS  = 18_000;           // stay under the client's 20s callApi abort
const CUTOUT_ATTEMPT_MS = 14_000;

// Collect every configured Cutout.Pro key so we can fall back when one is
// exhausted / rate-limited / invalid. Supports a comma-separated primary var
// (CUTOUT_PRO_API_KEY="k1,k2,k3") and numbered vars (CUTOUT_PRO_API_KEY_2..N).
function getCutoutKeys() {
  const keys = [];
  (process.env.CUTOUT_PRO_API_KEY || '').split(',').forEach(k => {
    const t = k.trim();
    if (t) keys.push(t);
  });
  for (let i = 2; i <= 10; i++) {
    const v = (process.env[`CUTOUT_PRO_API_KEY_${i}`] || '').trim();
    if (v) keys.push(v);
  }
  return [...new Set(keys)];
}

// One attempt against Cutout.Pro with a single key. Resolves to base64 PNG, or
// throws so the caller can fall back to the next key.
async function callCutout(url, apiKey, buffer, timeoutMs) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/png' }), 'photo.png');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method:  'POST',
      headers: { APIKEY: apiKey },
      body:    form,
      signal:  controller.signal,
    });
    const buf = Buffer.from(await resp.arrayBuffer());
    const ct  = (resp.headers.get('content-type') || '').toLowerCase();

    // Some ops (matting2) return JSON { code, data.imageBase64 }; others
    // (photoEnhance) stream the binary image directly. Detect by content-type /
    // leading byte and handle both. JSON is also how errors come back.
    const looksJson = ct.includes('json') || (buf.length > 0 && buf[0] === 0x7b /* '{' */);
    if (looksJson) {
      let json;
      try { json = JSON.parse(buf.toString('utf8')); }
      catch { throw new Error(`Unexpected response (HTTP ${resp.status}).`); }
      if (json.code !== 0 || !json.data?.imageBase64) {
        throw new Error(json.msg || json.errorMessage || json.errorCode || `code ${json.code}`);
      }
      return json.data.imageBase64;
    }

    // Binary image stream.
    if (resp.status !== 200 || buf.length < 100) throw new Error(`HTTP ${resp.status}`);
    return buf.toString('base64');
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('timed out');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function handleRemoveBackground(req, res) {
  const keys = getCutoutKeys();
  if (!keys.length) throw new Error('Background removal is not configured. Add CUTOUT_PRO_API_KEY to env vars.');

  const { base64Data, op } = req.body || {};
  if (!base64Data) throw new Error('No image provided.');

  const raw = String(base64Data).replace(/^data:image\/[^;]+;base64,/, '');
  if (raw.length > MAX_BASE64_LENGTH) throw new Error('Image too large (max ~15 MB).');

  const url = CUTOUT_OPS[op] || CUTOUT_OPS.removeBg;
  const buffer = Buffer.from(raw, 'base64');

  // Try each key in turn; fall back on any failure until one succeeds.
  const deadline = Date.now() + CUTOUT_BUDGET_MS;
  let lastErr = 'Image processing failed.';
  for (let i = 0; i < keys.length; i++) {
    const remaining = deadline - Date.now();
    if (remaining < 3_000) break;
    try {
      const imageBase64 = await callCutout(url, keys[i], buffer, Math.min(CUTOUT_ATTEMPT_MS, remaining));
      return res.status(200).json({ success: true, data: { base64Data: `data:image/png;base64,${imageBase64}` } });
    } catch (e) {
      lastErr = e.message || String(e);
    }
  }
  throw new Error(keys.length > 1 ? `All Cutout.Pro keys failed (last: ${lastErr}).` : lastErr);
}

// ── Generated-post upload ────────────────────────────────────────────────────

async function logActivity(eventType, eventSlug, name, designation, company, email, platform, imageUrl, caption) {
  try {
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
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    // Cutout.Pro requests (background removal / enhancement) share this endpoint
    // to stay within the platform's serverless-function cap.
    const action = (req.body || {}).action;
    if (action === 'cutout' || action === 'removeBackground') {
      return await handleRemoveBackground(req, res);
    }

    const { base64Data, profile } = req.body || {};
    if (!base64Data) throw new Error('Generated image is missing.');

    const eventSlug = profile?.eventSlug || 'default';
    const safeName  = (profile?.name || 'social_post').replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'social_post';

    const s3Key = `socialbuzz/users/${Date.now()}_${crypto.randomBytes(8).toString('hex')}.jpg`;
    const { url, key } = await uploadToS3(base64Data, s3Key, 'image/jpeg');
    const shareUrl = `${APP_BASE_URL}/api/share?img=${encodeURIComponent(url)}`;

    // Fire-and-forget: don't make the user wait for analytics logging
    logActivity('Generated', eventSlug,
      profile?.name    || '', profile?.title   || '',
      profile?.company || '', profile?.email   || '',
      '', url, '').catch(() => {});

    return res.status(200).json({
      success: true,
      data: {
        fileId:    key,
        fileName:  safeName + '.jpg',
        driveUrl:  url,
        publicUrl: shareUrl,
        imageUrl:  url,
      },
    });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
