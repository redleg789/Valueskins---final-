import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const SQL_INJECTION_PATTERNS = [
  /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT|ONERROR|ONLOAD)\b)/gi,
  /(-{2}|\/\*|\*\/|;|\||&&)/,
  /(\bOR\b.*=.*)/gi,
  /(\bAND\b.*=.*)/gi,
  /(1\s*=\s*1)|(1\s*=\s*0)/gi,
];

const XSS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /on\w+\s*=\s*["'][^"']*["']/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /<iframe[^>]*>/gi,
  /<object[^>]*>/gi,
  /<embed[^>]*>/gi,
];

const COMMAND_INJECTION_PATTERNS = [
  /[;&|`$()]/,
  /\$\{.*\}/,
  /\$\(.*\)/,
];

export function detectSQLInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

export function detectXSS(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

export function detectCommandInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return COMMAND_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

export function detectPathTraversal(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  return /(\.\.[\/\\]|\.\.%2[fF]|\.\.%5[cC])/i.test(input);
}

export function validateJSONPayload(data: unknown): boolean {
  try {
    const str = JSON.stringify(data);
    const parsed = JSON.parse(str);
    return typeof parsed === 'object';
  } catch {
    return false;
  }
}

export function scanPayload(obj: unknown, depth: number = 0): boolean {
  if (depth > 5) return false;

  if (typeof obj === 'string') {
    if (detectSQLInjection(obj)) return true;
    if (detectXSS(obj)) return true;
    if (detectCommandInjection(obj)) return true;
    if (detectPathTraversal(obj)) return true;
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (detectXSS(key)) return true;
      if (scanPayload(value, depth + 1)) return true;
    }
  }

  return false;
}

export function injectionPrevention(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (!validateJSONPayload(req.body)) {
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }

    if (scanPayload(req.body)) {
      res.status(400).json({ error: 'Potential injection attack detected' });
      return;
    }
  }

  if (req.url && detectPathTraversal(req.url)) {
    res.status(400).json({ error: 'Invalid request path' });
    return;
  }

  next();
}
