import { sql, ensureTables } from './_db.js';
import { uploadToS3 } from './_s3.js';
import { handleCors } from './_cors.js';
import { getEventOwnerPlan, FREE_LIMITS } from './_plan.js';

const DEFAULT_SLOT = { x: 880, y: 640, width: 520, height: 520, radius: 32 };

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

function isValidSlug(slug) {
  return /^[a-zA-Z0-9_-]+$/.test(slug);
}

// Build the TemplateConfig the frontend expects from a saved row + payload data url.
function toTemplateConfig(row, templateDataUrl) {
  const cfg = {
    id:              row.id,
    hasTemplate:     true,
    templateName:    row.template_name || '',
    templateDataUrl,
    imageSlot:       row.image_slot || DEFAULT_SLOT,
    isDefault:       !!row.is_default,
    position:        row.position ?? 0,
    updatedAt:       new Date().toISOString(),
  };
  if (row.text_slot)     cfg.textSlot     = row.text_slot;
  if (row.font_settings) cfg.fontSettings = row.font_settings;
  return cfg;
}

// Persist event-level settings (shared by all templates of the event).
async function saveEventSettings(slug, sharingSettings, fieldSettings, photoToolsSettings) {
  await sql`
    INSERT INTO events_config (slug, sharing_settings, field_settings, photo_tools_settings, updated_at)
    VALUES (
      ${slug},
      ${sharingSettings    ? JSON.stringify(sharingSettings)    : null},
      ${fieldSettings      ? JSON.stringify(fieldSettings)      : null},
      ${photoToolsSettings ? JSON.stringify(photoToolsSettings) : null},
      NOW()
    )
    ON CONFLICT (slug) DO UPDATE SET
      sharing_settings     = COALESCE(EXCLUDED.sharing_settings,     events_config.sharing_settings),
      field_settings       = COALESCE(EXCLUDED.field_settings,       events_config.field_settings),
      photo_tools_settings = COALESCE(EXCLUDED.photo_tools_settings, events_config.photo_tools_settings),
      updated_at           = NOW()`;
}

async function touchEvent(slug) {
  const { rows } = await sql`SELECT slug FROM events_list WHERE slug = ${slug}`;
  if (rows.length > 0) {
    await sql`UPDATE events_list SET updated_at = NOW() WHERE slug = ${slug}`;
  } else if (slug === 'default') {
    await sql`INSERT INTO events_list (slug, name) VALUES ('default', 'Default Event') ON CONFLICT DO NOTHING`;
  }
}

