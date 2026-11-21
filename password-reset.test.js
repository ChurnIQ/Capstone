const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('express-flash');
const {
  createPasswordResetService,
  validatePasswordStrength,
  constants,
} = require('./services/passwordResetService');
const { createEmailService } = require('./services/emailService');
const { createMemoryRateLimiter } = require('./middleware/rateLimit');
const { createPasswordResetRouter, GENERIC_CONFIRMATION } = require('./routes/passwordReset');

function createHarness({ googleOnly = false } = {}) {
  let clock = Date.UTC(2026, 10, 21, 0, 0, 0);
  let nextId = 1;
  const records = new Map();
  const sentEmails = [];
  const otpQueue = ['123456', '654321', '111111', '222222', '333333', '444444'];
  const user = {
    id: 'user-1',
    _id: 'user-1',
    email: 'member@example.test',
    password: googleOnly ? null : 'existing-hash',
  };
  let invalidatedSessions = 0;
  let savedPassword = null;

  const userRepository = {
    async findEligibleByEmail(email) {
      return email === user.email && user.password ? user : null;
    },
    async findById(id) {
      return id === user.id ? user : null;
    },
    async savePassword(target, password) {
      savedPassword = password;
      target.password = `hashed:${password}`;
    },
    async invalidateSessions() {
      invalidatedSessions += 1;
    },
  };

  const resetRepository = {
    async invalidateActiveForUser(userId, consumedAt) {
      for (const record of records.values()) {
        if (record.userId === userId && !record.consumedAt) record.consumedAt = consumedAt;
      }
    },
    async create(data) {
      const record = { ...data, id: String(nextId++), _id: String(nextId - 1) };
      records.set(record.id, record);
      return record;
    },
    async findById(id) {
      return records.get(String(id)) || null;
    },
    async save(record) {
      records.set(String(record.id), record);
      return record;
    },
  };

  const service = createPasswordResetService({
    userRepository,
    resetRepository,
    sendOtpEmail: async (message) => sentEmails.push(message),
    hashSecret: 'unit-test-only-hash-secret',
    now: () => new Date(clock),
    randomOtp: () => otpQueue.shift(),
    randomToken: () => 'unit-test-reset-token',
  });

  return {
    service,
    records,
    sentEmails,
    user,
    advance(ms) { clock += ms; },
    get savedPassword() { return savedPassword; },
    get invalidatedSessions() { return invalidatedSessions; },
  };
}

describe('Password reset service', () => {
  it('stores only an OTP hash and verifies a valid one-time code', async () => {
    const harness = createHarness();
    const request = await harness.service.requestOtp('MEMBER@example.test');
    const record = harness.records.get(request.requestId);

    assert.equal(harness.sentEmails.length, 1);
    assert.equal(harness.sentEmails[0].otp, '123456');
    assert.notEqual(record.otpHash, '123456');
    assert.equal(record.otpHash.length, 64);

    const verified = await harness.service.verifyOtp(request.requestId, '123456');
    assert.equal(verified.ok, true);
    assert.equal(verified.resetToken, 'unit-test-reset-token');
    assert.equal(record.otpHash, null);

    const reused = await harness.service.verifyOtp(request.requestId, '123456');
    assert.deepEqual(reused, { ok: false, code: 'already_used' });
  });

  it('limits incorrect OTP attempts to five', async () => {
    const harness = createHarness();
    const request = await harness.service.requestOtp('member@example.test');

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const result = await harness.service.verifyOtp(request.requestId, '000000');
      assert.equal(result.code, 'invalid');
      assert.equal(result.attemptsRemaining, 5 - attempt);
    }

    const fifth = await harness.service.verifyOtp(request.requestId, '000000');
    assert.equal(fifth.code, 'locked');
    const correctAfterLock = await harness.service.verifyOtp(request.requestId, '123456');
    assert.equal(correctAfterLock.code, 'locked');
  });

  it('rejects an expired OTP', async () => {
    const harness = createHarness();
    const request = await harness.service.requestOtp('member@example.test');
    harness.advance(constants.OTP_TTL_MS + 1);
    const result = await harness.service.verifyOtp(request.requestId, '123456');
    assert.deepEqual(result, { ok: false, code: 'expired' });
  });

  it('enforces resend cooldown and resend limit', async () => {
    const harness = createHarness();
    const request = await harness.service.requestOtp('member@example.test');

    const tooSoon = await harness.service.resendOtp(request.requestId);
    assert.equal(tooSoon.code, 'cooldown');

    for (let resend = 1; resend <= 3; resend += 1) {
      harness.advance(constants.RESEND_COOLDOWN_MS);
      const result = await harness.service.resendOtp(request.requestId);
      assert.equal(result.ok, true);
      assert.equal(result.resendCount, resend);
    }

    harness.advance(constants.RESEND_COOLDOWN_MS);
    const limited = await harness.service.resendOtp(request.requestId);
    assert.deepEqual(limited, { ok: false, code: 'resend_limit' });
  });

  it('resets the password, invalidates sessions, and prevents token reuse', async () => {
    const harness = createHarness();
    const request = await harness.service.requestOtp('member@example.test');
    const verified = await harness.service.verifyOtp(request.requestId, '123456');

    const reset = await harness.service.resetPassword(
      request.requestId,
      verified.resetToken,
      'NewSecure1!',
    );
    assert.deepEqual(reset, { ok: true });
    assert.equal(harness.savedPassword, 'NewSecure1!');
    assert.equal(harness.invalidatedSessions, 1);

    const reused = await harness.service.resetPassword(
      request.requestId,
      verified.resetToken,
      'AnotherSecure2!',
    );
    assert.equal(reused.code, 'invalid_authorization');
  });

  it('handles unknown and Google-only accounts without sending mail', async () => {
    const unknown = createHarness();
    const unknownResult = await unknown.service.requestOtp('missing@example.test');
    assert.equal(unknownResult.requestId, null);
    assert.equal(unknown.sentEmails.length, 0);

    const googleOnly = createHarness({ googleOnly: true });
    const googleResult = await googleOnly.service.requestOtp('member@example.test');
    assert.equal(googleResult.requestId, null);
    assert.equal(googleOnly.sentEmails.length, 0);
  });

  it('enforces the documented password-strength rules', () => {
    assert.match(validatePasswordStrength('short'), /8 characters/);
    assert.match(validatePasswordStrength('lowercase1!'), /uppercase/);
    assert.match(validatePasswordStrength('UPPERCASE1!'), /lowercase/);
    assert.match(validatePasswordStrength('NoNumber!'), /number/);
    assert.match(validatePasswordStrength('NoSpecial1'), /special/);
    assert.equal(validatePasswordStrength('StrongPass1!'), null);
  });
});

