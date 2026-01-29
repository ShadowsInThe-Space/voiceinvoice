import { safeStorage, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

function getSecretsPath(): string {
  return path.join(app.getPath('userData'), 'secrets.json');
}

/**
 * Retrieves the API key from secure storage.
 * @returns {Promise<string>} The API key or empty string if not found/error
 */
export async function getApiKeyHandler(): Promise<string> {
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('safeStorage is not available. Falling back to plaintext file storage.');
    return getPlaintextApiKey();
  }

  const secretsPath = getSecretsPath();

  try {
    if (!fs.existsSync(secretsPath)) return '';

    const content = fs.readFileSync(secretsPath, 'utf-8');
    let data;
    try {
      data = JSON.parse(content);
    } catch {
      return '';
    }

    if (!data.apiKey) return '';

    // Check if it's stored as base64 (encrypted)
    if (data.encrypted) {
      const buffer = Buffer.from(data.apiKey, 'base64');
      return safeStorage.decryptString(buffer);
    }

    // Fallback for transition or plaintext
    return data.apiKey;
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return '';
  }
}

/**
 * Saves the API key to secure storage.
 * @param {string} apiKey - The API key to save
 * @returns {Promise<boolean>} True if successful
 */
export async function setApiKeyHandler(apiKey: string): Promise<boolean> {
  try {
    const data: { apiKey: string; encrypted: boolean } = {
      apiKey: apiKey,
      encrypted: false
    };

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(apiKey);
      data.apiKey = encrypted.toString('base64');
      data.encrypted = true;
    } else {
      console.warn('safeStorage is not available. Saving as plaintext.');
    }

    const secretsPath = getSecretsPath();
    // Ensure directory exists
    const dir = path.dirname(secretsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(secretsPath, JSON.stringify(data), 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save API key:', error);
    return false;
  }
}

function getPlaintextApiKey(): string {
  try {
    const secretsPath = getSecretsPath();
    if (!fs.existsSync(secretsPath)) return '';
    const content = fs.readFileSync(secretsPath, 'utf-8');
    const data = JSON.parse(content);
    return data.apiKey || '';
  } catch {
    return '';
  }
}
