import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function createEmailVerificationToken(
  userId: string,
  email: string
): Promise<{ token: string; expiresAt: Date }> {
  // Delete any existing unverified tokens
  await prisma.emailVerificationToken.deleteMany({
    where: {
      userId,
      isUsed: false,
    },
  });

  const token = generateVerificationToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

  await prisma.emailVerificationToken.create({
    data: {
      userId,
      email,
      token: hashedToken,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function verifyEmailToken(userId: string, token: string): Promise<boolean> {
  const hashedToken = hashToken(token);

  const verificationToken = await prisma.emailVerificationToken.findFirst({
    where: {
      userId,
      token: hashedToken,
      isUsed: false,
    },
  });

  if (!verificationToken) {
    return false;
  }

  const now = new Date();
  if (verificationToken.expiresAt < now) {
    // Token expired
    await prisma.emailVerificationToken.delete({
      where: { id: verificationToken.id },
    });
    return false;
  }

  // Mark as used
  await prisma.emailVerificationToken.update({
    where: { id: verificationToken.id },
    data: {
      isUsed: true,
      usedAt: now,
    },
  });

  // Update user
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: now,
    },
  });

  return true;
}

export async function getVerificationTokenStatus(
  userId: string
): Promise<{ verified: boolean; expiresAt?: Date; createdAt?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true, emailVerifiedAt: true },
  });

  if (!user) {
    return { verified: false };
  }

  if (user.emailVerified) {
    return { verified: true, createdAt: user.emailVerifiedAt || undefined };
  }

  const token = await prisma.emailVerificationToken.findFirst({
    where: {
      userId,
      isUsed: false,
    },
    orderBy: { createdAt: 'desc' },
  });

  return {
    verified: false,
    expiresAt: token?.expiresAt,
    createdAt: token?.createdAt,
  };
}
