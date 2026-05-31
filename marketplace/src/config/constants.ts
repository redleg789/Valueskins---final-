// Security & Session
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
export const SESSION_COOKIE_NAME = 'valueskins_session';
export const SESSION_COOKIE_PATH = '/';
export const SESSION_COOKIE_SECURE = process.env.NODE_ENV === 'production';
export const SESSION_COOKIE_SAME_SITE = 'lax' as const;

// Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
export const RATE_LIMIT_REQUESTS = 100;
export const AUTH_RATE_LIMIT_REQUESTS = 5;
export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Validation
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const DISPLAY_NAME_MAX_LENGTH = 255;
export const EMAIL_MAX_LENGTH = 255;

// Cache TTLs (in milliseconds)
export const CACHE_SESSION_TTL = 5 * 60 * 1000; // 5 minutes
export const CACHE_USER_TTL = 10 * 60 * 1000; // 10 minutes
export const CACHE_DEAL_TTL = 15 * 60 * 1000; // 15 minutes

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

// File Upload
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Data Retention (in milliseconds)
export const DATA_RETENTION_LOGS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const DATA_RETENTION_ANALYTICS = 90 * 24 * 60 * 60 * 1000; // 90 days
export const DATA_RETENTION_BACKUPS = 90 * 24 * 60 * 60 * 1000; // 90 days

// API Response
export const API_RESPONSE_TIMEOUT_MS = 30 * 1000; // 30 seconds
export const API_MAX_REQUEST_BODY_SIZE = '10kb';

// URLs
export const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.NEXT_PUBLIC_APP_URL || 'https://valueskins-final.vercel.app',
];

// Email
export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@valueskins.com';
export const EMAIL_SUPPORT = process.env.EMAIL_SUPPORT || 'support@valueskins.com';
