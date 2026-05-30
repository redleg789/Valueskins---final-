import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';

const TOKEN_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createPasswordResetToken(
  userId: string,
  ipAddress?: string
): Promise<{ token: string; expiresAt: Date }> {
  // Delete any existing unused tokens for this user
  await prisma.passwordResetToken.deleteMany({
    where: {
      userId,
      isUsed: false,
    },
  });

  const token = generateResetToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prisma.passwordResetToken.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
      ipAddress,
    },
  });

  return { token, expiresAt };
}

export async function verifyResetToken(userId: string, token: string): Promise<boolean> {
  const hashedToken = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId,
      token: hashedToken,
      isUsed: false,
    },
  });

  if (!resetToken) {
    return false;
  }

  const now = new Date();
  if (resetToken.expiresAt < now) {
    // Token expired
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });
    return false;
  }

  return true;
}

export async function resetPassword(
  userId: string,
  token: string,
  newPassword: string,
  ipAddress?: string
): Promise<{ success: boolean; error?: string }> {
  const hashedToken = hashToken(token);

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId,
      token: hashedToken,
      isUsed: false,
    },
  });

  if (!resetToken) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  const now = new Date();
  if (resetToken.expiresAt < now) {
    // Token expired
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    });
    return { success: false, error: 'Reset token has expired' };
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and mark token as used
  await Promise.all([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: {
        isUsed: true,
        usedAt: now,
        ipAddress,
      },
    }),
  ]);

  // Invalidate all sessions
  await prisma.session.deleteMany({
    where: { userId },
  });

  return { success: true };
}

export async function getResetTokenStatus(userId: string): Promise<{ expiresAt?: Date; createdAt?: Date }> {
  const token = await prisma.passwordResetToken.findFirst({
    where: {
      userId,
      isUsed: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    expiresAt: token?.expiresAt,
    createdAt: token?.createdAt,
  };
}
