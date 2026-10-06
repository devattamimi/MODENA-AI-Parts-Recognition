// Server-side image proxy for MODENA catalog photos.
// Lets the browser load catalog images same-origin (no CORS), so they can be
// resized on a canvas and sent to Claude Vision for comparison.
const ALLOWED_HOSTS = ['ecatalog.modena.com', 'csms.sap.modena.com'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let target;
  try {
    target = new URL(req.query.url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid url' });
  }
  if (!ALLOWED_HOSTS.includes(target.hostname)) {
    return res.status(403).json({ error: 'Host not allowed' });
  }
  try {
    const upstream = await fetch(target.toString());
    if (!upstream.ok) return res.status(upstream.status).end();
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'Upstream fetch failed', detail: e.message });
  }
}
