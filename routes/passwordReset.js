const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { createEmailService } = require('../services/emailService');
const { createPasswordResetService } = require('../services/passwordResetService');
const { createPasswordResetRepositories } = require('../services/passwordResetRepositories');
const { createMemoryRateLimiter } = require('../middleware/rateLimit');

const GENERIC_CONFIRMATION = 'If an eligible account exists, a 6-digit code has been sent.';

function createDefaultPasswordResetService() {
  const hashSecret = process.env.OTP_HASH_SECRET || process.env.SESSION_SECRET;
  if (!hashSecret) throw new Error('OTP_HASH_SECRET or SESSION_SECRET must be configured');

  const { userRepository, resetRepository } = createPasswordResetRepositories({
    User,
    PasswordReset,
    mongoose,
  });
  const emailService = createEmailService();

  return createPasswordResetService({
    userRepository,
    resetRepository,
    sendOtpEmail: emailService.sendPasswordResetOtp,
    hashSecret,
  });
}

function createDefaultRateLimiters() {
  const redirectOnLimit = (path) => (req, res, retryAfterSeconds) => {
    req.flash('error', `Too many requests. Please try again in ${retryAfterSeconds} seconds.`);
    res.redirect(path);
  };

  return {
    forgot: createMemoryRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => `${req.ip}:${String(req.body.email || '').trim().toLowerCase()}`,
      onLimit: redirectOnLimit('/forgot-password'),
    }),
    verify: createMemoryRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 10,
      keyGenerator: (req) => req.ip,
      onLimit: redirectOnLimit('/verify-otp'),
    }),
    resend: createMemoryRateLimiter({
      windowMs: 60 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip,
      onLimit: redirectOnLimit('/verify-otp'),
    }),
    reset: createMemoryRateLimiter({
      windowMs: 15 * 60 * 1000,
      max: 5,
      keyGenerator: (req) => req.ip,
      onLimit: redirectOnLimit('/reset-password'),
    }),
  };
}

function createPasswordResetRouter({ service, rateLimiters } = {}) {
  const router = express.Router();
  const resetService = service || createDefaultPasswordResetService();
  const limits = rateLimiters || createDefaultRateLimiters();

  router.get('/forgot-password', (req, res) => {
    res.render('forgot-password', {
      error: req.flash('error'),
      success: req.flash('success'),
    });
  });

  router.post('/forgot-password', limits.forgot, async (req, res) => {
    let result = { requestId: null };
    try {
      result = await resetService.requestOtp(req.body.email);
    } catch (error) {
      // Do not reveal whether the account exists or whether delivery failed.
      console.error('Password reset request failed:', error.code || error.message);
    }

    req.session.passwordReset = {
      requestId: result.requestId || null,
      resendAvailableAt: Date.now() + 60 * 1000,
      resendCount: 0,
    };
    req.flash('success', GENERIC_CONFIRMATION);
    res.redirect('/verify-otp');
  });

  router.get('/verify-otp', (req, res) => {
    if (!req.session.passwordReset) return res.redirect('/forgot-password');
    return res.render('verify-otp', {
      error: req.flash('error'),
      success: req.flash('success'),
      resendAvailableAt: req.session.passwordReset.resendAvailableAt,
    });
  });

  router.post('/verify-otp', limits.verify, async (req, res) => {
    const context = req.session.passwordReset;
    if (!context) return res.redirect('/forgot-password');

    const otp = String(req.body.otp || '').trim();
    if (!/^\d{6}$/.test(otp)) {
      req.flash('error', 'Enter the complete 6-digit verification code.');
      return res.redirect('/verify-otp');
    }

    const result = await resetService.verifyOtp(context.requestId, otp);
    if (result.ok) {
      req.session.resetAuthorization = {
        requestId: context.requestId,
        resetToken: result.resetToken,
      };
      delete req.session.passwordReset;
      return res.redirect('/reset-password');
    }

    const messages = {
      expired: 'That code has expired. Request a new code.',
      locked: 'Too many incorrect attempts. Request a new code.',
      already_used: 'That code has already been used. Request a new code.',
      invalid: result.attemptsRemaining === undefined
        ? 'The verification code is invalid.'
        : `The verification code is incorrect. ${result.attemptsRemaining} attempts remaining.`,
    };
    req.flash('error', messages[result.code] || messages.invalid);
    return res.redirect('/verify-otp');
  });

  router.post('/resend-otp', limits.resend, async (req, res) => {
    const context = req.session.passwordReset;
    if (!context) return res.redirect('/forgot-password');

    const now = Date.now();
    if (context.resendAvailableAt > now) {
      const seconds = Math.ceil((context.resendAvailableAt - now) / 1000);
      req.flash('error', `Please wait ${seconds} seconds before requesting another code.`);
      return res.redirect('/verify-otp');
    }
    if (context.resendCount >= 3) {
      req.flash('error', 'The resend limit has been reached. Start a new password reset request.');
      return res.redirect('/verify-otp');
    }

    let result = { ok: true };
    try {
      if (context.requestId) result = await resetService.resendOtp(context.requestId);
    } catch (error) {
      console.error('Password reset resend failed:', error.code || error.message);
      result = { ok: true };
    }

    if (!result.ok) {
      if (result.code === 'cooldown') {
        req.flash('error', `Please wait ${result.retryAfterSeconds} seconds before requesting another code.`);
      } else if (result.code === 'resend_limit') {
        req.flash('error', 'The resend limit has been reached. Start a new password reset request.');
      } else {
        req.flash('error', 'This reset request is no longer valid. Start a new request.');
      }
      return res.redirect('/verify-otp');
    }

    context.resendCount += 1;
    context.resendAvailableAt = now + 60 * 1000;
    req.flash('success', GENERIC_CONFIRMATION);
    return res.redirect('/verify-otp');
  });

  router.get('/reset-password', async (req, res) => {
    const auth = req.session.resetAuthorization;
    if (!auth || !(await resetService.isResetAuthorized(auth.requestId, auth.resetToken))) {
      delete req.session.resetAuthorization;
      req.flash('error', 'Your reset authorization has expired. Start again.');
      return res.redirect('/forgot-password');
    }

    return res.render('reset-password', {
      error: req.flash('error'),
      success: req.flash('success'),
    });
  });

  router.post('/reset-password', limits.reset, async (req, res, next) => {
    const auth = req.session.resetAuthorization;
    if (!auth) return res.redirect('/forgot-password');

    const { password, confirmPassword } = req.body;
    const strengthError = resetService.validatePasswordStrength(password);
    if (strengthError) {
      req.flash('error', strengthError);
      return res.redirect('/reset-password');
    }
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/reset-password');
    }

    const result = await resetService.resetPassword(auth.requestId, auth.resetToken, password);
    if (!result.ok) {
      delete req.session.resetAuthorization;
      req.flash('error', 'Your reset authorization is invalid or expired. Start again.');
      return res.redirect('/forgot-password');
    }

    return req.session.regenerate((error) => {
      if (error) return next(error);
      req.flash('success', 'Your password has been reset. You can now sign in.');
      return req.session.save((saveError) => {
        if (saveError) return next(saveError);
        return res.redirect('/login');
      });
    });
  });

  return router;
}

module.exports = {
  createPasswordResetRouter,
  createDefaultPasswordResetService,
  GENERIC_CONFIRMATION,
};
