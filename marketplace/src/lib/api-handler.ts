import { NextApiRequest, NextApiResponse } from 'next';
import { createRequestContext, logRequestEnd } from './request-context';
import { rateLimit } from './rate-limit';
import { logger } from './logger';

export interface ApiHandlerOptions {
  rateLimit?: { maxRequests: number; windowMs: number };
  requireAuth?: boolean;
  allowedMethods?: string[];
}

export function withApiHandler<T>(
  handler: (req: NextApiRequest, res: NextApiResponse<T>, ctx: any) => Promise<void>,
  options: ApiHandlerOptions = {}
) {
  return async (req: NextApiRequest, res: NextApiResponse<T>) => {
    const start = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress || '';
    const ctx = createRequestContext(req.url || '', req.method || 'GET', ip);

    // Add security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Check method
    if (options.allowedMethods && !options.allowedMethods.includes(req.method || '')) {
      return res.status(405).json({ error: 'Method not allowed' } as any);
    }

    // Rate limiting
    if (options.rateLimit) {
      const rateLimitKey = `${ip}:${req.url}`;
      if (!rateLimit(rateLimitKey, options.rateLimit.maxRequests, options.rateLimit.windowMs)) {
        return res.status(429).json({ error: 'Too many requests' } as any);
      }
    }

    try {
      await handler(req, res, ctx);
      const duration = Date.now() - start;
      logRequestEnd(ctx.requestId, res.statusCode, duration);
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('API handler error', error as Error, {
        requestId: ctx.requestId,
        path: ctx.path,
        method: ctx.method,
      });
      logRequestEnd(ctx.requestId, 500, duration);
      return res.status(500).json({ error: 'Internal server error' } as any);
    }
  };
}

export function handleError(res: NextApiResponse, error: unknown, statusCode: number = 500) {
  if (error instanceof Error) {
    logger.error('Error response', error);
    return res.status(statusCode).json({ error: error.message });
  }
  logger.error('Unknown error response', new Error(String(error)));
  return res.status(statusCode).json({ error: 'An error occurred' });
}
