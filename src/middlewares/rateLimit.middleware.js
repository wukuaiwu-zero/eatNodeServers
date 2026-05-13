function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const message = options.message || 'too many requests';
  const buckets = new Map();

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = `${options.keyPrefix || req.path}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return next();
    }

    bucket.count += 1;

    if (bucket.count > max) {
      return res.status(429).json({ message });
    }

    return next();
  };
}

module.exports = {
  createRateLimiter
};
