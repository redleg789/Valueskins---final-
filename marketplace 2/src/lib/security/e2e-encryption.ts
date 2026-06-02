import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export interface EncryptedData {
  iv: string;
  encryptedData: string;
  authTag: string;
}

export interface KeyPair {
  publicKey: string;
  privateKey: string;
}

export interface MessageKey {
  key: string;
  createdAt: string;
  expiresAt: string;
}

const keyCache = new Map<string, string>();

export function generateKeyPair(): KeyPair {
  const privateKey = crypto.randomBytes(KEY_LENGTH).toString('base64');
  const publicKey = crypto.createHash('sha256').update(privateKey).digest('base64');
  return { publicKey, privateKey };
}

function getOrCreateKey(conversationId: string): Buffer {
  let keyBase64 = keyCache.get(conversationId);
  if (!keyBase64) {
    keyBase64 = crypto.randomBytes(KEY_LENGTH).toString('base64');
    keyCache.set(conversationId, keyBase64);
  }
  return Buffer.from(keyBase64, 'base64');
}

export function encryptMessage(
  content: string,
  conversationId: string
): EncryptedData {
  const keyBuffer = getOrCreateKey(conversationId);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(content, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    encryptedData: encrypted,
    authTag: authTag.toString('base64'),
  };
}

export function decryptMessage(
  encryptedData: EncryptedData,
  conversationId: string
): string {
  const keyBuffer = getOrCreateKey(conversationId);
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function encryptForStorage(
  content: string,
  key?: string
): EncryptedData {
  const keyBuffer = key 
    ? Buffer.from(key, 'base64')
    : crypto.randomBytes(KEY_LENGTH);
  
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(content, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString('base64'),
    encryptedData: encrypted,
    authTag: authTag.toString('base64'),
  };
}

export function decryptFromStorage(
  encryptedData: EncryptedData,
  key: string
): string {
  const keyBuffer = Buffer.from(key, 'base64');
  const iv = Buffer.from(encryptedData.iv, 'base64');
  const authTag = Buffer.from(encryptedData.authTag, 'base64');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData.encryptedData, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export function generateMessageKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function verifyKeyPair(keyPair: KeyPair): boolean {
  try {
    const derivedPubKey = crypto.createHash('sha256')
      .update(keyPair.privateKey)
      .digest('base64');
    return derivedPubKey === keyPair.publicKey;
  } catch {
    return false;
  }
}

export function encryptMessageBatch(
  messages: { id: string; content: string; conversationId: string }[]
): Map<string, EncryptedData> {
  const encrypted = new Map<string, EncryptedData>();
  
  for (const msg of messages) {
    encrypted.set(msg.id, encryptMessage(msg.content, msg.conversationId));
  }

  return encrypted;
}

export function decryptMessageBatch(
  messages: { id: string; encrypted: EncryptedData; conversationId: string }[]
): Map<string, string> {
  const decrypted = new Map<string, string>();
  
  for (const msg of messages) {
    try {
      decrypted.set(msg.id, decryptMessage(msg.encrypted, msg.conversationId));
    } catch (e) {
      decrypted.set(msg.id, '[Decryption failed]');
    }
  }

  return decrypted;
}

export function createConversationKey(conversationId: string): MessageKey {
  const key = crypto.randomBytes(KEY_LENGTH).toString('base64');
  keyCache.set(conversationId, key);
  
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    key,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

export function isKeyExpired(key: MessageKey): boolean {
  return new Date(key.expiresAt) < new Date();
}

export function rotateKey(conversationId: string): MessageKey {
  const newKey = crypto.randomBytes(KEY_LENGTH).toString('base64');
  keyCache.set(conversationId, newKey);
  
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  return {
    key: newKey,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  };
}

export function setSharedKey(conversationId: string, key: string): void {
  keyCache.set(conversationId, key);
}

export function getSharedKey(conversationId: string): string | undefined {
  return keyCache.get(conversationId);
}

export function deleteSharedKey(conversationId: string): void {
  keyCache.delete(conversationId);
}

export function clearKeyCache(): void {
  keyCache.clear();
}