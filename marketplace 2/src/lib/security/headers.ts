import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SECURITY_HEADERS = {
  'X-DNS-Prefetch-Control': 'on',
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires this
    "style-src 'self' 'unsafe-inline'", // Next.js requires this  
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

const BLOCKED_IP_PATTERNS = [
  /\b(?:192\.168|10\.|172\.(?:16|17|18|19|20|21|22|23|24|25|26|27|28|29|30|31))\./,
  /\b127\.\d+\.\d+\.\d+/,
  /\b(?:localhost|::1)/i,
];

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

function isInternalIP(ip: string): boolean {
  return BLOCKED_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  record.count++;
  return { allowed: true };
}

function sanitizeHeader(value: string | null): string | null {
  if (!value) return null;
  return value.replace(/[<>'"&]/g, '');
}

export function securityMiddleware(request: NextRequest) {
  const ip = getClientIP(request);
  
  if (isInternalIP(ip) && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Forbidden' },
      { status: 403 }
    );
  }
  
  const rateLimitResult = checkRateLimit(ip);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimitResult.retryAfter),
          'X-RateLimit-Reset': String(Math.ceil((Date.now() + RATE_LIMIT_WINDOW) / 1000)),
        },
      }
    );
  }
  
  const response = NextResponse.next();
  
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  response.headers.set('X-Request-ID', crypto.randomUUID());
  response.headers.set('X-RateLimit-Limit', String(RATE_LIMIT_MAX));
  response.headers.set('X-RateLimit-Remaining', String(RATE_LIMIT_MAX - (requestCounts.get(ip)?.count || 0)));
  
  return response;
}

export function withSecurityHeaders<T>(handler: T): T {
  if (typeof handler === 'function') {
    const originalHandler = handler as (...args: unknown[]) => unknown;
    return ((...args: unknown[]) => {
      const response = originalHandler(...args) as Response;
      if (response instanceof Response) {
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      return response;
    }) as T;
  }
  return handler;
}

export { getClientIP, checkRateLimit };