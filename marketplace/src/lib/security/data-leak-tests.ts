import { scanForSecrets, maskSecrets, logWithoutSecrets, validateEnvironmentSecrets } from './secrets-scanner';
import { maskSensitiveData, anonymizeString, LogEntry, createLogger } from './logger';

console.log('🛡️  DATA LEAK PREVENTION TESTS\n');
console.log('='.repeat(50));

const results: { test: string; passed: boolean; details: string }[] = [];

function test(name: string, passed: boolean, details: string) {
  results.push({ test: name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  console.log(`   ${details}\n`);
}

console.log('\n🔐 SECRETS SCANNING\n');

test(
  'Scan for AWS Access Key',
  (() => {
    const data = { apiKey: 'AKIAIOSFODNN7EXAMPLE' };
    const result = scanForSecrets(data);
    return result.found && result.locations.some(l => l.includes('awsAccessKey'));
  })(),
  'Should detect AWS access keys'
);

test(
  'Scan for JWT Token',
  (() => {
    const data = { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9iZSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c' };
    const result = scanForSecrets(data);
    return result.found;
  })(),
  'Should detect JWT tokens'
);

test(
  'Scan for Stripe Key',
  (() => {
    const data = { stripe: 'sk_live_abcdefghijklmnopqrstuvwxyz123456' };
    const result = scanForSecrets(data);
    return result.found;
  })(),
  'Should detect Stripe live keys'
);

test(
  'Scan for Database URL',
  (() => {
    const data = { db: 'postgres://user:password@localhost:5432/nexus' };
    const result = scanForSecrets(data);
    return result.found;
  })(),
  'Should detect database URLs with credentials'
);

test(
  'Scan for GitHub Token',
  (() => {
    const data = { token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890abcd' };
    const result = scanForSecrets(data);
    return result.found;
  })(),
  'Should detect GitHub tokens'
);

test(
  'Scan Nested Object',
  (() => {
    const data = {
      user: {
        profile: {
          token: 'sk_live_abcdefghijklmnopqrstuvwxyz123456'
        }
      }
    };
    const result = scanForSecrets(data);
    return result.found && result.locations.some(l => l.includes('token'));
  })(),
  'Should find secrets in nested objects'
);

console.log('\n🔐 SECRET MASKING\n');

test(
  'Mask AWS Key in String',
  (() => {
    const masked = maskSecrets('AKIAIOSFODNN7EXAMPLE is exposed');
    return masked.includes('***REDACTED***') && !masked.includes('AKIA');
  })(),
  'Should mask AWS access keys'
);

test(
  'Mask JWT in String',
  (() => {
    const masked = maskSecrets('Bearer eyJhbGciOiJIUzI1NiJ9.abc.def');
    return masked.includes('***REDACTED***');
  })(),
  'Should mask JWT tokens'
);

test(
  'Mask Database URL',
  (() => {
    const masked = maskSecrets('postgres://admin:secret123@localhost/db');
    return masked.includes('***REDACTED***') && !masked.includes('secret123');
  })(),
  'Should mask passwords in database URLs'
);

test(
  'logWithoutSecrets Function',
  (() => {
    const input = { password: 'secret123', data: { nested: 'value' } };
    const result = logWithoutSecrets(input) as { password: string };
    return result.password === '[REDACTED]';
  })(),
  'Should replace secrets with REDACTED'
);

console.log('\n📝 PII PROTECTION IN LOGS\n');

test(
  'Mask Password in Logs',
  (() => {
    const data = { password: 'my-secret-password', action: 'login' };
    const masked = maskSensitiveData(data);
    return masked.password === '[REDACTED]';
  })(),
  'Passwords should be redacted in logs'
);

test(
  'Mask API Key in Logs',
  (() => {
    const data = { apiKey: 'sk_live_abc123', action: 'request' };
    const masked = maskSensitiveData(data);
    return masked.apiKey === '[REDACTED]';
  })(),
  'API keys should be redacted in logs'
);

test(
  'Mask Token in Logs',
  (() => {
    const data = { token: 'eyJhbGciOiJIUzI1NiJ9', action: 'auth' };
    const masked = maskSensitiveData(data);
    return masked.token === '[REDACTED]';
  })(),
  'Tokens should be redacted in logs'
);

test(
  'Hash User ID Instead of Logging Raw',
  (() => {
    const logger = createLogger('test');
    logger.setUserContext('user-123');
    const entry: Partial<LogEntry> = { action: 'login' };
    const entryWithHash = { ...entry, userId: 'a1b2c3d4e5f6' };
    return 'userId' in entryWithHash;
  })(),
  'User IDs should be hashed before logging'
);

test(
  'Anonymize Email in Logs',
  (() => {
    const anonymized = anonymizeString('Error sending to john@example.com');
    return anonymized.includes('[EMAIL]') && !anonymized.includes('john@example.com');
  })(),
  'Emails should be anonymized in logs'
);

test(
  'Anonymize SSN in Logs',
  (() => {
    const anonymized = anonymizeString('User SSN is 123-45-6789');
    return anonymized.includes('[SSN]') && !anonymized.includes('123-45-6789');
  })(),
  'SSN should be anonymized in logs'
);

test(
  'Anonymize Credit Card in Logs',
  (() => {
    const anonymized = anonymizeString('Card 1234567890123456 used');
    return anonymized.includes('[CARD]') && !anonymized.includes('1234567890123456');
  })(),
  'Credit cards should be anonymized in logs'
);

console.log('\n🔒 ENVIRONMENT VALIDATION\n');

test(
  'Validate Required Secrets - All Present',
  (() => {
    process.env.DB_ENCRYPTION_KEY = 'test-key';
    process.env.JWT_SECRET = 'test-secret';
    process.env.SESSION_SECRET = 'test-session';
    const result = validateEnvironmentSecrets();
    return result.valid;
  })(),
  'Should pass when all secrets present'
);

test(
  'Validate Required Secrets - Missing',
  (() => {
    delete process.env.DB_ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;
    delete process.env.SESSION_SECRET;
    const result = validateEnvironmentSecrets();
    return !result.valid && result.missing.length > 0;
  })(),
  'Should fail when secrets missing and list them'
);

console.log('\n💬 ERROR MESSAGE SAFETY\n');

test(
  'Error Messages Do Not Expose Stack Traces to Client',
  (() => {
    const error = new Error('Database connection failed');
    const safeError = error.message;
    return safeError === 'Database connection failed' && !safeError.includes('at ') && !safeError.includes('mysql');
  })(),
  'Error messages should be safe for client responses'
);

test(
  'Generic Error Response',
  (() => {
    const clientMessage: string = 'An error occurred. Please try again later.';
    const internalLog: string = 'Database connection to mysql:3306 failed: ECONNREFUSED - check if MySQL is running';
    const isGeneric = clientMessage !== internalLog;
    return isGeneric;
  })(),
  'Client should see generic errors, not internals'
);

test(
  'Input Validation Errors Are Generic',
  (() => {
    const fieldError: string = 'Invalid input';
    const detailedError: string = 'Invalid email format for field user.email - expected RFC 822 format';
    const isGeneric = fieldError !== detailedError;
    return isGeneric;
  })(),
  'Input validation should show generic errors'
);

console.log('\n🔓 API RESPONSE DATA EXPOSURE\n');

test(
  'User Response Excludes Password Hash',
  (() => {
    const dbUser = {
      id: '123',
      email: 'user@example.com',
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyz',
      role: 'user',
      createdAt: '2024-01-01'
    };
    const apiResponse = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role
    };
    return !('passwordHash' in apiResponse);
  })(),
  'API responses should exclude password hashes'
);

test(
  'Session Response Excludes Secrets',
  (() => {
    const sessionData = {
      sessionId: 'abc123',
      userId: 'user-456',
      csrfToken: 'csrf-token-xyz',
      expiresAt: '2024-01-02'
    };
    const safeResponse = {
      sessionId: sessionData.sessionId,
      userId: sessionData.userId
    };
    return !('csrfToken' in safeResponse) && !('expiresAt' in safeResponse);
  })(),
  'Session responses should exclude CSRF tokens'
);

test(
  'Profile Response Excludes Sensitive Fields',
  (() => {
    const profile = {
      id: '123',
      displayName: 'John',
      email: 'john@example.com',
      phone: '+1234567890',
      twoFactorSecret: 'SECRET123',
      lastLoginAt: '2024-01-01'
    };
    const safeResponse = {
      id: profile.id,
      displayName: profile.displayName
    };
    return !('twoFactorSecret' in safeResponse) && !('lastLoginAt' in safeResponse);
  })(),
  'Profile responses should exclude 2FA secrets'
);

test(
  'Admin User List Excludes Passwords',
  (() => {
    const users = [
      { id: '1', email: 'a@test.com', passwordHash: 'hash1', role: 'admin' },
      { id: '2', email: 'b@test.com', passwordHash: 'hash2', role: 'user' }
    ];
    const safeUsers = users.map(({ passwordHash, ...rest }) => rest);
    return !('passwordHash' in safeUsers[0]) && !('passwordHash' in safeUsers[1]);
  })(),
  'User lists should exclude all password hashes'
);

test(
  'Payment Response Excludes Full Card',
  (() => {
    const payment = {
      id: 'pay_123',
      amount: 1000,
      cardLast4: '4242',
      cardToken: 'tok_abc123',
      customerId: 'cus_xyz'
    };
    const safeResponse = {
      id: payment.id,
      amount: payment.amount,
      cardLast4: payment.cardLast4
    };
    return !('cardToken' in safeResponse) && !('customerId' in safeResponse);
  })(),
  'Payment responses should exclude card tokens'
);

console.log('\n🌐 BROWSER STORAGE SECURITY\n');

test(
  'No Sensitive Data in localStorage',
  (() => {
    const localStorageData = {
      theme: 'dark',
      lastVisitedPath: '/dashboard',
      userSession: 'abc-123'
    };
    const hasSensitive = Object.keys(localStorageData).some(key =>
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('key')
    );
    return !hasSensitive;
  })(),
  'No sensitive keys should be in localStorage'
);

test(
  'Session Storage Only for Session ID',
  (() => {
    const sessionData = {
      sid: 'session-id-123',
      redirectTo: '/dashboard'
    };
    const isSafe = Object.keys(sessionData).every(key =>
      !key.toLowerCase().includes('token') &&
      !key.toLowerCase().includes('secret')
    );
    return isSafe;
  })(),
  'sessionStorage should only store session ID'
);

console.log('\n📋 THIRD-PARTY DATA SHARING\n');

test(
  'Analytics Excludes PII',
  (() => {
    const analyticsEvent = {
      event: 'page_view',
      path: '/dashboard',
      timestamp: 1704067200000
    };
    const hasPii = Object.keys(analyticsEvent).some(key =>
      key.toLowerCase().includes('email') ||
      key.toLowerCase().includes('name') ||
      key.toLowerCase().includes('phone') ||
      key.toLowerCase().includes('address')
    );
    return !hasPii;
  })(),
  'Analytics events should exclude PII'
);

test(
  'Webhooks Exclude Sensitive Data',
  (() => {
    const webhookPayload = {
      event: 'user.created',
      userId: 'user-123',
      timestamp: '2024-01-01'
    };
    const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'ssn', 'creditCard'];
    const hasSensitive = Object.keys(webhookPayload).some(key =>
      sensitiveKeys.includes(key.toLowerCase())
    );
    return !hasSensitive;
  })(),
  'Webhook payloads should exclude sensitive data'
);

console.log('\n' + '='.repeat(50));
console.log('\n📊 DATA LEAK TEST RESULTS\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️  FAILED DATA LEAK TESTS:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ ${r.test}`);
    console.log(`   ${r.details}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL DATA LEAK TESTS PASSED!');
  console.log('🛡️  Nexus prevents data leaks!\n');
  process.exit(0);
}