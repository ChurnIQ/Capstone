/**
 * routes/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * REST API endpoints that power the ChurnIQ dashboard.
 * All routes are prefixed with /api (mounted in app.js).
 * All responses are JSON.
 *
 * Endpoints:
 *   GET  /api/stats                          – Overview KPI cards
 *   GET  /api/predictions                    – Paginated prediction history
 *   GET  /api/predictions/:id                – Single prediction detail
 *   POST /api/predict                        – Run prediction on one customer
 *   POST /api/upload                         – Bulk predict via CSV upload
 *   GET  /api/analytics/churn-trend          – Monthly churn vs retained (6 months)
 *   GET  /api/analytics/risk-segments        – Risk category breakdown
 *   GET  /api/analytics/feature-importance   – Feature weight rankings
 *   GET  /api/models/comparison              – Model evaluation metrics
 *   GET  /api/me                             – Logged-in user info
 *   GET  /api/batch-stats                    – Aggregate batch prediction stats
 */

const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const csv        = require('csv-parser');
const fs         = require('fs');
const path       = require('path');
const http       = require('http');
const Customer   = require('../models/Customer');
const Prediction = require('../models/Prediction');

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000';


// ── Auth guard ────────────────────────────────────────────────────────────────
const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
};
router.use(ensureAuth);


// ── Multer – CSV uploads stored temporarily ───────────────────────────────────
const upload = multer({
  dest: 'uploads/tmp/',
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      return cb(new Error('Only CSV files are allowed'), false);
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});


// ─────────────────────────────────────────────────────────────────────────────
// ML PREDICTION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Call the Flask ML API with a 5 s timeout. Falls back to rule-based model. */
async function runPrediction(features) {
  try {
    const body = JSON.stringify(features);
    const result = await new Promise((resolve, reject) => {
      const url  = new URL('/predict', ML_API_URL);
      const opts = {
        hostname: url.hostname,
        port:     url.port || 5000,
        path:     url.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout:  5000,
      };
      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON from ML API')); }
        });
      });
      req.on('error',   reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('ML API timeout')); });
      req.write(body);
      req.end();
    });

    if (result.error) throw new Error(result.error);
    return result;

  } catch (err) {
    console.warn(`[ML API unavailable — using fallback] ${err.message}`);
    return runFallbackPrediction(features);
  }
}

/** Rule-based fallback used when the Flask API is unreachable. */
function runFallbackPrediction(features) {
  const {
    customer_support_calls = 0,
    maximum_days_inactive  = 0,
    weekly_mins_watched    = 120,
    no_of_days_subscribed  = 180,
    videos_watched         = 30,
  } = features;

  let score = 0;
  score += customer_support_calls * 0.31;
  score += maximum_days_inactive  * 0.024;
  score -= weekly_mins_watched    * 0.003;
  score -= no_of_days_subscribed  * 0.001;
  score -= videos_watched         * 0.005;
  score += 0.15;

  const churn_probability = Math.min(0.98, Math.max(0.02, parseFloat(score.toFixed(4))));
  const risk = churn_probability >= 0.70 ? 'High' : churn_probability >= 0.40 ? 'Medium' : 'Low';
  const strategyMap = {
    High:   'Personal retention call + exclusive loyalty discount within 24h',
    Medium: 'Targeted email campaign + feature highlight nudge',
    Low:    'Routine check-in + monthly newsletter engagement',
  };
  return {
    churn_probability,
    churn_prediction:       churn_probability >= 0.5 ? 1 : 0,
    risk_category:          risk,
    churn_reasons:          [],
    recommended_strategies: [strategyMap[risk]],
    recommended_strategy:   strategyMap[risk],
  };
}

