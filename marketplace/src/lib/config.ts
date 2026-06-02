/**
 * Environment Configuration
 * Scaffolding for secrets and API keys - fill in later
 * All values use environment variables with sensible defaults
 */

// ──────────────────────────────────────────────────────────────────────────────
// Backend & Real-time Configuration
// ──────────────────────────────────────────────────────────────────────────────

export const BACKEND_CONFIG = {
  // API Base URL (Render backend or localhost for development)
  API_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080',

  // WebSocket URL for real-time updates
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',

  // API Timeout (milliseconds)
  TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '30000', 10),

  // Retry configuration
  RETRY_ATTEMPTS: parseInt(process.env.NEXT_PUBLIC_API_RETRY_ATTEMPTS || '3', 10),
  RETRY_DELAY: parseInt(process.env.NEXT_PUBLIC_API_RETRY_DELAY || '1000', 10),
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// OAuth & Authentication
// ──────────────────────────────────────────────────────────────────────────────

export const AUTH_CONFIG = {
  // Google OAuth (set in .env.local or Vercel)
  GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'PLACEHOLDER',
  GOOGLE_REDIRECT_URI:
    process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI ||
    'http://localhost:3000/api/oauth/google/callback',

  // JWT Configuration (user provides JWT_SECRET to backend)
  SESSION_TIMEOUT: parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT || '1800000', 10), // 30 min
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Payment Processing
// ──────────────────────────────────────────────────────────────────────────────

export const PAYMENT_CONFIG = {
  // Stripe Keys (set in Vercel - public key only, secret is backend-only)
  STRIPE_PUBLIC_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || 'pk_test_PLACEHOLDER',

  // Currency & Amounts
  CURRENCY: process.env.NEXT_PUBLIC_CURRENCY || 'USD',
  MIN_DEAL_VALUE: parseInt(process.env.NEXT_PUBLIC_MIN_DEAL_VALUE || '100', 10),
  MAX_DEAL_VALUE: parseInt(process.env.NEXT_PUBLIC_MAX_DEAL_VALUE || '1000000', 10),

  // Commission
  PLATFORM_COMMISSION_PERCENT: parseFloat(
    process.env.NEXT_PUBLIC_PLATFORM_COMMISSION_PERCENT || '5'
  ),
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Feature Flags
// ──────────────────────────────────────────────────────────────────────────────

export const FEATURES = {
  // Real-time sync
  ENABLE_REALTIME: process.env.NEXT_PUBLIC_ENABLE_REALTIME !== 'false',

  // Video calls
  ENABLE_VIDEO_CALLS: process.env.NEXT_PUBLIC_ENABLE_VIDEO_CALLS === 'true',

  // File uploads
  ENABLE_FILE_UPLOADS: process.env.NEXT_PUBLIC_ENABLE_FILE_UPLOADS !== 'false',

  // Payments (disabled if no Stripe key)
  ENABLE_PAYMENTS:
    process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY &&
    !process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY.includes('PLACEHOLDER'),

  // Analytics
  ENABLE_ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Analytics & Monitoring
// ──────────────────────────────────────────────────────────────────────────────

export const ANALYTICS_CONFIG = {
  // Sentry (error tracking)
  SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,

  // Datadog (APM)
  DATADOG_APPLICATION_ID: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || undefined,
  DATADOG_CLIENT_TOKEN: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN || undefined,

  // Environment name
  ENVIRONMENT: process.env.NODE_ENV || 'development',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// App Metadata
// ──────────────────────────────────────────────────────────────────────────────

export const APP_CONFIG = {
  // App name and version
  APP_NAME: 'ValueSkins',
  APP_VERSION: '2.0.0',

  // Support contact
  SUPPORT_EMAIL: 'support@valueskins.io',

  // Legal
  TERMS_OF_SERVICE_URL: '/legal/terms',
  PRIVACY_POLICY_URL: '/legal/privacy',
  COOKIE_POLICY_URL: '/legal/cookies',
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Validation & Constraints
// ──────────────────────────────────────────────────────────────────────────────

export const VALIDATION = {
  // Username constraints
  USERNAME_MIN_LENGTH: 3,
  USERNAME_MAX_LENGTH: 30,
  USERNAME_PATTERN: /^[a-zA-Z0-9_-]+$/,

  // Email constraints
  EMAIL_PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

  // Password constraints
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REQUIRE_UPPERCASE: true,
  PASSWORD_REQUIRE_NUMBER: true,
  PASSWORD_REQUIRE_SPECIAL: true,

  // Message constraints
  MESSAGE_MAX_LENGTH: 5000,

  // File upload constraints
  MAX_FILE_SIZE: 52428800, // 50MB
  ALLOWED_FILE_TYPES: ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf'],
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Development & Debug
// ──────────────────────────────────────────────────────────────────────────────

export const DEBUG = {
  // Enable console logging
  ENABLE_DEBUG_LOG: process.env.NEXT_PUBLIC_DEBUG === 'true' || false,

  // API request logging
  LOG_API_REQUESTS: process.env.NEXT_PUBLIC_LOG_API_REQUESTS === 'true' || false,

  // Mock API responses (for testing without backend)
  MOCK_API:
    process.env.NEXT_PUBLIC_MOCK_API === 'true' ||
    !BACKEND_CONFIG.API_URL.includes('localhost') ||
    BACKEND_CONFIG.API_URL.includes('PLACEHOLDER'),
} as const;

// ──────────────────────────────────────────────────────────────────────────────
// Utility: Check configuration validity
// ──────────────────────────────────────────────────────────────────────────────

export function validateConfig(): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  // Check for placeholder values in production
  if (process.env.NODE_ENV === 'production') {
    if (AUTH_CONFIG.GOOGLE_CLIENT_ID.includes('PLACEHOLDER')) {
      warnings.push('NEXT_PUBLIC_GOOGLE_CLIENT_ID not configured for production');
    }

    if (PAYMENT_CONFIG.STRIPE_PUBLIC_KEY.includes('PLACEHOLDER')) {
      warnings.push('NEXT_PUBLIC_STRIPE_PUBLIC_KEY not configured for production');
    }
  }

  // Check backend connectivity
  if (BACKEND_CONFIG.API_URL.includes('PLACEHOLDER')) {
    warnings.push('Backend URL not configured - API calls will fail');
  }

  if (BACKEND_CONFIG.WS_URL.includes('PLACEHOLDER')) {
    warnings.push('WebSocket URL not configured - real-time updates will not work');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

// Log warnings in development
if (typeof window !== 'undefined' && DEBUG.ENABLE_DEBUG_LOG) {
  const config = validateConfig();
  if (config.warnings.length > 0) {
    console.warn('[Config] Configuration warnings:', config.warnings);
  }
}
