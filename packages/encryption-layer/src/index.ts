/**
 * End-to-end encryption layer for VoiceInvoice.
 * Provides AES-256-GCM encryption with HKDF-SHA256 key derivation.
 *
 * @module encryption-layer
 */

// Cryptographic operations
export { encrypt, decrypt, serializeEncrypted, deserializeEncrypted } from './crypto';
export type { EncryptedData } from './crypto';

// Key derivation
export { deriveEncryptionKey, deriveTenantId } from './key-derivation';
