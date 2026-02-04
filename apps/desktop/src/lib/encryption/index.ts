/**
 * Encryption module for E2E encrypted sync.
 *
 * @module lib/encryption
 */

export { EncryptionContext, globalEncryptionContext, getDeviceId } from './encryption-context';

// Field-level encryption for database operations
export {
  encryptSensitiveFields,
  decryptSensitiveFields,
  decryptSensitiveFieldsArray,
  isEncrypted,
  getEncryptedFields,
  ENCRYPTED_FIELDS,
} from './field-encryption';

// Recovery phrase for key backup
export {
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  formatRecoveryPhrase,
  parseRecoveryPhrase,
  isValidWord,
  getWordList,
} from './recovery-phrase';
