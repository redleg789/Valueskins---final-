import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function rateLimiter(limit: number = 100, windowMs: number = 60000) {
  return (req: NextApiRequest, res: NextApiResponse, next: () => void) => {
    const key = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const keyStr = typeof key === 'string' ? key : key[0];
    const now = Date.now();

    let bucket = rateLimitStore.get(keyStr);
    if (!bucket || now > bucket.resetTime) {
      bucket = { count: 1, resetTime: now + windowMs };
      rateLimitStore.set(keyStr, bucket);
      next();
      return;
    }

    if (bucket.count >= limit) {
      res.status(429).json({ error: 'Too many requests' });
      return;
    }

    bucket.count += 1;
    next();
  };
}

export function securityHeaders(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  // HTTPS only
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Prevent MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'"
  );

  // Permissions Policy (formerly Feature Policy)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

export function corsMiddleware(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://valueskins-final.vercel.app',
  ];

  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
}

export function inputValidation(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  if (req.method === 'POST' || req.method === 'PUT') {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      res.status(400).json({ error: 'Content-Type must be application/json' });
      return;
    }

    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > 10 * 1024) {
      res.status(413).json({ error: 'Payload too large' });
      return;
    }
  }

  next();
}

export function sanitizeOutput(data: any): any {
  // Remove sensitive fields before sending to client
  if (typeof data !== 'object' || data === null) return data;

  const sanitized = { ...data };
  delete sanitized.password;
  delete sanitized.passwordHash;
  delete sanitized.salt;
  delete sanitized.privateKey;
  delete sanitized.secret;

  return sanitized;
}

export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  const [salt, storedHash] = hash.split(':');
  const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(storedHash));
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length < 255;
}

export function validateUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
}

export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
