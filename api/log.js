// Forwards scan-log rows from the app to the Google Sheet (Apps Script web app).
// The Apps Script URL and the shared secret stay on the server (Vercel env vars):
//   SHEET_WEBHOOK_URL  = https://script.google.com/macros/s/.../exec
//   SHEET_SECRET       = same secret as in the Apps Script
// If they are not set yet, the endpoint answers ok:false and the app keeps working.

const ALLOWED_ORIGIN = /^https:\/\/modena-ai-parts-recogni[a-z0-9-]*\.vercel\.app$|^http:\/\/localhost(:\d+)?$/;
const TYPES = new Set(['scan', 'confirm']);
const MAX_BYTES = 20000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  // Only accept calls coming from the app itself
  const origin = req.headers.origin || '';
  if (origin && !ALLOWED_ORIGIN.test(origin)) return res.status(403).json({ ok: false, error: 'forbidden' });

  const url = process.env.SHEET_WEBHOOK_URL;
  const secret = process.env.SHEET_SECRET;
  if (!url || !secret) return res.status(200).json({ ok: false, error: 'sheet not configured' });

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body || '{}'); } catch (e) { return res.status(400).json({ ok: false, error: 'bad json' }); }
  if (!body || !TYPES.has(body.type) || typeof body.scanId !== 'string') return res.status(400).json({ ok: false, error: 'bad payload' });

  // Keep only plain short values (no images, no nested objects)
  const clean = {};
  for (const [k, v] of Object.entries(body)) {
    if (k === 'secret') continue;
    if (v == null) continue;
    if (typeof v === 'string') clean[k] = v.slice(0, 500);
    else if (typeof v === 'number' || typeof v === 'boolean') clean[k] = v;
  }
  const payload = JSON.stringify({ ...clean, secret });
  if (payload.length > MAX_BYTES) return res.status(413).json({ ok: false, error: 'too large' });

  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: payload, redirect: 'follow' });
    const text = await r.text();
    let out = {};
    try { out = JSON.parse(text); } catch (e) { out = { ok: r.ok }; }
    return res.status(200).json({ ok: !!out.ok, error: out.error });
  } catch (error) {
    return res.status(200).json({ ok: false, error: 'sheet unreachable' });
  }
}