// ── saveTemplate ───────────────────────────────────────────────────────────
// Create (no templateId) or update (templateId) a single template row.
async function saveTemplate(payload) {
  if (!payload)                 throw new Error('No payload provided.');
  if (!payload.templateDataUrl) throw new Error('Template image is required.');

  const slug = payload.eventSlug || 'default';
  if (!isValidSlug(slug)) throw new Error('Invalid event slug.');

  const imageSlot = sanitizeSlot(payload.imageSlot);
  const fileName  = payload.fileName || `template_${slug}.png`;
  const textSlotJson     = payload.textSlot     ? JSON.stringify(payload.textSlot)     : null;
  const fontSettingsJson = payload.fontSettings ? JSON.stringify(payload.fontSettings) : null;
  const slotJson         = JSON.stringify(imageSlot);

  const match = String(payload.templateDataUrl).match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);

  let row;
  const templateId = payload.templateId ? parseInt(payload.templateId) : null;

  if (templateId) {
    // ── UPDATE existing template ──
    const { rows: existing } = await sql`SELECT * FROM event_templates WHERE id = ${templateId} AND slug = ${slug}`;
    if (existing.length === 0) throw new Error('Template not found.');

    let imageUrl = existing[0].image_url;
    let imageKey = existing[0].image_key;
    // Only re-upload if the data URL is a freshly-loaded image (not the base64 we served back)
    if (match) {
      const s3Key = `socialbuzz/templates/${slug}/${templateId}.png`;
      const up = await uploadToS3(match[2], s3Key, 'image/png');
      imageUrl = up.url; imageKey = up.key;
    }
    const { rows: updated } = await sql`
      UPDATE event_templates SET
        template_name = ${fileName},
        image_url     = ${imageUrl},
        image_key     = ${imageKey},
        image_slot    = ${slotJson},
        text_slot     = ${textSlotJson},
        font_settings = ${fontSettingsJson},
        updated_at    = NOW()
      WHERE id = ${templateId} AND slug = ${slug}
      RETURNING *`;
    row = updated[0];
  } else {
    // ── CREATE new template ──
    if (!match) throw new Error('Invalid template image format. Must be PNG, JPEG, or WebP.');

    // First template of an event becomes the default.
    const { rows: countRows } = await sql`SELECT COUNT(*)::int AS n FROM event_templates WHERE slug = ${slug}`;
    const isFirst = countRows[0].n === 0;
    const position = countRows[0].n;

    // Free-tier hard limit: one template per event.
    if (countRows[0].n >= FREE_LIMITS.maxTemplatesPerEvent && await getEventOwnerPlan(slug) === 'free') {
      throw new Error('UPGRADE_REQUIRED: The Free plan allows 1 template per event. Upgrade to Pro for multiple templates.');
    }

    const { rows: inserted } = await sql`
      INSERT INTO event_templates (slug, template_name, image_slot, text_slot, font_settings, position, is_default)
      VALUES (${slug}, ${fileName}, ${slotJson}, ${textSlotJson}, ${fontSettingsJson}, ${position}, ${isFirst})
      RETURNING *`;
    row = inserted[0];

    // Upload using the new id in the key, then store the url.
    const s3Key = `socialbuzz/templates/${slug}/${row.id}.png`;
    const up = await uploadToS3(match[2], s3Key, 'image/png');
    const { rows: withImg } = await sql`
      UPDATE event_templates SET image_url = ${up.url}, image_key = ${up.key}
      WHERE id = ${row.id} RETURNING *`;
    row = withImg[0];
  }

  await saveEventSettings(slug, payload.sharingSettings, payload.fieldSettings, payload.photoToolsSettings);
  await touchEvent(slug);

  // Return saved config immediately from the payload data url — avoids a slow S3 round-trip.
  const cfg = toTemplateConfig(row, payload.templateDataUrl);
  if (payload.sharingSettings)    cfg.sharingSettings    = payload.sharingSettings;
  if (payload.fieldSettings)      cfg.fieldSettings      = payload.fieldSettings;
  if (payload.photoToolsSettings) cfg.photoToolsSettings = payload.photoToolsSettings;
  return cfg;
}

// ── saveEventSettings ────────────────────────────────────────────────────────
// Persist event-level settings (sharing / fields / photo tools) without touching
// any template — lets the backend "Save changes" work even before a template
// exists, and for sections (Sharing, Form Fields, Photo Tools) that don't map a slot.
async function saveEventSettingsOnly(slug, payload) {
  if (!isValidSlug(slug)) throw new Error('Invalid event slug.');
  await saveEventSettings(slug, payload?.sharingSettings, payload?.fieldSettings, payload?.photoToolsSettings);
  await touchEvent(slug);
  return {
    success:            true,
    sharingSettings:    payload?.sharingSettings    ?? null,
    fieldSettings:      payload?.fieldSettings      ?? null,
    photoToolsSettings: payload?.photoToolsSettings ?? null,
  };
}

// ── deleteTemplate ─────────────────────────────────────────────────────────
async function deleteTemplate(slug, templateId) {
  if (!isValidSlug(slug)) throw new Error('Invalid event slug.');
  const id = parseInt(templateId);
  if (!id) throw new Error('templateId is required.');

  const { rows: all } = await sql`SELECT id, is_default FROM event_templates WHERE slug = ${slug} ORDER BY position, id`;
  if (all.length <= 1) throw new Error('Cannot delete the last template. An event needs at least one.');

  const target = all.find(t => t.id === id);
  if (!target) throw new Error('Template not found.');

  await sql`DELETE FROM event_templates WHERE id = ${id} AND slug = ${slug}`;

  // If we deleted the default, promote the first remaining template.
  if (target.is_default) {
    const next = all.find(t => t.id !== id);
    if (next) await sql`UPDATE event_templates SET is_default = TRUE WHERE id = ${next.id}`;
  }
  await touchEvent(slug);
  return { success: true };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    await ensureTables();
    const body = req.body || {};
    const action = body.action || 'saveTemplate';

    if (action === 'saveTemplate') {
      const data = await saveTemplate(body.payload);
      return res.status(200).json({ success: true, data });
    }
    if (action === 'deleteTemplate') {
      const data = await deleteTemplate(body.eventSlug || 'default', body.templateId);
      return res.status(200).json({ success: true, data });
    }
    if (action === 'saveEventSettings') {
      const data = await saveEventSettingsOnly(body.eventSlug || 'default', body.payload);
      return res.status(200).json({ success: true, data });
    }
    return res.status(400).json({ success: false, error: 'Unknown action' });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
