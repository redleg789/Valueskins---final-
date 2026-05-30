import { prisma } from '@/lib/prisma';

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { windowMs: 60 * 60 * 1000, maxAttempts: 20 },
  signup: { windowMs: 60 * 60 * 1000, maxAttempts: 10 },
  passwordReset: { windowMs: 60 * 60 * 1000, maxAttempts: 5 },
  resendVerification: { windowMs: 60 * 60 * 1000, maxAttempts: 5 },
  login_failed: { windowMs: 60 * 60 * 1000, maxAttempts: 20 },
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
}

async function applyRateLimit(
  identifier: string,
  action: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  let rateLimitLog = await prisma.rateLimitLog.findFirst({
    where: {
      identifier,
      action,
      windowStart: {
        gte: windowStart,
      },
    },
  });

  if (!rateLimitLog) {
    rateLimitLog = await prisma.rateLimitLog.create({
      data: {
        identifier,
        action,
        windowStart,
        attemptCount: 1,
      },
    });
  } else {
    rateLimitLog = await prisma.rateLimitLog.update({
      where: { id: rateLimitLog.id },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
      },
    });
  }

  const allowed = rateLimitLog.attemptCount <= config.maxAttempts;
  const remaining = Math.max(0, config.maxAttempts - rateLimitLog.attemptCount);
  const resetTime = new Date(rateLimitLog.windowStart.getTime() + config.windowMs);

  await cleanupOldRateLimits();

  return { allowed, remaining, resetTime };
}

export async function checkRateLimit(
  identifier: string,
  action: string,
  config?: RateLimitConfig
): Promise<RateLimitResult>;
export async function checkRateLimit(
  identifier: string,
  maxAttempts: number,
  windowSeconds: number
): Promise<boolean>;
export async function checkRateLimit(
  identifier: string,
  actionOrMaxAttempts: string | number,
  configOrWindowSeconds?: RateLimitConfig | number
): Promise<RateLimitResult | boolean> {
  if (typeof actionOrMaxAttempts === 'number') {
    const result = await applyRateLimit(identifier, 'login', {
      maxAttempts: actionOrMaxAttempts,
      windowMs: (typeof configOrWindowSeconds === 'number' ? configOrWindowSeconds : 3600) * 1000,
    });
    return result.allowed;
  }

  const config =
    typeof configOrWindowSeconds === 'object' && configOrWindowSeconds
      ? configOrWindowSeconds
      : RATE_LIMIT_CONFIGS[actionOrMaxAttempts] || { windowMs: 60 * 60 * 1000, maxAttempts: 10 };

  return applyRateLimit(identifier, actionOrMaxAttempts, config);
}

export async function recordFailedAttempt(identifier: string): Promise<void> {
  await applyRateLimit(identifier, 'login_failed', RATE_LIMIT_CONFIGS.login_failed);
}

export async function resetRateLimit(identifier: string, action: string): Promise<void> {
  await prisma.rateLimitLog.deleteMany({
    where: {
      identifier,
      action,
    },
  });
}

async function cleanupOldRateLimits(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

  await prisma.rateLimitLog.deleteMany({
    where: {
      lastAttemptAt: {
        lt: cutoff,
      },
    },
  });
}

export function getResetTimeString(resetTime: Date): string {
  const now = new Date();
  const diff = resetTime.getTime() - now.getTime();

  if (diff <= 0) return 'now';

  const minutes = Math.ceil(diff / (60 * 1000));
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''}`;

  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours > 1 ? 's' : ''}`;
}
