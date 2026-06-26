import { sql, ensureTables } from './_db.js';
import { handleCors } from './_cors.js';

const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  || 'admin@socialbuzz.app';
const APP_BASE_URL = process.env.APP_BASE_URL || 'https://socialbuzz.vercel.app';
const DEFAULT_SLOT = { x: 880, y: 640, width: 520, height: 520, radius: 32 };
const EMPTY_TEMPLATE = {
  hasTemplate: false, templateName: '', templateDataUrl: '',
  imageSlot: DEFAULT_SLOT, updatedAt: '', fontSettings: null,
};

// Fetch a stored image URL and inline it as a base64 data URL the canvas can draw.
async function urlToDataUrl(url) {
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const buf = await resp.arrayBuffer();
  const ct  = (resp.headers.get('content-type') || 'image/png').split(';')[0];
  return `data:${ct};base64,${Buffer.from(buf).toString('base64')}`;
}

function rowToTemplate(row, dataUrl) {
  const cfg = {
    id:              row.id,
    hasTemplate:     true,
    templateName:    row.template_name || '',
    templateDataUrl: dataUrl,
    imageSlot:       row.image_slot || DEFAULT_SLOT,
    isDefault:       !!row.is_default,
    position:        row.position ?? 0,
    updatedAt:       row.updated_at || '',
  };
  if (row.text_slot)     cfg.textSlot     = row.text_slot;
  if (row.font_settings) cfg.fontSettings = row.font_settings;
  return cfg;
}

// Returns { templates: TemplateConfig[], sharingSettings, fieldSettings }.
async function loadEventData(slug) {
  const { rows } = await sql`SELECT * FROM event_templates WHERE slug = ${slug} ORDER BY position, id`;

  const templates = [];
  for (const row of rows) {
    if (!row.image_url) continue;
    try {
      const dataUrl = await urlToDataUrl(row.image_url);
      if (dataUrl) templates.push(rowToTemplate(row, dataUrl));
    } catch { /* skip unreachable image */ }
  }

  // Event-level settings shared across templates.
  let sharingSettings = null, fieldSettings = null;
  const { rows: cfgRows } = await sql`SELECT * FROM events_config WHERE slug = ${slug}`;
  const cfg = cfgRows[0];
  if (cfg) {
    sharingSettings = cfg.sharing_settings || null;
    fieldSettings   = cfg.field_settings   || null;
  }

  // Safety net: if no rows came from event_templates yet (e.g. the migration
  // hasn't run, or its image fetch failed) but a legacy single template exists
  // in events_config, surface it so existing templates are never lost on deploy.
  if (templates.length === 0 && cfg && cfg.cloudinary_url) {
    try {
      const dataUrl = await urlToDataUrl(cfg.cloudinary_url);
      if (dataUrl) {
        templates.push(rowToTemplate({
          id:            undefined,           // legacy row has no event_templates id
          template_name: cfg.template_name,
          image_slot:    cfg.image_slot,
          text_slot:     cfg.text_slot,
          font_settings: cfg.font_settings,
          is_default:    true,
          position:      0,
          updated_at:    cfg.updated_at,
        }, dataUrl));
      }
    } catch { /* legacy image unreachable — leave templates empty */ }
  }

  return { templates, sharingSettings, fieldSettings };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    await ensureTables();
    const eventSlug = req.query.event || 'default';
    const mode      = req.query.mode  || '';

    const { templates, sharingSettings, fieldSettings } = await loadEventData(eventSlug);
    const defaultTemplate = templates.find(t => t.isDefault) || templates[0] || EMPTY_TEMPLATE;
    const LINKEDIN_REDIRECT = process.env.LINKEDIN_REDIRECT_URI || `${APP_BASE_URL}/api/linkedin-callback`;

    // Back-compat single template: attach event-level settings onto it for old clients.
    const templateConfig = { ...defaultTemplate };
    if (sharingSettings) templateConfig.sharingSettings = sharingSettings;
    if (fieldSettings)   templateConfig.fieldSettings   = fieldSettings;

    const data = {
      userEmail:           '',
      adminEmail:          ADMIN_EMAIL,
      isAuthorized:        true,
      eventSlug,
      mode,
      templateConfig,                 // default/first template (widget + back-compat)
      templates,                      // all enabled templates for the event
      sharingSettings,                // event-level
      fieldSettings,                  // event-level
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
