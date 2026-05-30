// Business logic constants
export const WORKFLOW_PHASES = {
  PENDING: 'pending',
  COUNTER: 'counter',
  ACCEPTED: 'accepted',
  SOFTHOLD: 'softhold',
  CHECKLIST: 'checklist',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const;

export const USER_ROLES = {
  CREATOR: 'creator',
  BRAND: 'brand',
  HOST: 'host',
  EXPLORER: 'explorer',
  ADMIN: 'admin'
} as const;

export const CREATOR_ROLES = {
  DJ: 'dj',
  PERFORMER: 'performer',
  ENTERTAINER: 'entertainer',
  VENDOR: 'vendor',
  STAFF: 'staff'
} as const;

export const RATE_LIMITS = {
  LOGIN_ATTEMPTS_PER_HOUR: 20,
  LOGIN_LOCKOUT_MINUTES: 15,
  FAILED_LOGIN_THRESHOLD: 5,
  SIGNUP_PER_IP_PER_HOUR: 10,
  API_CALLS_PER_MINUTE: 100,
  LLM_CALLS_PER_DAY: 100
} as const;

export const TIMEOUT_DURATIONS = {
  SESSION_ABSOLUTE_MINUTES: 30,
  SESSION_IDLE_MINUTES: 15,
  PASSWORD_RESET_TOKEN_MINUTES: 15,
  API_REQUEST_SECONDS: 30
} as const;

export const DATA_RETENTION = {
  SESSION_LOGS_DAYS: 30,
  AUDIT_LOGS_DAYS: 365,
  BACKUP_RETENTION_DAYS: 90
} as const;

export const FILE_CONSTRAINTS = {
  MAX_FILE_SIZE_MB: 50,
  MAX_IMAGE_SIZE_MB: 10,
  MAX_VIDEO_SIZE_MB: 500,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp']
} as const;

export const ENCRYPTION = {
  ALGORITHM: 'aes-256-gcm',
  BCRYPT_ROUNDS: 12
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 500
} as const;

export const CACHE_DURATIONS = {
  USER_PROFILE_MINUTES: 5,
  FINANCIAL_CONFIG_MINUTES: 5,
  CREATOR_EVENTS_MINUTES: 10
} as const;

export const COMPLIANCE = {
  GDPR_NOTIFICATION_DAYS: 3,
  CCPA_RESPONSE_DAYS: 45,
  DATA_DELETION_DAYS: 30,
  BREACH_NOTIFICATION_HOURS: 72
} as const;

export const FEATURE_FLAGS = {
  ENABLE_LLM_FEATURES: true,
  ENABLE_BULK_OPERATIONS: true,
  ENABLE_QA_WORKFLOW: true,
  ENABLE_EXCLUSIVITY_CHECKS: true,
  MAINTENANCE_MODE: false
} as const;
