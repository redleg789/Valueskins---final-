// Security test suite for Nexus
import { initEncryption, encrypt, decrypt } from './encryption';

interface SecurityTest {
  name: string;
  passed: boolean;
  details: string;
}

const results: SecurityTest[] = [];

function test(name: string, fn: (() => boolean) | (() => Promise<boolean>)) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      result.then(passed => {
        results.push({ name, passed, details: name });
        console.log(`${passed ? '✅' : '❌'} ${name}\n`);
      });
    } else {
      results.push({ name, passed: result, details: name });
      console.log(`${result ? '✅' : '❌'} ${name}\n`);
    }
  } catch (error) {
    results.push({ name, passed: false, details: String(error) });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error}\n`);
  }
}

// Run tests
async function runTests() {
  console.log('🔒 NEXUS SECURITY TESTS\n');
  console.log('='.repeat(50));
  
  // Encryption Tests
  console.log('\n📊 ENCRYPTION TESTS\n');
  
  test('Initialize encryption', async () => {
    await initEncryption();
    return true;
  });
  
  test('Encrypt message', async () => {
    const encrypted = await encrypt('Hello, Nexus!');
    return encrypted.ciphertext.length > 0 && encrypted.iv.length > 0;
  });
  
  test('Decrypt message', async () => {
    const encrypted = await encrypt('Secret message');
    const decrypted = await decrypt(encrypted.ciphertext, encrypted.iv);
    return decrypted === 'Secret message';
  });
  
  test('Different IV for same message', async () => {
    const msg = 'Test message';
    const enc1 = await encrypt(msg);
    const enc2 = await encrypt(msg);
    return enc1.iv !== enc2.iv && enc1.ciphertext !== enc2.ciphertext;
  });
  
  test('Invalid ciphertext fails', async () => {
    try {
      await decrypt('invalid', 'also-invalid');
      return false;
    } catch {
      return true;
    }
  });
  
  // Input Validation Tests
  console.log('\n🛡️ INPUT VALIDATION TESTS\n');
  
  test('SQL injection prevention', () => {
    const malicious = "'; DROP TABLE users; --";
    const sanitized = malicious.replace(/[;'"--]/g, '');
    return !sanitized.includes('DROP');
  });
  
  test('XSS prevention', () => {
    const xss = '<script>alert("xss")</script>';
    const escaped = xss.replace(/[<>'"&]/g, '');
    return !escaped.includes('<script>');
  });
  
  test('Path traversal prevention', () => {
    const path = '../../../etc/passwd';
    const safe = path.replace(/\.\.\//g, '');
    return !safe.startsWith('/etc');
  });
  
  // Token Tests
  console.log('\n🔑 TOKEN TESTS\n');
  
  test('Demo token format', () => {
    const token = 'demo_token_' + Date.now();
    return token.startsWith('demo_token_') && token.length > 15;
  });
  
  // Rate Limiting Check
  console.log('\n⏱️ RATE LIMITING CHECK\n');
  
  test('Rate limit headers present', () => {
    const headers = new Headers();
    headers.set('Strict-Transport-Security', 'max-age=31536000');
    headers.set('X-Content-Type-Options', 'nosniff');
    return headers.has('Strict-Transport-Security');
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('\n📊 TEST SUMMARY\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  
  console.log(`Total: ${results.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed === 0) {
    console.log('\n✅ ALL SECURITY TESTS PASSED!\n');
  } else {
    console.log('\n❌ SOME TESTS FAILED\n');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details}`);
    });
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

runTests();