// Server-side session management for HTTP APIs
// Client-side uses localStorage for guest sessions
// Production: replace SESSION_STORE with Redis

import { createHash, randomBytes, timingSafeEqual } from 'crypto';

const SESSION_EXPIRY = 30 * 60 * 1000;
const IDLE_TIMEOUT = 15 * 60 * 1000;

interface SessionData {
  userId: string;
  userType: 'creator' | 'brand' | 'guest';
  createdAt: number;
  lastActiveAt: number;
  csrfToken: string;
}

const SESSION_STORE = new Map<string, SessionData>();

function hashSessionId(sessionId: string): string {
  return createHash('sha256')
    .update(sessionId + (process.env.SESSION_SECRET || 'default-secret'))
    .digest('hex');
}

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

export async function createSession(
  userId: string,
  userType: 'creator' | 'brand' | 'guest'
): Promise<{ sessionId: string; csrfToken: string }> {
  const sessionId = generateSessionId();
  const csrfToken = generateCsrfToken();
  const now = Date.now();

  const sessionData: SessionData = {
    userId,
    userType,
    createdAt: now,
    lastActiveAt: now,
    csrfToken,
  };

  const hashedId = hashSessionId(sessionId);
  SESSION_STORE.set(hashedId, sessionData);

  setTimeout(() => {
    SESSION_STORE.delete(hashedId);
  }, SESSION_EXPIRY);

  return { sessionId, csrfToken };
}

export function getSession(sessionId: string): {
  userId: string;
  userType: 'creator' | 'brand' | 'guest';
} | null {
  const hashedId = hashSessionId(sessionId);
  const sessionData = SESSION_STORE.get(hashedId);

  if (!sessionData) return null;

  const now = Date.now();
  if (now > sessionData.createdAt + SESSION_EXPIRY) {
    SESSION_STORE.delete(hashedId);
    return null;
  }
  if (now > sessionData.lastActiveAt + IDLE_TIMEOUT) {
    SESSION_STORE.delete(hashedId);
    return null;
  }

  return {
    userId: sessionData.userId,
    userType: sessionData.userType,
  };
}

export function refreshSession(sessionId: string): boolean {
  const hashedId = hashSessionId(sessionId);
  const sessionData = SESSION_STORE.get(hashedId);

  if (!sessionData) return false;

  sessionData.lastActiveAt = Date.now();
  sessionData.csrfToken = generateCsrfToken();
  SESSION_STORE.set(hashedId, sessionData);

  return true;
}

export function destroySession(sessionId: string): void {
  SESSION_STORE.delete(hashSessionId(sessionId));
}

export function validateCsrfToken(sessionId: string, token: string): boolean {
  const hashedId = hashSessionId(sessionId);
  const sessionData = SESSION_STORE.get(hashedId);
  if (!sessionData) return false;
  return timingSafeCompare(sessionData.csrfToken, token);
}