import { prisma } from '@/lib/prisma';

const FAILED_ATTEMPTS_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LockoutStatus {
  isLocked: boolean;
  reason?: string;
  lockedUntil?: Date;
  failedAttempts?: number;
}

export async function checkAccountLockout(userId: string): Promise<LockoutStatus> {
  const lockout = await prisma.accountLockout.findUnique({
    where: { userId },
  });

  if (!lockout) {
    return { isLocked: false };
  }

  const now = new Date();
  if (lockout.lockedUntil < now) {
    // Lockout expired, remove it
    await prisma.accountLockout.delete({
      where: { userId },
    });
    return { isLocked: false };
  }

  return {
    isLocked: true,
    reason: lockout.reason,
    lockedUntil: lockout.lockedUntil,
    failedAttempts: lockout.failedAttempts,
  };
}

export async function recordFailedLogin(userId: string, email?: string): Promise<LockoutStatus> {
  // Log the failed attempt
  await prisma.loginAttempt.create({
    data: {
      email,
      success: false,
      failureReason: 'invalid_password',
    },
  });

  // Count failed attempts in last 15 minutes via rate limit log
  const fifteenMinutesAgo = new Date(Date.now() - LOCKOUT_DURATION_MS);
  const failedAttemptsCount = await prisma.rateLimitLog.count({
    where: {
      identifier: userId,
      action: 'login',
      lastAttemptAt: {
        gte: fifteenMinutesAgo,
      },
    },
  });

  if (failedAttemptsCount >= FAILED_ATTEMPTS_THRESHOLD) {
    // Lock the account
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);

    const lockout = await prisma.accountLockout.upsert({
      where: { userId },
      update: {
        lockedUntil,
        failedAttempts: failedAttemptsCount,
        reason: 'too_many_failed_attempts',
      },
      create: {
        userId,
        lockedUntil,
        failedAttempts: failedAttemptsCount,
        reason: 'too_many_failed_attempts',
      },
    });

    return {
      isLocked: true,
      reason: lockout.reason,
      lockedUntil: lockout.lockedUntil,
      failedAttempts: lockout.failedAttempts,
    };
  }

  return {
    isLocked: false,
    failedAttempts: failedAttemptsCount,
  };
}

export async function recordSuccessfulLogin(userId: string): Promise<void> {
  // Clear lockout if exists
  await prisma.accountLockout.deleteMany({
    where: { userId },
  });

  // Log successful attempt
  await prisma.loginAttempt.create({
    data: {
      success: true,
    },
  });
}

export async function unlockAccount(userId: string): Promise<void> {
  await prisma.accountLockout.deleteMany({
    where: { userId },
  });
}

export async function adminLockAccount(userId: string, reason: string = 'manual_admin_lock'): Promise<void> {
  const lockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await prisma.accountLockout.upsert({
    where: { userId },
    update: {
      lockedUntil,
      reason,
    },
    create: {
      userId,
      lockedUntil,
      reason,
    },
  });
}
