export default function handler(req, res) {
  let imageUrl = '';
  try {
    const decoded = decodeURIComponent(req.query.img || '');
    if (decoded.startsWith('https://') || decoded.startsWith('http://')) {
      imageUrl = decoded.replace(/[<>"']/g, '');
    }
  } catch {}

  if (!imageUrl) return res.status(400).send('Missing or invalid img parameter');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta property="og:image" content="${imageUrl}">
<meta property="og:type" content="website">
<meta property="og:title" content="My Social Media Post">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${imageUrl}">
<title>Social Post Preview</title>
</head>
<body style="margin:0;background:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh">
<img src="${imageUrl}" style="max-width:100%;max-height:100vh;border-radius:12px;box-shadow:0 25px 60px rgba(0,0,0,0.5)" alt="Social post">
</body>
</html>`);
}
