import { ZodSchema } from 'zod';

export async function validateInput(schema: ZodSchema, data: any) {
  try {
    const validData = await schema.parseAsync(data);
    return { valid: true, data: validData, errors: {} };
  } catch (error: any) {
    const errors: Record<string, string> = {};
    if (error.errors) {
      error.errors.forEach((err: any) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
    }
    return { valid: false, data: null, errors };
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '')
    .trim();
}

export function validateEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

export function validateHandle(handle: string): boolean {
  return /^[a-zA-Z0-9_-]{3,30}$/.test(handle) &&
    !/^[_-]/.test(handle) &&
    !/[_-]$/.test(handle);
}

export function validateUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
