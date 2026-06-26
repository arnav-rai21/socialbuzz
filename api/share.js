function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default function handler(req, res) {
  let imageUrl = '';
  try {
    const decoded = decodeURIComponent(req.query.img || '');
    if (decoded.startsWith('https://') || decoded.startsWith('http://')) {
      imageUrl = decoded.replace(/[<>"']/g, '');
    }
  } catch {}

  if (!imageUrl) return res.status(400).send('Missing or invalid img parameter');

  // Optional caption (passed as ?t=). Drives the link-preview title/description
  // that WhatsApp / Facebook / X render when this page is shared.
  let caption = '';
  try { caption = decodeURIComponent(req.query.t || '').slice(0, 280); } catch {}

  const title = caption ? caption.split('\n')[0].slice(0, 70) : 'My Social Media Post';
  const description = caption || 'Created with Social Buzz';
  const titleAttr = escapeAttr(title);
  const descAttr  = escapeAttr(description);
  const imgAttr   = escapeAttr(imageUrl);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:type" content="website">
<meta property="og:title" content="${titleAttr}">
<meta property="og:description" content="${descAttr}">
<meta property="og:image" content="${imgAttr}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="1200">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${titleAttr}">
<meta name="twitter:description" content="${descAttr}">
<meta name="twitter:image" content="${imgAttr}">
<title>${titleAttr}</title>
</head>
<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh">
<img src="${imgAttr}" style="max-width:100%;max-height:100vh;border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,0.5)" alt="Social post">
</body>
</html>`);
}
