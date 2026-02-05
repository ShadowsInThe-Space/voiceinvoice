import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, serializeEncrypted, deserializeEncrypted } from '../src/crypto';

describe('AES-256-GCM Encryption', () => {
  const testKey = new Uint8Array(32).fill(1); // Test key
  const plaintext = 'Sensitive invoice data: Müller GmbH, 1234.56 EUR';

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt data correctly', () => {
      const encrypted = encrypt(plaintext, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (random IV)', () => {
      const encrypted1 = encrypt(plaintext, testKey);
      const encrypted2 = encrypt(plaintext, testKey);

      expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    });

    it('should fail decryption with wrong key', () => {
      const encrypted = encrypt(plaintext, testKey);
      const wrongKey = new Uint8Array(32).fill(2);

      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });

    it('should handle UTF-8 characters (German Umlauts)', () => {
      const germanText = 'Größe: 5m², Preis: 1.234,56€';
      const encrypted = encrypt(germanText, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(germanText);
    });

    it('should handle empty string', () => {
      const encrypted = encrypt('', testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe('');
    });

    it('should handle long text', () => {
      const longText = 'A'.repeat(10000);
      const encrypted = encrypt(longText, testKey);
      const decrypted = decrypt(encrypted, testKey);

      expect(decrypted).toBe(longText);
    });

    it('should produce EncryptedData with correct structure', () => {
      const encrypted = encrypt(plaintext, testKey);

      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.iv.length).toBe(12); // GCM standard IV size
      expect(encrypted.tag.length).toBe(16); // GCM auth tag size
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize encrypted data', () => {
      const encrypted = encrypt(plaintext, testKey);
      const serialized = serializeEncrypted(encrypted);
      const deserialized = deserializeEncrypted(serialized);

      expect(deserialized.iv).toEqual(encrypted.iv);
      expect(deserialized.ciphertext).toEqual(encrypted.ciphertext);
      expect(deserialized.tag).toEqual(encrypted.tag);
    });

    it('should produce base64 encoded string', () => {
      const encrypted = encrypt(plaintext, testKey);
      const serialized = serializeEncrypted(encrypted);

      // Base64 pattern: alphanumeric + / + optional = padding
      expect(serialized).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it('should roundtrip encrypt -> serialize -> deserialize -> decrypt', () => {
      const encrypted = encrypt(plaintext, testKey);
      const serialized = serializeEncrypted(encrypted);
      const deserialized = deserializeEncrypted(serialized);
      const decrypted = decrypt(deserialized, testKey);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('tamper detection', () => {
    it('should detect tampered ciphertext', () => {
      const encrypted = encrypt(plaintext, testKey);
      // Tamper with ciphertext
      encrypted.ciphertext[0] ^= 0xff;

      expect(() => decrypt(encrypted, testKey)).toThrow();
    });

    it('should detect tampered IV', () => {
      const encrypted = encrypt(plaintext, testKey);
      // Tamper with IV
      encrypted.iv[0] ^= 0xff;

      expect(() => decrypt(encrypted, testKey)).toThrow();
    });

    it('should detect tampered tag', () => {
      const encrypted = encrypt(plaintext, testKey);
      // Tamper with auth tag
      encrypted.tag[0] ^= 0xff;

      expect(() => decrypt(encrypted, testKey)).toThrow();
    });
  });
});
