type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'critical';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  requestId?: string;
  userId?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  errorStack?: string;
  ip?: string;
  userAgent?: string;
  action?: string;
  details?: Record<string, unknown>;
}

interface SecurityLogEntry extends LogEntry {
  isSecurityEvent: true;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threatType?: string;
}

const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'sessionId',
  'csrfToken',
  'creditCard',
  'ssn',
  'email',
];

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{16}\b/g,
];

function maskSensitiveData(obj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some((field) => key.toLowerCase().includes(field.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }
  
  return masked;
}

function anonymizeString(str: string): string {
  return str.replace(PII_PATTERNS[0], '[EMAIL]').replace(PII_PATTERNS[1], '[SSN]').replace(PII_PATTERNS[2], '[CARD]');
}

function createLogEntry(level: LogLevel, service: string, data: Partial<LogEntry>): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    ...data,
  };
  
  if (entry.error) {
    entry.error = anonymizeString(entry.error);
  }
  
  return entry;
}

function formatLog(entry: LogEntry): string {
  const sanitized = maskSensitiveData(entry as unknown as Record<string, unknown>);
  return JSON.stringify(sanitized);
}

class Logger {
  private service: string;
  private requestId?: string;
  private userId?: string;
  private ip?: string;
  private userAgent?: string;

  constructor(service: string) {
    this.service = service;
  }

  setRequestContext(requestId: string, ip?: string, userAgent?: string) {
    this.requestId = requestId;
    this.ip = ip;
    this.userAgent = userAgent;
  }

  setUserContext(userId: string) {
    this.userId = userId;
  }

  clearContext() {
    this.requestId = undefined;
    this.userId = undefined;
    this.ip = undefined;
    this.userAgent = undefined;
  }

  debug(message: string, details?: Record<string, unknown>) {
    const entry = createLogEntry('debug', this.service, {
      requestId: this.requestId,
      userId: this.userId ? this.hashUserId(this.userId) : undefined,
      ip: this.ip,
      userAgent: this.userAgent,
      details,
    });
    console.debug(formatLog(entry));
  }

  info(message: string, details?: Record<string, unknown>) {
    const entry = createLogEntry('info', this.service, {
      requestId: this.requestId,
      userId: this.userId ? this.hashUserId(this.userId) : undefined,
      ip: this.ip,
      userAgent: this.userAgent,
      details,
    });
    console.info(formatLog(entry));
  }

  warn(message: string, details?: Record<string, unknown>) {
    const entry = createLogEntry('warn', this.service, {
      requestId: this.requestId,
      userId: this.userId ? this.hashUserId(this.userId) : undefined,
      ip: this.ip,
      userAgent: this.userAgent,
      details,
    });
    console.warn(formatLog(entry));
  }

  error(error: Error | string, details?: Record<string, unknown>) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;
    
    const entry = createLogEntry('error', this.service, {
      requestId: this.requestId,
      userId: this.userId ? this.hashUserId(this.userId) : undefined,
      ip: this.ip,
      userAgent: this.userAgent,
      error: errorMessage,
      errorStack,
      details,
    });
    console.error(formatLog(entry));
  }

  critical(message: string, error?: Error, details?: Record<string, unknown>) {
    const entry = createLogEntry('critical', this.service, {
      requestId: this.requestId,
      userId: this.userId ? this.hashUserId(this.userId) : undefined,
      ip: this.ip,
      userAgent: this.userAgent,
      error: error?.message || message,
      errorStack: error?.stack,
      details,
    });
    console.error(formatLog(entry));
  }

  security(log: Omit<SecurityLogEntry, 'timestamp' | 'level' | 'service' | 'isSecurityEvent'>) {
    const entry: SecurityLogEntry = {
      ...createLogEntry('error', this.service, {
        requestId: this.requestId,
        userId: this.userId ? this.hashUserId(this.userId) : undefined,
        ip: this.ip,
        userAgent: this.userAgent,
      }),
      isSecurityEvent: true,
      severity: log.severity,
      threatType: log.threatType,
      action: log.action,
      details: log.details,
    };
    console.error(JSON.stringify(entry));
  }

  logApiRequest(endpoint: string, method: string, statusCode: number, durationMs: number) {
    const entry = createLogEntry('info', this.service, {
      requestId: this.requestId,
      userId: this.userId ? this.hashUserId(this.userId) : undefined,
      ip: this.ip,
      endpoint,
      method,
      statusCode,
      durationMs,
    });
    console.info(formatLog(entry));
  }

  private hashUserId(userId: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(userId).digest('hex').substring(0, 16);
  }
}

export const logger = new Logger('valueskins-api');

export function createLogger(service: string): Logger {
  return new Logger(service);
}

export function logSecurityEvent(
  event: string,
  severity: SecurityLogEntry['severity'],
  threatType: string | null | undefined,
  details?: Record<string, unknown>
) {
  logger.security({
    action: event,
    severity,
    threatType: threatType ?? 'unknown',
    details,
  });
}

export function logAuthFailure(reason: string, ip?: string) {
  logSecurityEvent('auth_failure', 'medium', 'brute_force', { reason, ip });
}

export function logAuthSuccess(userId: string) {
  logSecurityEvent('auth_success', 'low', 'login', { userId });
}

export function logSessionExpired(userId: string) {
  logSecurityEvent('session_expired', 'low', 'timeout', { userId });
}

export function logPermissionDenied(userId: string, resource: string) {
  logSecurityEvent('permission_denied', 'high', 'unauthorized_access', { userId, resource });
}

export function logRateLimitExceeded(ip: string, endpoint: string) {
  logSecurityEvent('rate_limit_exceeded', 'medium', 'dos', { ip, endpoint });
}

export function logInputValidationFailed(field: string, reason: string, userId?: string) {
  logSecurityEvent('validation_failed', 'low', 'input_malformed', { field, reason, userId });
}

export function logXssAttempt(userId: string, payload: string) {
  logSecurityEvent('xss_attempt', 'high', 'injection', { userId, payload });
}

export function logSqlInjectionAttempt(userId: string, payload: string) {
  logSecurityEvent('sql_injection_attempt', 'critical', 'injection', { userId, payload });
}

export {
  type LogLevel,
  type LogEntry,
  type SecurityLogEntry,
  maskSensitiveData,
  anonymizeString,
};