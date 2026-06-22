import { sql, ensureTables } from './_db.js';
import crypto from 'crypto';

const DEFAULT_SLOT   = { x: 880, y: 640, width: 520, height: 520, radius: 32 };
const EMPTY_TEMPLATE = {
  hasTemplate: false, templateName: '', templateDataUrl: '',
  imageSlot: DEFAULT_SLOT, updatedAt: '', fontSettings: null, sharingSettings: null,
};

function sanitizeSlot(slot) {
  if (!slot) return DEFAULT_SLOT;
  return {
    x:      Math.max(0,  parseInt(slot.x)      || 0),
    y:      Math.max(0,  parseInt(slot.y)      || 0),
    width:  Math.max(10, parseInt(slot.width)  || 520),
    height: Math.max(10, parseInt(slot.height) || 520),
    radius: Math.max(0,  parseInt(slot.radius) || 0),
  };
}

async function uploadToCloudinary(base64Data, existingPublicId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary credentials not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to Vercel env vars.');
  }

  const folder    = 'etb2b-events';
  const timestamp = Math.floor(Date.now() / 1000);
  const sigParams = { folder, timestamp: String(timestamp) };
  if (existingPublicId) { sigParams.overwrite = 'true'; sigParams.public_id = existingPublicId; }
  // Cloudinary requires params sorted alphabetically when computing the signature
  const sigString = Object.keys(sigParams).sort().map(k => `${k}=${sigParams[k]}`).join('&');
  const signature = crypto.createHash('sha256').update(sigString + apiSecret).digest('hex');

  const form = new FormData();
  form.append('file', `data:image/png;base64,${base64Data}`);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);
  if (existingPublicId) {
    form.append('public_id', existingPublicId);
    form.append('overwrite', 'true');
  }

  const r      = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const result = await r.json();
  if (!result.secure_url) throw new Error('Cloudinary upload failed: ' + JSON.stringify(result));
  return result;
}

async function loadTemplateConfig(slug) {
  const { rows } = await sql`SELECT * FROM events_config WHERE slug = ${slug}`;
  const stored = rows[0];
  if (!stored || !stored.cloudinary_url) return EMPTY_TEMPLATE;
  try {
    const resp = await fetch(stored.cloudinary_url);
    if (!resp.ok) return EMPTY_TEMPLATE;
    const buf = await resp.arrayBuffer();
    const ct  = (resp.headers.get('content-type') || 'image/png').split(';')[0];
    const b64 = Buffer.from(buf).toString('base64');
    const result = {
      hasTemplate:     true,
      templateName:    stored.template_name || '',
      templateDataUrl: `data:${ct};base64,${b64}`,
      imageSlot:       stored.image_slot || DEFAULT_SLOT,
      updatedAt:       stored.updated_at  || '',
    };
    if (stored.text_slot)        result.textSlot        = stored.text_slot;
    if (stored.font_settings)    result.fontSettings    = stored.font_settings;
    if (stored.sharing_settings) result.sharingSettings = stored.sharing_settings;
    if (stored.field_settings)   result.fieldSettings   = stored.field_settings;
    return result;
  } catch {
    return EMPTY_TEMPLATE;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    await ensureTables();
    const { payload } = req.body || {};
    if (!payload)                 throw new Error('No payload provided.');
    if (!payload.templateDataUrl) throw new Error('Template image is required.');

    const eventSlug = payload.eventSlug || 'default';
    const fileName  = payload.fileName  || `template_${eventSlug}.png`;
    const imageSlot = sanitizeSlot(payload.imageSlot);

    const match = String(payload.templateDataUrl).match(/^data:[^;]+;base64,(.+)$/);
    if (!match) throw new Error('Invalid template image format.');

    const { rows } = await sql`SELECT cloudinary_public_id FROM events_config WHERE slug = ${eventSlug}`;
    const existingPublicId = rows[0]?.cloudinary_public_id || null;
    const uploaded         = await uploadToCloudinary(match[1], existingPublicId);

    await sql`
      INSERT INTO events_config (slug, cloudinary_url, cloudinary_public_id, template_name, image_slot, text_slot, font_settings, sharing_settings, field_settings, updated_at)
      VALUES (
        ${eventSlug}, ${uploaded.secure_url}, ${uploaded.public_id}, ${fileName},
        ${JSON.stringify(imageSlot)},
        ${payload.textSlot        ? JSON.stringify(payload.textSlot)        : null},
        ${payload.fontSettings    ? JSON.stringify(payload.fontSettings)    : null},
        ${payload.sharingSettings ? JSON.stringify(payload.sharingSettings) : null},
        ${payload.fieldSettings   ? JSON.stringify(payload.fieldSettings)   : null},
        NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        cloudinary_url       = EXCLUDED.cloudinary_url,
        cloudinary_public_id = EXCLUDED.cloudinary_public_id,
        template_name        = EXCLUDED.template_name,
        image_slot           = EXCLUDED.image_slot,
        text_slot            = EXCLUDED.text_slot,
        font_settings        = EXCLUDED.font_settings,
        sharing_settings     = EXCLUDED.sharing_settings,
        field_settings       = EXCLUDED.field_settings,
        updated_at           = NOW()`;

    const { rows: listRows } = await sql`SELECT slug FROM events_list WHERE slug = ${eventSlug}`;
    if (listRows.length > 0) {
      await sql`UPDATE events_list SET updated_at = NOW() WHERE slug = ${eventSlug}`;
    } else if (eventSlug === 'default') {
      await sql`INSERT INTO events_list (slug, name) VALUES ('default', 'Default Event') ON CONFLICT DO NOTHING`;
    }

    // Return the saved config immediately from payload — avoids a slow Cloudinary round-trip
    const savedConfig = {
      hasTemplate:     true,
      templateName:    fileName,
      templateDataUrl: payload.templateDataUrl,
      imageSlot:       imageSlot,
      updatedAt:       new Date().toISOString(),
    };
    if (payload.textSlot)        savedConfig.textSlot        = payload.textSlot;
    if (payload.fontSettings)    savedConfig.fontSettings    = payload.fontSettings;
    if (payload.sharingSettings) savedConfig.sharingSettings = payload.sharingSettings;
    if (payload.fieldSettings)   savedConfig.fieldSettings   = payload.fieldSettings;
    return res.status(200).json({ success: true, data: savedConfig });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
