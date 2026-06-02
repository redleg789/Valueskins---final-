import {
  generateKeyPair,
  encryptMessage,
  decryptMessage,
  encryptForStorage,
  decryptFromStorage,
  generateMessageKey,
  hashKey,
  verifyKeyPair,
  encryptMessageBatch,
  decryptMessageBatch,
  createConversationKey,
  isKeyExpired,
  rotateKey,
  setSharedKey,
  getSharedKey,
  deleteSharedKey,
  EncryptedData,
} from './e2e-encryption';

console.log('🛡️  E2E ENCRYPTION TESTS\n');
console.log('='.repeat(45));

const results: { test: string; passed: boolean; details: string }[] = [];

function test(name: string, passed: boolean, details: string) {
  results.push({ test: name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name}`);
  console.log(`   ${details}\n`);
}

console.log('\n🔑 KEY PAIR GENERATION\n');

test(
  'Generate Valid Key Pair',
  (() => {
    const keyPair = generateKeyPair();
    return keyPair.publicKey.length > 0 && keyPair.privateKey.length > 0;
  })(),
  'Should generate key pair'
);

test(
  'Key Pair Format',
  (() => {
    const keyPair = generateKeyPair();
    return verifyKeyPair(keyPair);
  })(),
  'Key pair should be valid'
);

test(
  'Keys Are Unique',
  (() => {
    const keyPair1 = generateKeyPair();
    const keyPair2 = generateKeyPair();
    return keyPair1.publicKey !== keyPair2.publicKey &&
           keyPair1.privateKey !== keyPair2.privateKey;
  })(),
  'Each key pair should be unique'
);

console.log('\n🔐 MESSAGE ENCRYPTION/DECRYPTION\n');

test(
  'Encrypt Message',
  (() => {
    const convId = 'conv-' + Date.now();
    const encrypted = encryptMessage('Hello Bob!', convId);
    return encrypted.encryptedData.length > 0 && 
           encrypted.iv.length > 0 && 
           encrypted.authTag.length > 0;
  })(),
  'Should encrypt message with conversation key'
);

test(
  'Decrypt Message Roundtrip',
  (() => {
    const convId = 'conv2-' + Date.now();
    const original = 'Secret message';
    const encrypted = encryptMessage(original, convId);
    const decrypted = decryptMessage(encrypted, convId);
    return decrypted === original;
  })(),
  'Should encrypt/decrypt message roundtrip'
);

test(
  'Decryption Fails Wrong Conversation',
  (() => {
    try {
      const convId1 = 'conv3-' + Date.now();
      const convId2 = 'conv4-' + Date.now();
      const encrypted = encryptMessage('Secret', convId1);
      decryptMessage(encrypted, convId2);
      return false;
    } catch {
      return true;
    }
  })(),
  'Decryption should fail with wrong conversation key'
);

test(
  'Encrypt Empty Message',
  (() => {
    const convId = 'conv5-' + Date.now();
    const encrypted = encryptMessage('', convId);
    const decrypted = decryptMessage(encrypted, convId);
    return decrypted === '';
  })(),
  'Should handle empty message'
);

test(
  'Encrypt Long Message',
  (() => {
    const convId = 'conv6-' + Date.now();
    const longMessage = 'A'.repeat(10000);
    const encrypted = encryptMessage(longMessage, convId);
    const decrypted = decryptMessage(encrypted, convId);
    return decrypted === longMessage;
  })(),
  'Should handle messages up to 10KB'
);

test(
  'Encrypt Special Characters',
  (() => {
    const convId = 'conv7-' + Date.now();
    const message = 'Hello 🌍! Emoji + special chars: @#$%^&*()';
    const encrypted = encryptMessage(message, convId);
    const decrypted = decryptMessage(encrypted, convId);
    return decrypted === message;
  })(),
  'Should handle emoji and special characters'
);

test(
  'Encrypt Unicode',
  (() => {
    const convId = 'conv8-' + Date.now();
    const message = '你好世界🌏 مرحباالعالم 🌍';
    const encrypted = encryptMessage(message, convId);
    const decrypted = decryptMessage(encrypted, convId);
    return decrypted === message;
  })(),
  'Should handle multi-language unicode'
);

test(
  'Shared Key Persists',
  (() => {
    const convId = 'conv9-' + Date.now();
    encryptMessage('Hello', convId);
    return getSharedKey(convId) !== undefined;
  })(),
  'Shared key should be stored for conversation'
);

test(
  'Delete Shared Key',
  (() => {
    const convId = 'conv10-' + Date.now();
    setSharedKey(convId, 'test-key');
    deleteSharedKey(convId);
    return getSharedKey(convId) === undefined;
  })(),
  'Should delete shared key'
);

console.log('\n💾 STORAGE ENCRYPTION\n');

test(
  'Encrypt For Storage',
  (() => {
    const encrypted = encryptForStorage('Stored secret data');
    return encrypted.encryptedData.length > 0;
  })(),
  'Should encrypt data for storage'
);

test(
  'Decrypt From Storage',
  (() => {
    const original = 'My secret note';
    const key = generateMessageKey();
    const encrypted = encryptForStorage(original, key);
    const decrypted = decryptFromStorage(encrypted, key);
    return decrypted === original;
  })(),
  'Should decrypt with correct key'
);

test(
  'Storage Encryption Fails Wrong Key',
  (() => {
    try {
      const encrypted = encryptForStorage('Secret', 'correct-key');
      decryptFromStorage(encrypted, 'wrong-key');
      return false;
    } catch {
      return true;
    }
  })(),
  'Should fail with wrong storage key'
);

console.log('\n🔢 KEY GENERATION\n');

test(
  'Generate Secure Message Key',
  (() => {
    const key = generateMessageKey();
    return key.length === 44;
  })(),
  'Message key should be 32 bytes base64'
);

test(
  'Hash Key',
  (() => {
    const key = 'test-key-123';
    const hashed = hashKey(key);
    return hashed.length === 64;
  })(),
  'Key hash should be SHA-256 hex'
);

test(
  'Hash Produces Consistent Output',
  (() => {
    const key = 'my-secret-key';
    const hash1 = hashKey(key);
    const hash2 = hashKey(key);
    return hash1 === hash2;
  })(),
  'Same key should produce same hash'
);

console.log('\n📦 BATCH OPERATIONS\n');

test(
  'Batch Encrypt',
  (() => {
    const convId = 'batch-conv-' + Date.now();
    const messages = [
      { id: '1', content: 'Message 1', conversationId: convId },
      { id: '2', content: 'Message 2', conversationId: convId },
      { id: '3', content: 'Message 3', conversationId: convId },
    ];
    const encrypted = encryptMessageBatch(messages);
    return encrypted.size === 3 && encrypted.get('1')!.encryptedData.length > 0;
  })(),
  'Should batch encrypt messages'
);

test(
  'Batch Decrypt',
  (() => {
    const convId = 'batch2-conv-' + Date.now();
    const messages = [
      { id: '1', content: 'First', conversationId: convId },
      { id: '2', content: 'Second', conversationId: convId },
    ];
    const encrypted = encryptMessageBatch(messages);
    const encryptedList = Array.from(encrypted.entries()).map(([id, data]) => ({
      id,
      encrypted: data,
      conversationId: convId,
    }));
    const decrypted = decryptMessageBatch(encryptedList);
    return decrypted.get('1') === 'First' && decrypted.get('2') === 'Second';
  })(),
  'Should batch decrypt messages'
);

console.log('\n🔒 SECURITY PROPERTIES\n');

test(
  'Encrypted Output Is Random',
  (() => {
    const convId = 'random-conv-' + Date.now();
    const encrypted1 = encryptMessage('Same text', convId);
    const encrypted2 = encryptMessage('Same text', convId);
    return encrypted1.encryptedData !== encrypted2.encryptedData &&
           encrypted1.iv !== encrypted2.iv;
  })(),
  'Same plaintext should produce different ciphertext'
);

test(
  'No Plaintext In Encrypted',
  (() => {
    const convId = 'plain-conv-' + Date.now();
    const encrypted = encryptMessage('SECRET_PASSWORD_123', convId);
    return !encrypted.encryptedData.includes('SECRET') &&
           !encrypted.encryptedData.includes('PASSWORD');
  })(),
  'Encrypted data should not contain plaintext'
);

test(
  'IV Is Random Each Time',
  (() => {
    const key = generateMessageKey();
    const enc1 = encryptForStorage('test', key);
    const enc2 = encryptForStorage('test', key);
    return enc1.iv !== enc2.iv;
  })(),
  'Each encryption should use unique IV'
);

test(
  'Auth Tag Validates Tampering',
  (() => {
    try {
      const key = generateMessageKey();
      const encrypted = encryptForStorage('Original', key);
      const tampered = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -2) + 'XX',
      };
      decryptFromStorage(tampered, key);
      return false;
    } catch {
      return true;
    }
  })(),
  'Should detect tampered encrypted data'
);

console.log('\n🔑 CONVERSATION KEYS\n');

test(
  'Create Conversation Key',
  (() => {
    const convId = 'key-conv-' + Date.now();
    const key = createConversationKey(convId);
    return key.key.length > 0 && key.expiresAt.length > 0;
  })(),
  'Should create key with expiry'
);

test(
  'Key Expiry Check',
  (() => {
    const convId = 'exp-conv-' + Date.now();
    const key = createConversationKey(convId);
    return !isKeyExpired(key);
  })(),
  'New key should not be expired'
);

test(
  'Key Rotation',
  (() => {
    const convId = 'rotate-conv-' + Date.now();
    const oldKey = createConversationKey(convId);
    const newKey = rotateKey(convId);
    return oldKey.key !== newKey.key;
  })(),
  'Rotated key should be different'
);

console.log('\n' + '='.repeat(45));
console.log('\n📊 ENCRYPTION TEST RESULTS\n');

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`Total Tests: ${total}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

if (failed > 0) {
  console.log('\n⚠️  FAILED TESTS:\n');
  results.filter(r => !r.passed).forEach(r => {
    console.log(`❌ ${r.test}`);
    console.log(`   ${r.details}\n`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL ENCRYPTION TESTS PASSED!');
  console.log('🛡️  End-to-end encryption is working!\n');
  process.exit(0);
}