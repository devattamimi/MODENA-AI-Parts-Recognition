// Server-side image proxy for MODENA catalog photos.
// Lets the browser load catalog images same-origin (no CORS), so they can be
// resized on a canvas and sent to Claude Vision for comparison.
//
// csms.sap.modena.com images opened fine in browsers but failed via Node fetch,
// most likely an incomplete SSL certificate chain on that server (browsers repair
// this, Node does not). For the two whitelisted MODENA image hosts only, we relax
// certificate verification and also try plain http as a fallback.
import https from 'https';
import http from 'http';

const ALLOWED_HOSTS = ['ecatalog.modena.com', 'csms.sap.modena.com'];

function get(urlStr, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const lib = u.protocol === 'http:' ? http : https;
    const req = lib.get(u, {
      rejectUnauthorized: false,
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (MODENA-AI-Parts image proxy)' }
    }, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && redirectsLeft > 0) {
        r.resume();
        const next = new URL(r.headers.location, u).toString();
        return resolve(get(next, redirectsLeft - 1));
      }
      if (r.statusCode !== 200) {
        r.resume();
        return reject(new Error('HTTP ' + r.statusCode));
      }
      const chunks = [];
      r.on('data', c => chunks.push(c));
      r.on('end', () => resolve({ buf: Buffer.concat(chunks), type: r.headers['content-type'] || 'image/jpeg' }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

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
  const attempts = [target.toString()];
  if (target.protocol === 'https:') attempts.push(target.toString().replace(/^https:/, 'http:'));
  const errors = [];
  for (const url of attempts) {
    try {
      const { buf, type } = await get(url);
      res.setHeader('Content-Type', type);
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(buf);
    } catch (e) {
      errors.push(url + ' -> ' + e.message);
    }
  }
  return res.status(502).json({ error: 'Upstream fetch failed', detail: errors });
}
