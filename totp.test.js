const { describe, it } = require('node:test');
const assert = require('node:assert');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
const t = require('./services/totp');

describe('TOTP service', () => {
  it('matches RFC 6238 SHA1 test vectors (last 6 digits)', () => {
    const secret = t.base32Encode(Buffer.from('12345678901234567890'));
    assert.strictEqual(t.totp(secret, 59 * 1000), '287082');
    assert.strictEqual(t.totp(secret, 1111111109 * 1000), '081804');
    assert.strictEqual(t.totp(secret, 2000000000 * 1000), '279037');
  });

  it('accepts current code, rejects wrong code and replays', () => {
    const secret = t.generateSecret();
    const now = Date.now();
    const code = t.totp(secret, now);
    const step = t.verifyTotp(secret, code, { now });
    assert.ok(step);
    assert.strictEqual(t.verifyTotp(secret, code, { now, afterStep: step }), null);
    assert.strictEqual(t.verifyTotp(secret, '000000', { now }) === null || code === '000000', true);
    assert.strictEqual(t.verifyTotp(secret, 'abc123', { now }), null);
  });

  it('encrypts and decrypts secrets, and detects tampering', () => {
    const secret = t.generateSecret();
    const blob = t.encryptSecret(secret);
    assert.notStrictEqual(blob, secret);
    assert.strictEqual(t.decryptSecret(blob), secret);
    const parts = blob.split('.');
    parts[2] = Buffer.from('tampered').toString('base64');
    assert.throws(() => t.decryptSecret(parts.join('.')));
  });

  it('generates unique backup codes and hashes them consistently', () => {
    const codes = t.generateBackupCodes(10);
    assert.strictEqual(new Set(codes).size, 10);
    assert.strictEqual(t.hashBackupCode(codes[0]), t.hashBackupCode(codes[0].toLowerCase().replace('-', '')));
  });
});
