import { sql, ensureTables } from './_db.js';

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  || 'sachitanand.rai@timesinternet.in';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://etb2b-events-independent.vercel.app';
const DEFAULT_SLOT = { x: 880, y: 640, width: 520, height: 520, radius: 32 };
const EMPTY_TEMPLATE = {
  hasTemplate: false, templateName: '', templateDataUrl: '',
  imageSlot: DEFAULT_SLOT, updatedAt: '', fontSettings: null, sharingSettings: null,
};

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
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    await ensureTables();
    const eventSlug = req.query.event || 'default';
    const mode      = req.query.mode  || '';

    const templateConfig    = await loadTemplateConfig(eventSlug);
    const LINKEDIN_REDIRECT = process.env.LINKEDIN_REDIRECT_URI || `${APP_BASE_URL}/api/linkedin-callback`;

    const data = {
      userEmail:           '',
      adminEmail:          ADMIN_EMAIL,
      isAuthorized:        true,
      eventSlug,
      mode,
      templateConfig,
      linkedInRedirectUri: LINKEDIN_REDIRECT,
      googleClientId:      process.env.GOOGLE_CLIENT_ID    || '',
      googleRedirectUri:   process.env.GOOGLE_REDIRECT_URI || `${APP_BASE_URL}/api/google-callback`,
    };

    if (mode === 'admin') {
      const { rows } = await sql`SELECT slug, name, created_at, updated_at FROM events_list ORDER BY created_at DESC`;
      data.eventsList = rows.map(r => ({ slug: r.slug, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at }));
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