describe('Email and request rate limiting', () => {
  it('uses an injected mail transport without contacting a live provider', async () => {
    const messages = [];
    const emailService = createEmailService({
      env: { SMTP_FROM: 'ChurnIQ <test@example.test>' },
      transporter: { sendMail: async (message) => messages.push(message) },
    });

    await emailService.sendPasswordResetOtp({
      to: 'member@example.test',
      otp: '123456',
      expiresMinutes: 5,
    });
    assert.equal(messages.length, 1);
    assert.equal(messages[0].to, 'member@example.test');
    assert.match(messages[0].text, /123456/);
  });

  it('blocks requests after the configured in-memory limit', () => {
    let allowed = 0;
    let blocked = 0;
    const limiter = createMemoryRateLimiter({
      windowMs: 60_000,
      max: 2,
      keyGenerator: () => 'same-key',
      onLimit: () => { blocked += 1; },
    });
    const req = {};
    const res = { set() {} };
    limiter(req, res, () => { allowed += 1; });
    limiter(req, res, () => { allowed += 1; });
    limiter(req, res, () => { allowed += 1; });
    assert.equal(allowed, 2);
    assert.equal(blocked, 1);
  });
});

function noopLimiter(req, res, next) { next(); }

function request(server, jar, { method = 'GET', path: requestPath, form } = {}) {
  const body = form ? new URLSearchParams(form).toString() : '';
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path: requestPath,
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(jar.cookie ? { Cookie: jar.cookie } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const setCookie = res.headers['set-cookie'];
        if (setCookie?.[0]) jar.cookie = setCookie[0].split(';')[0];
        resolve({
          status: res.statusCode,
          location: res.headers.location,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

describe('Password reset HTTP flow (mocked, no MongoDB)', () => {
  it('renders the generic confirmation and completes verify/reset redirects', async () => {
    const calls = [];
    const mockService = {
      async requestOtp(email) { calls.push(['request', email]); return { requestId: 'request-1' }; },
      async verifyOtp(id, otp) { calls.push(['verify', id, otp]); return { ok: true, resetToken: 'reset-token' }; },
      async resendOtp() { return { ok: true, resendCount: 1 }; },
      async isResetAuthorized() { return true; },
      validatePasswordStrength: () => null,
      async resetPassword(id, token, password) {
        calls.push(['reset', id, token, password]);
        return { ok: true };
      },
    };

    const app = express();
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));
    app.use(express.urlencoded({ extended: true }));
    app.use(session({ secret: 'integration-test-secret', resave: false, saveUninitialized: false }));
    app.use(flash());
    app.use(createPasswordResetRouter({
      service: mockService,
      rateLimiters: { forgot: noopLimiter, verify: noopLimiter, resend: noopLimiter, reset: noopLimiter },
    }));
    app.get('/login', (req, res) => res.status(200).send(req.flash('success')[0] || 'login'));

    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const jar = {};

    try {
      const forgot = await request(server, jar, {
        method: 'POST',
        path: '/forgot-password',
        form: { email: 'member@example.test' },
      });
      assert.equal(forgot.status, 302);
      assert.equal(forgot.location, '/verify-otp');

      const verifyPage = await request(server, jar, { path: '/verify-otp' });
      assert.equal(verifyPage.status, 200);
      assert.match(verifyPage.body, new RegExp(GENERIC_CONFIRMATION));

      const verify = await request(server, jar, {
        method: 'POST',
        path: '/verify-otp',
        form: { otp: '123456' },
      });
      assert.equal(verify.location, '/reset-password');

      const resetPage = await request(server, jar, { path: '/reset-password' });
      assert.equal(resetPage.status, 200);

      const reset = await request(server, jar, {
        method: 'POST',
        path: '/reset-password',
        form: { password: 'StrongPass1!', confirmPassword: 'StrongPass1!' },
      });
      assert.equal(reset.status, 302);
      assert.equal(reset.location, '/login');
      assert.deepEqual(calls[0], ['request', 'member@example.test']);
      assert.deepEqual(calls[1], ['verify', 'request-1', '123456']);
      assert.deepEqual(calls[2], ['reset', 'request-1', 'reset-token', 'StrongPass1!']);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
