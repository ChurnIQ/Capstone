const { describe, it } = require('node:test');
const assert = require('node:assert');
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-secret';
const { helpers } = require('./routes/twoFactor');

describe('Email 2FA helpers', () => {
  it('accepts the right code and rejects wrong, expired and malformed ones', () => {
    const code = helpers.generateEmailCode();
    assert.match(code, /^\d{6}$/);
    const state = { hash: helpers.hashEmailCode(code), exp: Date.now() + 60000 };
    assert.strictEqual(helpers.verifyEmailCode(state, code), true);
    assert.strictEqual(helpers.verifyEmailCode(state, ' ' + code + ' '), true);
    const wrong = code === '000000' ? '000001' : '000000';
    assert.strictEqual(helpers.verifyEmailCode(state, wrong), false);
    assert.strictEqual(helpers.verifyEmailCode(state, 'abcdef'), false);
    assert.strictEqual(helpers.verifyEmailCode({ ...state, exp: Date.now() - 1 }, code), false);
    assert.strictEqual(helpers.verifyEmailCode(null, code), false);
  });

  it('masks email addresses', () => {
    assert.strictEqual(helpers.maskEmail('srishti@example.com'), 'sr*****@example.com');
  });
});
