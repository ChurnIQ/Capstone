// Dependency-free TOTP (RFC 6238) + backup codes + secret encryption at rest.
const crypto = require('crypto');

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of String(str).toUpperCase().replace(/[\s=-]/g, '')) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function hotp(secretB32, counter) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secretB32)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

function totp(secretB32, now = Date.now()) {
  return hotp(secretB32, currentStep(now));
}

// Returns the matched time step (number) or null. `afterStep` blocks replay of
// a code that was already used (pass the last accepted step).
function verifyTotp(secretB32, token, { now = Date.now(), window = 1, afterStep = 0 } = {}) {
  const clean = String(token || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const step = currentStep(now);
  for (let w = -window; w <= window; w++) {
    const s = step + w;
    if (s <= afterStep) continue;
    const expected = Buffer.from(hotp(secretB32, s));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return s;
  }
  return null;
}

function otpauthUri({ secret, email, issuer = 'ChurnIQ' }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

// ── Secret encryption at rest (AES-256-GCM) ───────────────────────────────────
function encryptionKey() {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!raw) throw new Error('TWO_FACTOR_ENCRYPTION_KEY or SESSION_SECRET must be configured');
  return crypto.createHash('sha256').update(`churniq-2fa:${raw}`).digest();
}

function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map(b => b.toString('base64')).join('.');
}

function decryptSecret(blob) {
  const [iv, tag, enc] = String(blob).split('.').map(p => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// ── Backup codes ──────────────────────────────────────────────────────────────
function hashBackupCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
}

function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

module.exports = {
  generateSecret, totp, verifyTotp, otpauthUri,
  encryptSecret, decryptSecret,
  generateBackupCodes, hashBackupCode,
  base32Encode, base32Decode, hotp,
};
