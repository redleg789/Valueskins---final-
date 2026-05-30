import { NextApiRequest, NextApiResponse } from 'next';

interface DDoSBucket {
  requests: number;
  firstRequest: number;
  blocked: boolean;
  blockUntil: number;
}

const ipBuckets = new Map<string, DDoSBucket>();
const patternDetection = new Map<string, number>();

const THRESHOLDS = {
  requestsPerSecond: 100,
  requestsPerMinute: 2000,
  connectionTimeoutSeconds: 30,
  blockDurationSeconds: 300,
  suspiciousPatternThreshold: 10,
};

export function extractClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

export function detectSuspiciousPattern(req: NextApiRequest, ip: string): boolean {
  const userAgent = req.headers['user-agent'] || '';
  const method = req.method || '';
  const path = req.url || '';

  const pattern = `${method}:${path}:${userAgent.substring(0, 50)}`;
  const count = (patternDetection.get(pattern) || 0) + 1;
  patternDetection.set(pattern, count);

  if (count > THRESHOLDS.suspiciousPatternThreshold) {
    return true;
  }

  setTimeout(() => {
    patternDetection.delete(pattern);
  }, 60000);

  return false;
}

export function checkDDoSProtection(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const ip = extractClientIP(req);
  const now = Date.now();

  let bucket = ipBuckets.get(ip);

  if (!bucket) {
    bucket = { requests: 1, firstRequest: now, blocked: false, blockUntil: 0 };
    ipBuckets.set(ip, bucket);
    next();
    return;
  }

  if (bucket.blocked && now < bucket.blockUntil) {
    res.status(429).json({
      error: 'Rate limited',
      retryAfter: Math.ceil((bucket.blockUntil - now) / 1000),
    });
    return;
  }

  if (bucket.blocked && now >= bucket.blockUntil) {
    bucket.blocked = false;
    bucket.requests = 0;
    bucket.firstRequest = now;
  }

  const timeSinceFirstRequest = now - bucket.firstRequest;

  if (timeSinceFirstRequest <= 1000) {
    if (bucket.requests > THRESHOLDS.requestsPerSecond) {
      bucket.blocked = true;
      bucket.blockUntil = now + THRESHOLDS.blockDurationSeconds * 1000;
      res.status(429).json({ error: 'Rate limited - too many requests per second' });
      return;
    }
  } else if (timeSinceFirstRequest <= 60000) {
    if (bucket.requests > THRESHOLDS.requestsPerMinute) {
      bucket.blocked = true;
      bucket.blockUntil = now + THRESHOLDS.blockDurationSeconds * 1000;
      res.status(429).json({ error: 'Rate limited - too many requests per minute' });
      return;
    }
  } else {
    bucket.requests = 0;
    bucket.firstRequest = now;
  }

  if (detectSuspiciousPattern(req, ip)) {
    bucket.blocked = true;
    bucket.blockUntil = now + THRESHOLDS.blockDurationSeconds * 1000;
    res.status(429).json({ error: 'Suspicious activity detected' });
    return;
  }

  bucket.requests += 1;

  res.setHeader('X-RateLimit-Limit', THRESHOLDS.requestsPerMinute.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, THRESHOLDS.requestsPerMinute - bucket.requests).toString());
  res.setHeader('X-RateLimit-Reset', (bucket.firstRequest + 60000).toString());

  next();
}

export function cleanupExpiredBuckets() {
  const now = Date.now();
  for (const [ip, bucket] of ipBuckets.entries()) {
    if (now - bucket.firstRequest > 300000) {
      ipBuckets.delete(ip);
    }
  }
}

setInterval(cleanupExpiredBuckets, 60000);
