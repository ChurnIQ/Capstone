function createMemoryRateLimiter({ windowMs, max, keyGenerator, onLimit }) {
  const buckets = new Map();

  const middleware = (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      return onLimit(req, res, retryAfterSeconds);
    }

    return next();
  };

  middleware.reset = () => buckets.clear();
  return middleware;
}

module.exports = { createMemoryRateLimiter };
