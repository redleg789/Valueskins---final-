const required = [
  'DATABASE_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
];

const optional = [
  'NEXT_PUBLIC_APP_URL',
  'LOG_LEVEL',
  'SENTRY_DSN',
];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    databaseUrl: process.env.DATABASE_URL!,
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
    sentryDsn: process.env.SENTRY_DSN,
    isProduction: process.env.NODE_ENV === 'production',
  };
}

export const env = validateEnv();