// Backfill for older records that only have risk_category but no strategies
const FALLBACK_STRATEGIES = {
  High:   ['Personal retention call + exclusive loyalty discount within 24h'],
  Medium: ['Targeted email campaign + feature highlight nudge'],
  Low:    ['Routine check-in + monthly newsletter engagement'],
};


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, high, churn] = await Promise.all([
      Prediction.countDocuments(),
      Prediction.countDocuments({ risk_category: 'High' }),
      Prediction.countDocuments({ churn_prediction: 1 }),
    ]);

    // Month-over-month churn delta
    const now            = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [thisMonthChurn, lastMonthChurn] = await Promise.all([
      Prediction.countDocuments({ churn_prediction: 1, createdAt: { $gte: startThisMonth } }),
      Prediction.countDocuments({ churn_prediction: 1, createdAt: { $gte: startLastMonth, $lt: startThisMonth } }),
    ]);

    const churnDelta = lastMonthChurn > 0
      ? (((thisMonthChurn - lastMonthChurn) / lastMonthChurn) * 100).toFixed(1)
      : null;

    res.json({
      totalCustomers:   total,
      totalPredictions: total,
      highRiskCount:    high,
      churnedCount:     churn,
      churnRate:        total ? ((churn / total) * 100).toFixed(1) : 0,
      churnDelta,
      modelAccuracy:    91.0,
      modelName:        'Random Forest',
    });

  } catch (err) {
    console.error('GET /api/stats error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/predictions?page=1&limit=10&risk=High&search=
// ─────────────────────────────────────────────────────────────────────────────
router.get('/predictions', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.risk)  filter.risk_category   = req.query.risk;
    if (req.query.churn) filter.churn_prediction = parseInt(req.query.churn);
    if (req.query.search) {
      filter.$or = [
        { customer_id:   { $regex: req.query.search, $options: 'i' } },
        { customer_name: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Prediction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Prediction.countDocuments(filter),
    ]);

    // Backfill recommended_strategies for older records that lack it
    const predictions = data.map(p => {
      if (!p.recommended_strategies || p.recommended_strategies.length === 0) {
        p.recommended_strategies = FALLBACK_STRATEGIES[p.risk_category] || FALLBACK_STRATEGIES.Low;
      }
      return p;
    });

    res.json({
      predictions,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });

  } catch (err) {
    console.error('GET /api/predictions error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/predictions/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/predictions/:id', async (req, res) => {
  try {
    const p = await Prediction.findById(req.params.id).lean();
    if (!p) return res.status(404).json({ error: 'Prediction not found' });
    res.json(p);
  } catch {
    res.status(500).json({ error: 'Error fetching prediction' });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/predict
// Body: { customer_id, customer_name?, ...feature fields }
// ─────────────────────────────────────────────────────────────────────────────
router.post('/predict', async (req, res) => {
  try {
    const data = req.body;

    if (!data.customer_id) {
      return res.status(400).json({ error: 'customer_id is required' });
    }

    // Upsert customer record
    await Customer.findOneAndUpdate(
      { customer_id: data.customer_id },
      { ...data },
      { upsert: true, new: true }
    );

    const result = await runPrediction(data);

    const record = await Prediction.create({
      customer_id:            data.customer_id,
      customer_name:          data.customer_name || 'Unknown',
      churn_prediction:       result.churn_prediction,
      churn_probability:      result.churn_probability,
      risk_category:          result.risk_category,
      churn_reasons:          result.churn_reasons          || [],
      recommended_strategies: result.recommended_strategies || [],
    });

    res.json({ ...record.toObject(), recommended_strategies: result.recommended_strategies });

  } catch (err) {
    console.error('POST /api/predict error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/risk-segments
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/risk-segments', async (req, res) => {
  try {
    const raw = await Prediction.aggregate([
      { $match: { risk_category: { $in: ['High', 'Medium', 'Low'] } } },
      { $group: { _id: '$risk_category', count: { $sum: 1 } } },
    ]);

    const total = raw.reduce((a, b) => a + b.count, 0);
    const map   = { High: 0, Medium: 0, Low: 0 };
    raw.forEach(r => { map[r._id] = r.count; });

    res.json([
      { name: 'High',   value: total ? Math.round(map.High   / total * 100) : 0, color: '#e74c3c' },
      { name: 'Medium', value: total ? Math.round(map.Medium / total * 100) : 0, color: '#f39c12' },
      { name: 'Low',    value: total ? Math.round(map.Low    / total * 100) : 0, color: '#27ae60' },
    ]);

  } catch (err) {
    console.error('GET /api/analytics/risk-segments error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/feature-importance
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/feature-importance', (req, res) => {
  // Values from the trained Random Forest model's .feature_importances_
  res.json([
    { feature: 'customer_support_calls', importance: 0.31 },
    { feature: 'maximum_days_inactive',  importance: 0.24 },
    { feature: 'weekly_mins_watched',    importance: 0.18 },
    { feature: 'no_of_days_subscribed',  importance: 0.13 },
    { feature: 'videos_watched',         importance: 0.09 },
    { feature: 'mail_subscribed',        importance: 0.05 },
  ]);
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/churn-trend
// ─────────────────────────────────────────────────────────────────────────────
router.get('/analytics/churn-trend', async (req, res) => {
  try {
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now    = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const raw = await Prediction.aggregate([
      { $match: { createdAt: { $gte: cutoff } } },
      { $group: {
          _id:   { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
          churn: { $sum: '$churn_prediction' },
          total: { $sum: 1 },
      }},
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Pad all 6 months even if some have no data
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yr  = d.getFullYear();
      const mo  = d.getMonth() + 1;
      const row = raw.find(r => r._id.year === yr && r._id.month === mo);
      result.push({
        name:     MONTH_NAMES[mo - 1],
        churn:    row ? row.churn            : 0,
        retained: row ? row.total - row.churn : 0,
      });
    }

    res.json(result);

  } catch (err) {
    console.error('GET /api/analytics/churn-trend error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/models/comparison
// ─────────────────────────────────────────────────────────────────────────────
router.get('/models/comparison', async (req, res) => {
  // Try to get live model name from Flask; fall back to 'Random Forest'
  let modelName = 'Random Forest';
  try {
    const info = await new Promise((resolve, reject) => {
      const url = new URL('/model-info', ML_API_URL);
      const r = http.request(
        { hostname: url.hostname, port: url.port || 5000, path: url.pathname, method: 'GET', timeout: 3000 },
        (resp) => { let d = ''; resp.on('data', c => { d += c; }); resp.on('end', () => resolve(JSON.parse(d))); }
      );
      r.on('error', reject);
      r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
      r.end();
    });
    if (info.model_name) modelName = info.model_name.replace(/([A-Z])/g, ' $1').trim();
  } catch (_) {}

  // Metrics from training.ipynb (weighted avg, test set of 400 rows, random_state=42)
  res.json([
    { model: modelName,           accuracy: 91.0, precision: 91.0, recall: 91.0, f1: 91.0, selected: true  },
    { model: 'Gradient Boosting', accuracy: 89.8, precision: 89.0, recall: 90.0, f1: 89.0, selected: false },
    { model: 'XGBoost',           accuracy: 89.5, precision: 89.0, recall: 90.0, f1: 89.0, selected: false },
    { model: 'KNN',               accuracy: 88.0, precision: 85.0, recall: 88.0, f1: 86.0, selected: false },
    { model: 'Decision Tree',     accuracy: 87.8, precision: 87.0, recall: 88.0, f1: 87.0, selected: false },
    { model: 'Logistic Reg.',     accuracy: 87.0, precision: 83.0, recall: 87.0, f1: 84.0, selected: false },
  ]);
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/me
// ─────────────────────────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  res.json({ name: req.user.name, email: req.user.email, avatar: req.user.avatar || null });
});


// ─────────────────────────────────────────────────────────────────────────────
// POST /api/upload  — Bulk CSV prediction
// ─────────────────────────────────────────────────────────────────────────────
router.post('/upload', upload.single('dataset'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  const filePath = req.file.path;
  const rows     = [];
  const errors   = [];

  try {
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', row => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    if (rows.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Required columns validation
    const required = ['customer_id', 'weekly_mins_watched', 'customer_support_calls', 'maximum_days_inactive'];
    const missing  = required.filter(f => !(f in rows[0]));
    if (missing.length > 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: `Missing required columns: ${missing.join(', ')}` });
    }

    const saved = [];
    const CHUNK_SIZE = 100;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      for (const row of chunk) {
        try {
          const customer_id = row.customer_id?.trim();
          if (!customer_id) { errors.push({ row, reason: 'Missing customer_id' }); continue; }

          // Upsert customer
          await Customer.findOneAndUpdate({ customer_id }, { ...row }, { upsert: true, new: true });

          const result = await runPrediction(row);
          const record = await Prediction.create({
            customer_id,
            customer_name:          row.customer_name || row.name || 'Unknown',
            churn_prediction:       result.churn_prediction,
            churn_probability:      result.churn_probability,
            risk_category:          result.risk_category,
            churn_reasons:          result.churn_reasons          || [],
            recommended_strategies: result.recommended_strategies || [],
          });
          saved.push(record);
        } catch (e) {
          errors.push({ row, reason: e.message });
        }
      }
    }

    fs.unlink(filePath, () => {});
    res.json({
      message:      `Processed ${rows.length} rows`,
      saved:         saved.length,
      errors:        errors.length,
      errorDetails:  errors.slice(0, 10),
    });

  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    console.error('POST /api/upload error:', err);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// GET /api/batch-stats
// ─────────────────────────────────────────────────────────────────────────────
router.get('/batch-stats', async (req, res) => {
  try {
    const [total, high, churn] = await Promise.all([
      Prediction.countDocuments(),
      Prediction.countDocuments({ risk_category: 'High' }),
      Prediction.countDocuments({ churn_prediction: 1 }),
    ]);
    res.json({
      totalProcessed: total,
      highRiskCount:  high,
      avgChurnRate:   total ? ((churn / total) * 100).toFixed(1) : 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


module.exports = router;
