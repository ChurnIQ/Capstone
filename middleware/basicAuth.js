/**
 * middleware/basicAuth.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable HTTP Basic Authentication for the ChurnIQ API.
 *
 * Credentials come from environment variables (never hardcoded):
 *     BASIC_AUTH_USER   BASIC_AUTH_PASS
 * If either is missing the middleware FAILS CLOSED: Basic requests get 401.
 *
 *   basicAuth()  – strict: only a valid Authorization: Basic header passes.
 *   apiAuth      – used on /api: a client that sends an Authorization header
 *                  (Postman, Swagger, curl) MUST send valid Basic credentials;
 *                  a client without the header (the React dashboard) is let in
 *                  only if it already has a logged-in session (login + 2FA).
 *
 * Failures return 401 JSON. The WWW-Authenticate challenge is only sent when a
 * client actually attempted Basic auth, so the dashboard never gets a browser
 * login pop-up when its session expires.
 */
const crypto = require('crypto');

const REALM = 'ChurnIQ API';

/** Constant-time string comparison (hashing first hides length differences). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Decode "Authorization: Basic base64(user:pass)" → { user, pass } | null */
function parseBasicHeader(header) {
  if (typeof header !== 'string') return null;
  const m = /^Basic\s+([A-Za-z0-9+/=_-]+)\s*$/i.exec(header.trim());
  if (!m) return null;
  let decoded;
  try { decoded = Buffer.from(m[1], 'base64').toString('utf8'); } catch { return null; }
  const idx = decoded.indexOf(':');
  if (idx < 0) return null;
  return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
}

/** Check an Authorization header. Returns { ok, user?, reason? }. */
function verifyBasicHeader(header) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;
  if (!expectedUser || !expectedPass) {
    return { ok: false, reason: 'Basic authentication is not configured on the server' };
  }
  const creds = parseBasicHeader(header);
  if (!creds) return { ok: false, reason: 'Malformed Authorization header' };
  // Evaluate both so timing does not reveal which half was wrong.
  const userOk = safeEqual(creds.user, expectedUser);
  const passOk = safeEqual(creds.pass, expectedPass);
  if (userOk && passOk) return { ok: true, user: creds.user };
  return { ok: false, reason: 'Invalid credentials' };
}

function deny(res, reason, challenge) {
  if (challenge) res.set('WWW-Authenticate', `Basic realm="${REALM}", charset="UTF-8"`);
  return res.status(401).json({ error: 'Unauthorized', message: reason });
}

/** Strict Basic Auth guard (always challenges). */
function basicAuth() {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return deny(res, 'Missing Authorization header', true);
    const r = verifyBasicHeader(header);
    if (!r.ok) return deny(res, r.reason, true);
    req.basicAuthUser = r.user;
    return next();
  };
}

/** Guard for /api: Basic Auth for API clients, existing session for the dashboard. */
function apiAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header) {
    const r = verifyBasicHeader(header);
    if (!r.ok) return deny(res, r.reason, true);
    req.basicAuthUser = r.user;
    return next();
  }
  if (typeof req.isAuthenticated === 'function' && req.isAuthenticated()) return next();
  return deny(res, 'Missing credentials: send an Authorization: Basic header or log in', false);
}

module.exports = { basicAuth, apiAuth, verifyBasicHeader, parseBasicHeader, safeEqual };
