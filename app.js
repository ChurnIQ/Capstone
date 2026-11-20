
require('dotenv').config();
const fs      = require('fs');
const path    = require('path');
const express = require('express');
const mongoose = require('mongoose');
const session  = require('express-session');
const MongoStore = require('connect-mongo').default;
const flash    = require('express-flash');
const passport = require('passport');

const authRoutes = require('./routes/auth');
require('./models/Customer');
require('./models/Prediction');
const apiRoutes  = require('./routes/api');   // ← ChurnIQ API routes

require('./config/passport');

// ── Environment validation ────────────────────────────────────────────────────
if (!process.env.SESSION_SECRET) {
  console.warn('⚠️  WARNING: SESSION_SECRET is not set. Using fallback secret — unsafe in production.');
}

// ── Ensure tmp upload dir exists ──────────────────────────────────────────────
const tmpDir = path.join(__dirname, 'uploads', 'tmp');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const app  = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/loginpage';

// Share Mongoose's MongoClient with the session store. This avoids opening a
// second Atlas connection that can fail independently during local startup.
const mongoConnection = mongoose.connect(MONGODB_URI);

// ── View engine ───────────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Session ───────────────────────────────────────────────────────────────────
const sessionStore = MongoStore.create({
  clientPromise: mongoConnection.then(() => mongoose.connection.getClient()),
  collectionName: 'sessions',
});

// Observe connect-mongo's derived initialization promise so transient Atlas
// failures are handled by the normal startup error path below.
sessionStore.collectionP.catch(() => {});

app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback-secret',
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));

// ── Passport ──────────────────────────────────────────────────────────────────
app.use(passport.initialize());
app.use(passport.session());
app.use(flash());

// ── Auth guard ────────────────────────────────────────────────────────────────
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.redirect('/login');
};

// ── Auth routes (login, register, logout, Google OAuth) ───────────────────────
app.use('/', authRoutes);

// ── ChurnIQ API routes (all protected inside routes/api.js) ───────────────────
app.use('/api', apiRoutes);

// ── Dashboard (protected EJS view) ───────────────────────────────────────────
app.get('/dashboard', ensureAuth, (req, res) => {
  res.render('dashboard', { user: req.user });
});

// ── Google OAuth ──────────────────────────────────────────────────────────────
if (passport.googleOAuthEnabled) {
  app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );
  app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login', failureFlash: true }),
    (req, res) => res.redirect('/dashboard')
  );
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Server is healthy and active',
    timestamp: new Date().toISOString() 
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path.startsWith('/api')) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
  res.status(500).send('Something went wrong. Please try again.');
});

// ── Connect to MongoDB & start ────────────────────────────────────────────────
mongoConnection
  .then(() => {
    console.log('✓ MongoDB connected');
    app.listen(PORT, () => {
      console.log(`✓ Server running at http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
// Add logging for debugging requests
// Integration: connected ML API with frontend dashboard
// Fix: minor bug fixes and stability improvements
