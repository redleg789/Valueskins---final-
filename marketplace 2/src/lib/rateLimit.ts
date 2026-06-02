import { prisma } from '@/lib/prisma';

interface RateLimitConfig {
  windowMs: number; // milliseconds
  maxAttempts: number;
}

const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  login: { windowMs: 60 * 60 * 1000, maxAttempts: 20 }, // 20 attempts per hour
  signup: { windowMs: 60 * 60 * 1000, maxAttempts: 10 }, // 10 accounts per hour
  passwordReset: { windowMs: 60 * 60 * 1000, maxAttempts: 5 }, // 5 reset requests per hour
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
}

export async function checkRateLimit(
  identifier: string,
  action: string,
  config?: RateLimitConfig
): Promise<RateLimitResult> {
  const cfg = config || RATE_LIMIT_CONFIGS[action] || { windowMs: 60 * 60 * 1000, maxAttempts: 10 };

  const now = new Date();
  const windowStart = new Date(now.getTime() - cfg.windowMs);

  // Get or create rate limit record
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
    // Create new log
    rateLimitLog = await prisma.rateLimitLog.create({
      data: {
        identifier,
        action,
        windowStart,
        attemptCount: 1,
      },
    });
  } else {
    // Increment attempt count
    rateLimitLog = await prisma.rateLimitLog.update({
      where: { id: rateLimitLog.id },
      data: {
        attemptCount: { increment: 1 },
        lastAttemptAt: now,
      },
    });
  }

  const allowed = rateLimitLog.attemptCount <= cfg.maxAttempts;
  const remaining = Math.max(0, cfg.maxAttempts - rateLimitLog.attemptCount);

  // Calculate reset time
  const resetTime = new Date(rateLimitLog.windowStart.getTime() + cfg.windowMs);

  // Clean old logs
  await cleanupOldRateLimits();

  return { allowed, remaining, resetTime };
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
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

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
