import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const CSRF_SECRET_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour

function generateSecret(): string {
  const array = new Uint8Array(CSRF_SECRET_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function generateToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[+/=]/g, '');
}

export async function createCsrfToken(): Promise<{ token: string; secret: string }> {
  const token = generateToken();
  const secret = generateSecret();
  const timestamp = Date.now() + CSRF_TOKEN_EXPIRY;
  
  const cookieStore = await cookies();
  cookieStore.set('csrf_token', `${token}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/',
  });
  
  cookieStore.set('csrf_secret', `${secret}:${timestamp}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_TOKEN_EXPIRY / 1000,
    path: '/',
  });
  
  return { token, secret };
}

export async function validateCsrfRequestToken(request: NextRequest): Promise<boolean> {
  const cookieToken = request.cookies.get('csrf_token')?.value;
  const cookieSecret = request.cookies.get('csrf_secret')?.value;
  const headerToken = request.headers.get('x-csrf-token');
  
  if (!cookieToken || !cookieSecret || !headerToken) {
    return false;
  }
  
  const [secret, timestampStr] = cookieSecret.split(':');
  const timestamp = parseInt(timestampStr, 10);
  
  if (!secret || !timestamp || Date.now() > timestamp) {
    return false;
  }
  
  const expectedToken = headerToken;
  const isValid = expectedToken === cookieToken;
  
  if (isValid) {
    const newToken = generateToken();
    const cookieStore = await cookies();
    cookieStore.set('csrf_token', `${newToken}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_EXPIRY / 1000,
      path: '/',
    });
  }
  
  return isValid;
}

export function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export function requireCsrfValidation<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T
): T {
  return (async (...args: unknown[]) => {
    const request = args[0] as NextRequest;
    
    if (!isSafeMethod(request.method)) {
      const isValidCsrf = await validateCsrfRequestToken(request);
      if (!isValidCsrf) {
        return Response.json(
          { error: 'Invalid or missing CSRF token' },
          { status: 403 }
        );
      }
    }
    
    return handler(...args);
  }) as T;
}