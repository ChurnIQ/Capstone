const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('../config/passport');
const User = require('../models/User');
const twoFactorRoutes = require('./twoFactor');
const { completeLogin } = twoFactorRoutes;

// ──── Middleware ────
function ensureGuest(req, res, next) {
  if (req.isAuthenticated()) return res.redirect('/dashboard');
  next();
}

function ensureAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
}

// ──── Pages ────
router.get('/', (req, res) => res.redirect('/login'));

router.get('/login', ensureGuest, (req, res) => {
  res.render('login', {
    error: req.flash('error'),
    success: req.flash('success'),
  });
});

router.get('/signup', ensureGuest, (req, res) => {
  res.render('signup', { error: req.flash('error') });
});

router.get('/dashboard', ensureAuth, (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.sendFile(path.join(__dirname, '..', 'client', 'dist', 'index.html'));
});

// ──── Local Auth ────
router.post('/login', ensureGuest, (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      req.flash('error', (info && info.message) || 'Login failed.');
      return res.redirect('/login');
    }
    completeLogin(req, res, next, user); // asks for a 2FA code if enabled
  })(req, res, next);
});

router.post('/signup', ensureGuest, async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    if (!name || !email || !password) {
      req.flash('error', 'Please fill in all fields.');
      return res.redirect('/signup');
    }
    if (password.length < 6) {
      req.flash('error', 'Password must be at least 6 characters.');
      return res.redirect('/signup');
    }
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match.');
      return res.redirect('/signup');
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      req.flash('error', 'Email already registered.');
      return res.redirect('/signup');
    }

    await User.create({ name, email, password });
    req.flash('success', 'Account created! Please log in.');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Something went wrong.');
    res.redirect('/signup');
  }
});

// ──── Google Auth ────
if (passport.googleOAuthEnabled) {
  router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  router.get('/auth/google/callback', (req, res, next) => {
    passport.authenticate('google', (err, user) => {
      if (err) return next(err);
      if (!user) {
        req.flash('error', 'Google sign-in failed. Please try again.');
        return res.redirect('/login');
      }
      completeLogin(req, res, next, user); // asks for a 2FA code if enabled
    })(req, res, next);
  });
} else {
  const googleAuthUnavailable = (req, res) => {
    req.flash('error', 'Google login is not configured. Please use email and password.');
    res.redirect('/login');
  };

  router.get('/auth/google', googleAuthUnavailable);
  router.get('/auth/google/callback', googleAuthUnavailable);
}

// ──── Logout ────
router.get('/logout', (req, res, next) => {
  req.logout(err => {
    if (err) return next(err);
    res.redirect('/login');
  });
});

router.use('/', twoFactorRoutes);

module.exports = router;
