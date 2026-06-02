import crypto from 'crypto';

const SECRET_PATTERNS = {
  awsAccessKey: /AKIA[0-9A-Z]{16}/g,
  awsSecretKey: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
  apiKey: /(api[_-]?key|apikey)\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{32,}['"]?/gi,
  privateKey: /-----BEGIN (RSA|DSA|EC|OPENSSH) PRIVATE KEY-----/g,
  jwtToken: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g,
  databaseUrl: /postgres:\/\/[^:]+:[^@]+@[^\/]+\/[^\s]+/g,
  slackToken: /xox[baprs]-[0-9a-zA-Z\-]{10,255}/g,
  githubToken: /ghp_[0-9a-zA-Z]{36}/g,
  mongodbUri: /mongodb\+?srv:\/\/[^:]+:[^@]+@/g,
  sqlConnectionString: /Server=.+;User\s*=.+;Password=.+/gi,
  stripeKey: /sk_live_[0-9a-zA-Z]{24,}/g,
  googleApiKey: /AIza[0-9A-Za-z_-]{35}/g,
  genericToken: /['"]?[a-z_]*token['"]?\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{20,}['"]?/gi,
};

export function scanForSecrets(obj: unknown, depth: number = 0): { found: boolean; locations: string[] } {
  const locations: string[] = [];

  if (depth > 5) {
    return { found: false, locations };
  }

  function scan(value: unknown, path: string = ''): void {
    if (typeof value === 'string') {
    for (const [secretType, pattern] of Object.entries(SECRET_PATTERNS)) {
      const regex = new RegExp(pattern.source, pattern.flags);
      if (regex.test(value)) {
        locations.push(`${secretType} at ${path || 'root'}`);
      }
    }
  }

    if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        const newPath = path ? `${path}.${key}` : key;
        if (typeof val === 'object') {
          scan(val, newPath);
        } else if (typeof val === 'string') {
          scan(val, newPath);
        }
      }
    }
  }

  scan(obj);

  return {
    found: locations.length > 0,
    locations,
  };
}

export function maskSecrets(str: string): string {
  let masked = str;

  for (const pattern of Object.values(SECRET_PATTERNS)) {
    masked = masked.replace(pattern, '***REDACTED***');
  }

  return masked;
}

export function logWithoutSecrets(data: unknown): unknown {
  const serialized = JSON.stringify(data);
  let masked = maskSecrets(serialized);
  masked = masked.replace(/"[^"]*token[^"]*":\s*"[^"]*"/gi, '"[REDACTED]"');
  masked = masked.replace(/"password":\s*"[^"]*"/gi, '"password": "[REDACTED]"');
  masked = masked.replace(/"apiKey":\s*"[^"]*"/gi, '"apiKey": "[REDACTED]"');
  masked = masked.replace(/"secret":\s*"[^"]*"/gi, '"secret": "[REDACTED]"');
  return JSON.parse(masked);
}

export function validateEnvironmentSecrets(): { valid: boolean; missing: string[] } {
  const required = [
    'DB_ENCRYPTION_KEY',
    'JWT_SECRET',
    'SESSION_SECRET',
  ];

  const missing = required.filter(key => !process.env[key]);

  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    console.error('Missing required secrets in production:', missing);
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

export function rotateSecrets(): void {
  const newJwtSecret = crypto.randomBytes(32).toString('hex');
  const newSessionSecret = crypto.randomBytes(32).toString('hex');
  const newDbKey = crypto.randomBytes(32).toString('hex');

  console.log('Secrets rotated (update .env)');
  console.log(`JWT_SECRET=${newJwtSecret}`);
  console.log(`SESSION_SECRET=${newSessionSecret}`);
  console.log(`DB_ENCRYPTION_KEY=${newDbKey}`);
}
