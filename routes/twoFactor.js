const crypto = require('crypto');
const express = require('express');
const User = require('../models/User');
const totpLib = require('../services/totp');
const { createEmailService } = require('../services/emailService');
const { createMemoryRateLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const PENDING_TTL_MS = 10 * 60 * 1000;   // whole sign-in step
const EMAIL_CODE_TTL_MS = 5 * 60 * 1000; // an emailed code
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

let emailService;
const mail = () => emailService || (emailService = createEmailService());

// ── Email-code helpers ────────────────────────────────────────────────────────
function hashEmailCode(code) {
  const secret = process.env.OTP_HASH_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET must be configured');
  return crypto.createHmac('sha256', `${secret}:2fa-email`).update(String(code)).digest('hex');
}

function generateEmailCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Emails a fresh code and returns the server-side state to keep in the session.
async function issueEmailCode(to) {
  const code = generateEmailCode();
  await mail().sendTwoFactorCode({ to, otp: code, expiresMinutes: EMAIL_CODE_TTL_MS / 60000 });
  const now = Date.now();
  return { hash: hashEmailCode(code), exp: now + EMAIL_CODE_TTL_MS, sentAt: now };
}

function verifyEmailCode(state, input) {
  if (!state || !state.hash || Date.now() > state.exp) return false;
  const clean = String(input || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  const a = Buffer.from(hashEmailCode(clean), 'hex');
  const b = Buffer.from(state.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function maskEmail(email) {
  const [name = '', domain = ''] = String(email).split('@');
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`;
}

// ── Shared: finish a login, or park it until the 2FA code is verified ─────────
async function completeLogin(req, res, next, user) {
  const tf = user.twoFactor || {};
  try {
    // Password/Google was correct, but the user is NOT logged in yet.
    const pending = {
      userId: String(user.id), at: Date.now(), attempts: 0,
      // Everyone gets an emailed code by default; authenticator only if they opted in.
      method: tf.enabled && tf.method === 'totp' ? 'totp' : 'email',
    };
    if (pending.method === 'email') {
      Object.assign(pending, await issueEmailCode(user.email), {
        email: user.email, maskedEmail: maskEmail(user.email),
      });
    }
    req.session.pending2fa = pending;
    return req.session.save((err) => (err ? next(err) : res.redirect('/login/2fa')));
  } catch (err) {
    console.error('Could not start 2FA step:', err.code || err.message);
    req.flash('error', 'We could not send your verification code. Please try again.');
    return res.redirect('/login');
  }
}

function getPending(req) {
  const p = req.session && req.session.pending2fa;
  if (!p || Date.now() - p.at > PENDING_TTL_MS) {
    if (req.session) delete req.session.pending2fa;
    return null;
  }
  return p;
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

const redirectOnLimit = (path) => (req, res, retryAfterSeconds) => {
  req.flash('error', `Too many attempts. Please try again in ${retryAfterSeconds} seconds.`);
  res.redirect(path);
};

const loginLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip,
  onLimit: redirectOnLimit('/login'),
});

const securityLimiter = createMemoryRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  keyGenerator: (req) => `${req.ip}:${req.user ? req.user.id : ''}`,
  onLimit: redirectOnLimit('/account/security'),
});

// Verifies an authenticator code or a one-time backup code (authenticator method).
async function checkSecondFactor(user, input) {
  const raw = String(input || '').trim();
  if (!user.twoFactor.secretEnc) return false;
  const secret = totpLib.decryptSecret(user.twoFactor.secretEnc);

  const step = totpLib.verifyTotp(secret, raw, { afterStep: user.twoFactor.lastStep || 0 });
  if (step) {
    // Atomic: a code can only be accepted once even under concurrent requests.
    const updated = await User.findOneAndUpdate(
      { _id: user._id, 'twoFactor.lastStep': { $lt: step } },
      { $set: { 'twoFactor.lastStep': step } }
    );
    return Boolean(updated);
  }

  if (/^[A-Za-z0-9-]{10,12}$/.test(raw) && !/^\d{6}$/.test(raw)) {
    const hash = totpLib.hashBackupCode(raw);
    const updated = await User.findOneAndUpdate(
      { _id: user._id, 'twoFactor.backupCodes': hash },
      { $pull: { 'twoFactor.backupCodes': hash } }
    );
    return Boolean(updated);
  }
  return false;
}

async function loadWithSecrets(id) {
  return User.findById(id).select('+twoFactor.secretEnc +twoFactor.backupCodes');
}

// ── Login step 2 ──────────────────────────────────────────────────────────────
router.get('/login/2fa', (req, res) => {
  const pending = getPending(req);
  if (!pending) return res.redirect('/login');
  res.render('login-2fa', {
    method: pending.method, maskedEmail: pending.maskedEmail || '',
    error: req.flash('error'), success: req.flash('success'),
  });
});

router.post('/login/2fa', loginLimiter, async (req, res, next) => {
  try {
    const pending = getPending(req);
    if (!pending) {
      req.flash('error', 'Your sign-in expired. Please log in again.');
      return res.redirect('/login');
    }

    const user = await loadWithSecrets(pending.userId);
    if (!user) {
      delete req.session.pending2fa;
      return res.redirect('/login');
    }

    const ok = pending.method === 'email'
      ? verifyEmailCode(pending, req.body.code)
      : await checkSecondFactor(user, req.body.code);

    if (ok) {
      delete req.session.pending2fa;
      return req.login(user, (err) => (err ? next(err) : res.redirect('/dashboard')));
    }

    pending.attempts += 1;
    if (pending.attempts >= MAX_ATTEMPTS) {
      delete req.session.pending2fa;
      req.flash('error', 'Too many incorrect codes. Please log in again.');
      return res.redirect('/login');
    }
    req.session.pending2fa = pending;
    req.flash('error', 'Incorrect or expired code. Please try again.');
    return req.session.save(() => res.redirect('/login/2fa'));
  } catch (err) {
    return next(err);
  }
});

router.post('/login/2fa/resend', loginLimiter, async (req, res, next) => {
  try {
    const pending = getPending(req);
    if (!pending || pending.method !== 'email') return res.redirect('/login');
    if (Date.now() - pending.sentAt < RESEND_COOLDOWN_MS) {
      req.flash('error', 'Please wait a few seconds before requesting another code.');
      return res.redirect('/login/2fa');
    }
    Object.assign(pending, await issueEmailCode(pending.email));
    req.session.pending2fa = pending;
    req.flash('success', 'A new code was sent to your email.');
    return req.session.save(() => res.redirect('/login/2fa'));
  } catch (err) {
    console.error('2FA resend failed:', err.code || err.message);
    req.flash('error', 'We could not send the code. Please try again.');
    return res.redirect('/login/2fa');
  }
});

// ── Account security page ─────────────────────────────────────────────────────
const live = (state) => Boolean(state && Date.now() <= state.exp);

async function renderSecurity(req, res, extra = {}) {
  const setup = req.session.setup2fa;
  let qrDataUrl = null;
  let secret = null;
  if (setup && Date.now() - setup.at < 10 * 60 * 1000) {
    secret = setup.secret;
    try {
      const QRCode = require('qrcode'); // optional: falls back to manual key entry
      qrDataUrl = await QRCode.toDataURL(totpLib.otpauthUri({ secret, email: req.user.email }));
    } catch (_) { /* qrcode not installed: manual key only */ }
  } else if (setup) {
    delete req.session.setup2fa;
  }
  const tf = req.user.twoFactor || {};
  res.render('account-security', {
    enabled: Boolean(tf.enabled && tf.method === 'totp'),
    method: tf.enabled && tf.method === 'totp' ? 'totp' : 'email',
    secret, qrDataUrl, backupCodes: null,
    maskedEmail: maskEmail(req.user.email),
    error: req.flash('error'), success: req.flash('success'),
    ...extra,
  });
}

router.get('/account/security', ensureAuth, (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  renderSecurity(req, res).catch(next);
});

const alreadyOn = (req) => Boolean(req.user.twoFactor && req.user.twoFactor.enabled && req.user.twoFactor.method === 'totp');
const flashAndBack = (req, res, type, msg) => { req.flash(type, msg); return res.redirect('/account/security'); };

// -- Authenticator method: turn on --
router.post('/account/security/setup', ensureAuth, securityLimiter, (req, res) => {
  if (alreadyOn(req)) return res.redirect('/account/security');
  req.session.setup2fa = { secret: totpLib.generateSecret(), at: Date.now() };
  req.session.save(() => res.redirect('/account/security'));
});

router.post('/account/security/enable', ensureAuth, securityLimiter, async (req, res, next) => {
  try {
    const setup = req.session.setup2fa;
    if (!setup || Date.now() - setup.at > 10 * 60 * 1000) {
      delete req.session.setup2fa;
      return flashAndBack(req, res, 'error', 'Setup expired. Please start again.');
    }
    const step = totpLib.verifyTotp(setup.secret, req.body.code);
    if (!step) {
      return flashAndBack(req, res, 'error', 'That code is not correct. Check your authenticator app and try again.');
    }

    const codes = totpLib.generateBackupCodes(10);
    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'twoFactor.enabled': true,
        'twoFactor.method': 'totp',
        'twoFactor.secretEnc': totpLib.encryptSecret(setup.secret),
        'twoFactor.backupCodes': codes.map(totpLib.hashBackupCode),
        'twoFactor.lastStep': step,
      },
    });
    delete req.session.setup2fa;
    req.user.twoFactor.enabled = true;
    req.user.twoFactor.method = 'totp';
    res.set('Cache-Control', 'no-store');
    // Backup codes are shown exactly once, on this response.
    return res.render('account-security', {
      enabled: true, method: 'totp', secret: null, qrDataUrl: null, backupCodes: codes,
      maskedEmail: maskEmail(req.user.email),
      error: [], success: ['Two-factor authentication is now on.'],
    });
  } catch (err) {
    return next(err);
  }
});

// -- Switch back to email codes (turn the authenticator app off) --
router.post('/account/security/disable', ensureAuth, securityLimiter, async (req, res, next) => {
  try {
    const user = await loadWithSecrets(req.user.id);
    if (!user || !user.twoFactor.enabled || user.twoFactor.method !== 'totp') return res.redirect('/account/security');

    if (!(await checkSecondFactor(user, req.body.code))) {
      return flashAndBack(req, res, 'error', 'That code is incorrect or expired. Please try again.');
    }
    await User.updateOne({ _id: user.id }, {
      $set: { 'twoFactor.enabled': false, 'twoFactor.method': 'totp', 'twoFactor.lastStep': 0, 'twoFactor.backupCodes': [] },
      $unset: { 'twoFactor.secretEnc': '' },
    });
    return flashAndBack(req, res, 'success', 'Authenticator app removed. Email codes will be used at sign-in.');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
module.exports.completeLogin = completeLogin;
module.exports.helpers = { hashEmailCode, verifyEmailCode, generateEmailCode, maskEmail };
