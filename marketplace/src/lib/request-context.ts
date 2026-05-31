import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

export interface RequestContext {
  requestId: string;
  userId?: string;
  timestamp: number;
  path: string;
  method: string;
  ip: string;
}

const contextMap = new Map<string, RequestContext>();

export function createRequestContext(
  path: string,
  method: string,
  ip: string,
  userId?: string
): RequestContext {
  const context: RequestContext = {
    requestId: uuidv4(),
    userId,
    timestamp: Date.now(),
    path,
    method,
    ip,
  };
  contextMap.set(context.requestId, context);
  logger.debug('Request start', { requestId: context.requestId, path, method, ip });
  return context;
}

export function getRequestContext(requestId: string): RequestContext | undefined {
  return contextMap.get(requestId);
}

export function logRequestEnd(
  requestId: string,
  statusCode: number,
  duration: number
): void {
  const context = contextMap.get(requestId);
  if (context) {
    logger.info('Request complete', {
      requestId,
      statusCode,
      duration,
      path: context.path,
      method: context.method,
      userId: context.userId,
    });
    contextMap.delete(requestId);
  }
}

// Cleanup old contexts every hour
setInterval(() => {
  const now = Date.now();
  for (const [id, ctx] of contextMap.entries()) {
    if (now - ctx.timestamp > 60 * 60 * 1000) {
      contextMap.delete(id);
    }
  }
}, 60 * 60 * 1000);
