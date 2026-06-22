import crypto from 'crypto';

const APP_BASE_URL = process.env.APP_BASE_URL || 'https://etb2b-events-independent.vercel.app';

async function uploadToCloudinary(base64Data) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey    = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary credentials not configured.');

  const folder    = 'etb2b-events';
  const timestamp = Math.floor(Date.now() / 1000);
  const sigParts  = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash('sha256').update(sigParts + apiSecret).digest('hex');

  const form = new FormData();
  form.append('file', `data:image/jpeg;base64,${base64Data}`);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', folder);

  const r = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
  const result = await r.json();
  if (!result.secure_url) throw new Error('Cloudinary upload failed: ' + JSON.stringify(result));
  return result;
}

async function logActivity(eventType, eventSlug, name, designation, company, email, platform, imageUrl, caption) {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return;
  try {
    const { sql } = await import('@vercel/postgres');
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
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { base64Data, profile } = req.body || {};
    if (!base64Data) throw new Error('Generated image is missing.');

    const eventSlug = profile?.eventSlug || 'default';
    const safeName  = (profile?.name || 'social_post').replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'social_post';

    const uploaded = await uploadToCloudinary(base64Data);
    const shareUrl = `${APP_BASE_URL}/api/share?img=${encodeURIComponent(uploaded.secure_url)}`;

    await logActivity('Generated', eventSlug,
      profile?.name    || '', profile?.title   || '',
      profile?.company || '', profile?.email   || '',
      '', uploaded.secure_url, '');

    return res.status(200).json({
      success: true,
      data: {
        fileId:    uploaded.public_id,
        fileName:  safeName + '.jpg',
        driveUrl:  uploaded.url,
        publicUrl: shareUrl,
        imageUrl:  uploaded.secure_url,
      },
    });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
