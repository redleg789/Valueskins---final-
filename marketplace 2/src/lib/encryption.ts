// E2E Encryption utilities using Web Crypto API
// AES-256-GCM for message encryption

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;

export async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importKey(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMessage(message: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode(...iv))
  };
}

export async function decryptMessage(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
  const ciphertextData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const ivData = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivData },
    key,
    ciphertextData
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

export async function deriveSharedKey(privateKey: CryptoKey, publicKey: CryptoKey): Promise<CryptoKey> {
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256
  );
  
  return await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: ALGORITHM, length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('spki', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

export async function importPublicKey(keyString: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyString), c => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'spki',
    keyData,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

// Session key management
class EncryptionSession {
  private symmetricKey: CryptoKey | null = null;
  private privateKey: CryptoKeyPair | null = null;
  private publicKey: CryptoKey | null = null;
  
  async initialize(): Promise<string> {
    this.privateKey = await generateKeyPair();
    this.publicKey = this.privateKey.publicKey;
    this.symmetricKey = await generateKey();
    return await exportKey(this.symmetricKey);
  }
  
  async getPublicKey(): Promise<string> {
    if (!this.publicKey) throw new Error('Session not initialized');
    return await exportPublicKey(this.publicKey);
  }
  
  async encrypt(message: string): Promise<{ ciphertext: string; iv: string }> {
    if (!this.symmetricKey) throw new Error('Session not initialized');
    return await encryptMessage(message, this.symmetricKey);
  }
  
  async decrypt(ciphertext: string, iv: string): Promise<string> {
    if (!this.symmetricKey) throw new Error('Session not initialized');
    return await decryptMessage(ciphertext, iv, this.symmetricKey);
  }
  
  isInitialized(): boolean {
    return this.symmetricKey !== null;
  }
}

// Singleton instance
let session: EncryptionSession | null = null;

export async function initEncryption(): Promise<string> {
  if (!session) {
    session = new EncryptionSession();
  }
  return await session.initialize();
}

export async function getPublicKey(): Promise<string> {
  if (!session) throw new Error('Encryption not initialized');
  return await session.getPublicKey();
}

export async function encrypt(message: string): Promise<{ ciphertext: string; iv: string }> {
  if (!session || !session.isInitialized()) {
    await initEncryption();
  }
  return await session!.encrypt(message);
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  if (!session || !session.isInitialized()) {
    await initEncryption();
  }
  return await session!.decrypt(ciphertext, iv);
}

export function isEncryptionReady(): boolean {
  return session !== null && session.isInitialized();
}