/**
 * Token-bucket rate limiter (client-side).
 * Each "bucket" refills maxTokens every windowMs milliseconds.
 */
class RateLimiter {
  constructor() {
    this._buckets = new Map();
  }

  /** Returns { allowed: true } or { allowed: false, waitSeconds: N } */
  check(key, maxTokens = 5, windowMs = 60_000) {
    const now = Date.now();

    if (!this._buckets.has(key)) {
      this._buckets.set(key, { tokens: maxTokens - 1, lastRefill: now });
      return { allowed: true, remaining: maxTokens - 1 };
    }

    const bucket = this._buckets.get(key);
    const elapsed = now - bucket.lastRefill;

    // Full window passed → full refill
    if (elapsed >= windowMs) {
      bucket.tokens = maxTokens - 1;
      bucket.lastRefill = now;
      return { allowed: true, remaining: bucket.tokens };
    }

    if (bucket.tokens <= 0) {
      const waitSeconds = Math.ceil((windowMs - elapsed) / 1000);
      return { allowed: false, waitSeconds };
    }

    bucket.tokens -= 1;
    return { allowed: true, remaining: bucket.tokens };
  }

  reset(key) {
    this._buckets.delete(key);
  }
}

const limiter = new RateLimiter();

// Pre-configured limiters — import these directly in components
export const loginLimiter      = { check: (id) => limiter.check(`login:${id}`,      5,  60_000) };
export const taskLimiter       = { check: (id) => limiter.check(`task:${id}`,       10, 60_000) };
export const meetingLimiter    = { check: (id) => limiter.check(`meeting:${id}`,    5,  60_000) };
export const credentialLimiter = { check: (id) => limiter.check(`credential:${id}`, 3,  60_000) };
