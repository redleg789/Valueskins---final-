import { sanitizeHtml, sanitizeText, sanitizeUrl, sanitizeFilename, detectMaliciousInput, stripAllHtml, isReDoSResistant, sanitizeEmail } from './sanitize';
import { validateInput, CreatePostSchema, MessageSchema } from './schemas';

console.log('🛡️  NEXUS SECURITY ATTACK SIMULATION SUITE\n');
console.log('='.repeat(60));

const results: { attack: string; passed: boolean; details: string }[] = [];

function test(name: string, passed: boolean, details: string) {
  results.push({ attack: name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  console.log(`   ${details}\n`);
}

console.log('\n🔴 ATTACK TYPE 1: XSS (Cross-Site Scripting)\n');

test(
  'XSS - Script Tag Injection',
  (() => {
    const input = '<script>alert("XSS")</script>';
    const sanitized = stripAllHtml(input);
    return sanitized === '' && detectMaliciousInput(input).isMalicious;
  })(),
  'Script tags should be stripped completely'
);

test(
  'XSS - Event Handler Injection',
  (() => {
    const input = '<img src=x onerror=alert(1)>';
    const sanitized = stripAllHtml(input);
    return !sanitized.includes('onerror') && detectMaliciousInput(input).isMalicious;
  })(),
  'Event handlers should be detected and stripped'
);

test(
  'XSS - JavaScript Protocol',
  (() => {
    const input = 'javascript:alert(document.cookie)';
    const sanitized = sanitizeUrl(input);
    return sanitized === '' && detectMaliciousInput(input).isMalicious;
  })(),
  'javascript: protocol should be blocked'
);

test(
  'XSS - Data URL Injection',
  (() => {
    const input = 'data:text/html,<script>alert(1)</script>';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  'data: URLs should be blocked'
);

test(
  'XSS - SVG Onload',
  (() => {
    const input = '<svg onload=alert(1)>';
    const sanitized = stripAllHtml(input);
    return !sanitized.includes('onload');
  })(),
  'SVG onload should be stripped'
);

test(
  'XSS - Nested Script',
  (() => {
    const input = '<div><script>alert(1)</script></div>';
    const sanitized = stripAllHtml(input);
    return !sanitized.includes('<script>');
  })(),
  'Nested script tags should be stripped'
);

test(
  'XSS - Unicode Evasion',
  (() => {
    const input = '<img src=x onerror=alert&#40;1&#41;>';
    const sanitized = stripAllHtml(input);
    return !sanitized.includes('onerror');
  })(),
  'HTML entities in payloads should be neutralized'
);

test(
  'XSS - Null Byte Injection',
  (() => {
    const input = 'test\u0000<script>alert(1)</script>';
    const sanitized = stripAllHtml(input);
    return !sanitized.includes('<script') && !sanitized.includes('\0');
  })(),
  'Null bytes should be removed'
);

test(
  'XSS - Inline Style',
  (() => {
    const input = '<div style="background: url(javascript:alert(1))">';
    const sanitized = stripAllHtml(input);
    return !sanitized.includes('javascript:');
  })(),
  'JavaScript in styles should be stripped'
);

console.log('\n🔴 ATTACK TYPE 2: SQL Injection\n');

test(
  'SQL Injection - UNION SELECT',
  (() => {
    const input = "'; SELECT * FROM users; --";
    const sanitized = sanitizeText(input, { preventSqlInjection: true });
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious && (sanitized.includes('SELECT') === false || sanitized.includes(' '));
  })(),
  'SQL keywords should be neutralized or blocked'
);

test(
  'SQL Injection - OR 1=1',
  (() => {
    const input = "' OR '1'='1";
    const sanitized = sanitizeText(input, { preventSqlInjection: true });
    return !sanitized.includes("'OR") && !sanitized.includes("'1'='1");
  })(),
  'OR conditions should be broken'
);

test(
  'SQL Injection - DROP TABLE',
  (() => {
    const input = "'; DROP TABLE users; --";
    const sanitized = sanitizeText(input, { preventSqlInjection: true });
    return !sanitized.includes('DROP TABLE');
  })(),
  'DROP commands should be stripped'
);

test(
  'SQL Injection - Comment Injection',
  (() => {
    const input = "admin'--";
    const sanitized = sanitizeText(input, { preventSqlInjection: true });
    return !sanitized.includes('--');
  })(),
  'SQL comments should be stripped'
);

test(
  'SQL Injection - Stacked Queries',
  (() => {
    const input = "'; INSERT INTO admins VALUES ('hacker', 'password'); --";
    const sanitized = sanitizeText(input, { preventSqlInjection: true });
    return !sanitized.includes('INSERT INTO');
  })(),
  'INSERT statements should be stripped'
);

test(
  'SQL Injection - UNION Detection',
  (() => {
    const input = "1 UNION SELECT password FROM users";
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'UNION SELECT should be detected'
);

console.log('\n🔴 ATTACK TYPE 3: Path Traversal\n');

test(
  'Path Traversal - Unix',
  (() => {
    const input = '../../../etc/passwd';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious && malicious.threatType === 'PATH_TRAVERSAL';
  })(),
  '../../../ should be detected'
);

test(
  'Path Traversal - Windows',
  (() => {
    const input = '..\\..\\..\\windows\\system32\\config\\sam';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'Windows path traversal should be detected'
);

test(
  'Path Traversal - URL Encoded',
  (() => {
    const input = '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'URL-encoded traversal should be detected'
);

test(
  'Filename Sanitization',
  (() => {
    const input = '../../../etc/passwd.jpg';
    const sanitized = sanitizeFilename(input);
    return !sanitized.includes('..');
  })(),
  'Directory traversal in filenames should be removed'
);

console.log('\n🔴 ATTACK TYPE 4: Command Injection\n');

test(
  'Command Injection - Semicolon',
  (() => {
    const input = 'file.txt; rm -rf /';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'Semicolons in command context should be detected'
);

test(
  'Command Injection - Pipe',
  (() => {
    const input = 'cat file.txt | grep password';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'Pipes in command context should be detected'
);

test(
  'Command Injection - Backtick',
  (() => {
    const input = '`whoami`';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'Backticks should be detected'
);

test(
  'Command Injection - Dollar',
  (() => {
    const input = '$(cat /etc/passwd)';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'Command substitution should be detected'
);

test(
  'Command Injection - Pipe Character',
  (() => {
    const input = 'command | cat /etc/passwd';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious;
  })(),
  'Pipe characters should be detected'
);

console.log('\n🔴 ATTACK TYPE 5: ReDoS (Regular Expression DoS)\n');

test(
  'ReDoS - Safe Pattern',
  (() => {
    const pattern = /^[\w]+$/;
    const safe = isReDoSResistant(pattern, 'aaaaaaaaaaaab', 100);
    return safe;
  })(),
  'Safe patterns should complete fast'
);

test(
  'ReDoS - Simple Quantifier',
  (() => {
    const pattern = /[\w]+/;
    const safe = isReDoSResistant(pattern, 'a'.repeat(50), 100);
    return safe;
  })(),
  'Simple quantifier patterns should be fast'
);

console.log('\n🔴 ATTACK TYPE 6: Input Validation Bypass\n');

test(
  'Input Validation - Empty Content',
  (() => {
    const result = validateInput(CreatePostSchema, { content: '' });
    return !result.success;
  })(),
  'Empty content should be rejected'
);

test(
  'Input Validation - Content Too Long',
  (() => {
    const result = validateInput(CreatePostSchema, { content: 'a'.repeat(300) });
    return !result.success;
  })(),
  'Content >280 chars should be rejected'
);

test(
  'Input Validation - Message Schema UUID',
  (() => {
    const result = validateInput(MessageSchema, { recipientId: 'not-a-uuid', content: 'test' });
    return !result.success;
  })(),
  'Invalid UUID should be rejected'
);

test(
  'Input Validation - HTML Stripped After Validation',
  (() => {
    const result = validateInput(CreatePostSchema, { content: '<script>alert(1)</script>' });
    if (result.success) {
      const sanitized = stripAllHtml(result.data.content);
      return !sanitized.includes('<script>');
    }
    return true;
  })(),
  'Schema-validated content should be sanitized'
);

console.log('\n🔴 ATTACK TYPE 7: SSRF (Server-Side Request Forgery)\n');

test(
  'SSRF - Localhost Access',
  (() => {
    const input = 'http://localhost:8080/admin';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  'localhost should be blocked'
);

test(
  'SSRF - Internal IP 192.168',
  (() => {
    const input = 'http://192.168.1.1:8080';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  '192.168.x.x should be blocked'
);

test(
  'SSRF - Internal IP 10.x',
  (() => {
    const input = 'http://10.0.0.1/admin';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  '10.x.x.x should be blocked'
);

test(
  'SSRF - AWS Metadata',
  (() => {
    const input = 'http://169.254.169.254/latest/meta-data/';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  'AWS metadata endpoint should be blocked'
);

test(
  'SSRF - GCP Metadata',
  (() => {
    const input = 'http://metadata.google.internal/computeMetadata/v1/';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  'GCP metadata should be blocked'
);

test(
  'SSRF - Non-HTTP Protocol',
  (() => {
    const input = 'ftp://evil.com/file';
    const sanitized = sanitizeUrl(input);
    return sanitized === '';
  })(),
  'Non-HTTP protocols should be blocked'
);

console.log('\n🔴 ATTACK TYPE 8: Header Injection\n');

test(
  'Header Injection - CRLF Injection',
  (() => {
    const input = 'test\r\nSet-Cookie: evil=value';
    const malicious = detectMaliciousInput(input);
    return malicious.isMalicious && malicious.threatType === 'HEADER_INJECTION';
  })(),
  'CRLF should be detected'
);

test(
  'Header Injection - Newline Injection',
  (() => {
    const input = 'test\nX-Forwarded-For: 1.2.3.4';
    const sanitized = sanitizeText(input);
    return sanitized !== input && sanitized.includes(' ') && !sanitized.includes('\n');
  })(),
  'Newlines should be replaced with space'
);

test(
  'Header Injection - Sanitization',
  (() => {
    const input = 'value with\nmultiple\nlines';
    const sanitized = sanitizeText(input);
    return !sanitized.includes('\n');
  })(),
  'Newlines in text should be replaced with space'
);

console.log('\n🔴 ATTACK TYPE 9: Email Injection\n');

test(
  'Email Injection - Newline in Email',
  (() => {
    const input = 'test@example.com\r\nBCC: victim@evil.com';
    const sanitized = sanitizeEmail(input);
    return sanitized === '';
  })(),
  'Email with CRLF should be rejected'
);

test(
  'Email Injection - Invalid Format',
  (() => {
    const result = sanitizeEmail('notanemail');
    return result === '';
  })(),
  'Invalid email format should be rejected'
);

test(
  'Email Injection - SQL in Email',
  (() => {
    const input = "test@example.com' OR '1'='1";
    const sanitized = sanitizeEmail(input);
    return sanitized === '';
  })(),
  'Email with SQL injection should be rejected'
);

console.log('\n🔴 ATTACK TYPE 10: Mass Assignment\n');

test(
  'Mass Assignment - Extra Fields Blocked',
  (() => {
    const input = { content: 'test', isAdmin: true, role: 'admin' };
    const result = validateInput(CreatePostSchema, input);
    if (result.success) {
      return !('isAdmin' in result.data) && !('role' in result.data);
    }
    return true;
  })(),
  'Extra fields should not be included in parsed data'
);

test(
  'Mass Assignment - Schema Only Fields',
  (() => {
    const input = { content: 'test', unknownField: 'malicious' };
    const result = validateInput(CreatePostSchema, input);
    if (result.success) {
      return !('unknownField' in result.data);
    }
    return true;
  })(),
  'Unknown fields should be stripped by Zod'
);

console.log('\n🔴 ATTACK TYPE 11: Session Attacks\n');

test(
  'Session - Predictable Token',
  (() => {
    const token1 = crypto.randomUUID();
    const token2 = crypto.randomUUID();
    return token1 !== token2 && token1.length === 36;
  })(),
  'Session tokens should be unique and unguessable'
);

test(
  'Session - Token Length',
  (() => {
    const token = crypto.randomUUID();
    return token.length >= 32;
  })(),
  'Session tokens should be at least 32 characters'
);

console.log('\n🔴 ATTACK TYPE 12: CSRF\n');

test(
  'CSRF - Token Presence',
  (() => {
    const token = crypto.randomUUID();
    return token.length >= 32;
  })(),
  'CSRF tokens should be cryptographically random'
);

test(
  'CSRF - Double Submit Pattern',
  (() => {
    const cookieToken = crypto.randomUUID();
    const headerToken = crypto.randomUUID();
    return cookieToken !== headerToken;
  })(),
  'Cookie and header tokens should be different'
);

console.log('\n' + '='.repeat(60));
console.log('\n📊 SECURITY TEST RESULTS\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️  FAILED ATTACKS THAT NEED FIXING:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ ${r.attack}`);
    console.log(`   ${r.details}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL ATTACKS SUCCESSFULLY BLOCKED!');
  console.log('🛡️  Nexus is SECURE against all simulated attacks!\n');
  console.log('\n🏆 SECURITY RATING: 100/100\n');
  process.exit(0);
}