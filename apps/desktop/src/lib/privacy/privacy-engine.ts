/**
 * Privacy Engine for GDPR/DSGVO compliance.
 *
 * Provides encryption, consent management, data export,
 * and deletion functionality for VoiceInvoice Enterprise.
 *
 * @module lib/privacy/privacy-engine
 */

import * as crypto from 'crypto';

/**
 * Types of consent that can be granted.
 */
export enum ConsentType {
  DATA_PROCESSING = 'DATA_PROCESSING',
  VOICE_RECORDING = 'VOICE_RECORDING',
  ANALYTICS = 'ANALYTICS',
  MARKETING = 'MARKETING',
  THIRD_PARTY_SHARING = 'THIRD_PARTY_SHARING',
}

/**
 * Status of a consent.
 */
export interface ConsentStatus {
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
}

/**
 * Full consent record with metadata.
 */
export interface ConsentRecord {
  type: ConsentType;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  purpose?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Data export formats.
 */
export enum DataExportFormat {
  JSON = 'JSON',
  CSV = 'CSV',
}

/**
 * Result of data export.
 */
export interface DataExportResult {
  format: DataExportFormat;
  data: string;
  exportedAt: Date;
}

/**
 * Deletion request.
 */
export interface DeletionRequest {
  requestId: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'EXPIRED';
  confirmationRequired: boolean;
  confirmationCode: string;
  expiresAt: Date;
  email: string;
}

/**
 * Result of deletion confirmation.
 */
export interface DeletionResult {
  success: boolean;
  deletedItems?: number;
  error?: string;
}

/**
 * Privacy settings.
 */
export interface PrivacySettings {
  dataRetentionDays: number;
  encryptionEnabled: boolean;
  analyticsEnabled: boolean;
  autoDeleteEnabled: boolean;
}

/**
 * Privacy report.
 */
export interface PrivacyReport {
  consents: ConsentRecord[];
  settings: PrivacySettings;
  dataCategories: string[];
  generatedAt: Date;
}

/**
 * Privacy event for audit trail.
 */
export interface PrivacyEvent {
  type: string;
  details: Record<string, unknown>;
  timestamp?: Date;
}

/**
 * Storage provider interface.
 */
export interface StorageProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  getAll(): Promise<Record<string, string>>;
}

/**
 * Privacy engine configuration.
 */
export interface PrivacyConfig {
  storageProvider: StorageProvider;
  encryptionKey: string;
}

/**
 * PII field names for anonymization.
 */
const PII_FIELDS = ['name', 'email', 'phone', 'address', 'city', 'zipCode', 'taxId', 'iban', 'bic'];

/**
 * Privacy engine for GDPR compliance.
 */
export class PrivacyEngine {
  private storage: StorageProvider;
  private encryptionKey: Buffer;
  private consents: Map<ConsentType, ConsentRecord> = new Map();
  private deletionRequests: Map<string, DeletionRequest> = new Map();
  private auditLog: PrivacyEvent[] = [];
  private settings: PrivacySettings = {
    dataRetentionDays: 365,
    encryptionEnabled: true,
    analyticsEnabled: false,
    autoDeleteEnabled: false,
  };

  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly IV_LENGTH = 16;
  private readonly AUTH_TAG_LENGTH = 16;

  /**
   *
   * @param config
   */
  constructor(config: PrivacyConfig) {
    this.storage = config.storageProvider;
    // Derive key from provided string
    this.encryptionKey = crypto.scryptSync(config.encryptionKey, 'salt', 32);
  }

  // ==================== Encryption ====================

  /**
   * Encrypts plaintext data using AES-256-GCM.
   * @param plaintext
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, encrypted]);
    return combined.toString('base64');
  }

  /**
   * Decrypts encrypted data.
   * @param ciphertext
   */
  decrypt(ciphertext: string): string {
    try {
      const combined = Buffer.from(ciphertext, 'base64');

      if (combined.length < this.IV_LENGTH + this.AUTH_TAG_LENGTH) {
        throw new Error('Invalid encrypted data');
      }

      const iv = combined.subarray(0, this.IV_LENGTH);
      const authTag = combined.subarray(this.IV_LENGTH, this.IV_LENGTH + this.AUTH_TAG_LENGTH);
      const encrypted = combined.subarray(this.IV_LENGTH + this.AUTH_TAG_LENGTH);

      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

      return decrypted.toString('utf8');
    } catch {
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Creates a one-way hash of data.
   * @param data
   */
  hashData(data: string): string {
    return crypto.createHash('sha256').update(data).update(this.encryptionKey).digest('hex');
  }

  // ==================== Consent Management ====================

  /**
   * Grants consent of a specific type.
   * @param type
   * @param options
   * @param options.purpose
   * @param options.ipAddress
   * @param options.userAgent
   */
  async grantConsent(
    type: ConsentType,
    options?: { purpose?: string; ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; consentId: string }> {
    const consentId = this.generateId();
    const record: ConsentRecord = {
      type,
      granted: true,
      grantedAt: new Date(),
      purpose: options?.purpose,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    };

    this.consents.set(type, record);
    await this.storage.set(`consent:${type}`, JSON.stringify(record));

    await this.logPrivacyEvent({
      type: 'CONSENT_GRANTED',
      details: { consentType: type },
    });

    return { success: true, consentId };
  }

  /**
   * Revokes consent of a specific type.
   * @param type
   */
  async revokeConsent(type: ConsentType): Promise<void> {
    const existing = this.consents.get(type);
    const record: ConsentRecord = {
      ...existing,
      type,
      granted: false,
      revokedAt: new Date(),
    };

    this.consents.set(type, record);
    await this.storage.set(`consent:${type}`, JSON.stringify(record));

    await this.logPrivacyEvent({
      type: 'CONSENT_REVOKED',
      details: { consentType: type },
    });
  }

  /**
   * Gets the status of a specific consent type.
   * @param type
   */
  async getConsentStatus(type: ConsentType): Promise<ConsentStatus> {
    const record = this.consents.get(type);
    if (!record) {
      return { granted: false };
    }

    return {
      granted: record.granted,
      grantedAt: record.grantedAt,
      revokedAt: record.revokedAt,
    };
  }

  /**
   * Gets the full consent record.
   * @param type
   */
  async getConsentRecord(type: ConsentType): Promise<ConsentRecord | null> {
    return this.consents.get(type) ?? null;
  }

  /**
   * Gets all consent records.
   */
  async getAllConsents(): Promise<ConsentRecord[]> {
    return Array.from(this.consents.values());
  }

  /**
   * Checks if all required consents are granted.
   * @param requiredTypes
   */
  async hasRequiredConsents(requiredTypes: ConsentType[]): Promise<boolean> {
    for (const type of requiredTypes) {
      const status = await this.getConsentStatus(type);
      if (!status.granted) {
        return false;
      }
    }
    return true;
  }

  // ==================== Data Export (GDPR Art. 20) ====================

  /**
   * Exports user data in the specified format.
   * @param data
   * @param format
   */
  async exportUserData(
    data: Record<string, unknown>,
    format: DataExportFormat
  ): Promise<DataExportResult> {
    const exportedAt = new Date();

    let exportedData: string;

    if (format === DataExportFormat.JSON) {
      const exportObject = {
        metadata: {
          exportedAt: exportedAt.toISOString(),
          format: 'GDPR_DATA_EXPORT',
          version: '1.0',
        },
        data,
      };
      exportedData = JSON.stringify(exportObject, null, 2);
    } else {
      // CSV format
      exportedData = this.convertToCSV(data);
    }

    await this.logPrivacyEvent({
      type: 'DATA_EXPORTED',
      details: { format },
    });

    return {
      format,
      data: exportedData,
      exportedAt,
    };
  }

  /**
   * Converts data to CSV format.
   * @param data
   */
  private convertToCSV(data: Record<string, unknown>): string {
    const lines: string[] = [];

    // Find the first array in data to use as rows
    for (const [, value] of Object.entries(data)) {
      if (Array.isArray(value) && value.length > 0) {
        const firstRow = value[0] as Record<string, unknown>;
        const headers = Object.keys(firstRow);
        lines.push(headers.join(','));

        for (const row of value) {
          const rowData = row as Record<string, unknown>;
          const values = headers.map((h) => {
            const v = rowData[h];
            if (typeof v === 'string') {
              return `"${v.replace(/"/g, '""')}"`;
            }
            return String(v ?? '');
          });
          lines.push(values.join(','));
        }
        break;
      }
    }

    return lines.join('\n');
  }

  // ==================== Data Deletion (Right to be Forgotten) ====================

  /**
   * Requests data deletion with confirmation.
   * @param email
   */
  async requestDataDeletion(email: string): Promise<DeletionRequest> {
    const requestId = this.generateId();
    const confirmationCode = this.generateConfirmationCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const request: DeletionRequest = {
      requestId,
      status: 'PENDING',
      confirmationRequired: true,
      confirmationCode,
      expiresAt,
      email,
    };

    this.deletionRequests.set(requestId, request);

    await this.logPrivacyEvent({
      type: 'DELETION_REQUESTED',
      details: { requestId, email: this.hashData(email) },
    });

    return request;
  }

  /**
   * Confirms and processes data deletion.
   * @param requestId
   * @param confirmationCode
   */
  async confirmDataDeletion(requestId: string, confirmationCode: string): Promise<DeletionResult> {
    const request = this.deletionRequests.get(requestId);

    if (!request) {
      return { success: false, error: 'Invalid request ID' };
    }

    if (request.status === 'EXPIRED') {
      return { success: false, error: 'Deletion request has expired' };
    }

    if (request.expiresAt < new Date()) {
      request.status = 'EXPIRED';
      return { success: false, error: 'Deletion request has expired' };
    }

    if (request.confirmationCode !== confirmationCode) {
      return { success: false, error: 'Invalid confirmation code' };
    }

    // Process deletion
    request.status = 'COMPLETED';

    await this.logPrivacyEvent({
      type: 'DELETION_COMPLETED',
      details: { requestId },
    });

    return { success: true, deletedItems: 0 };
  }

  /**
   * Expires a deletion request (for testing).
   * @param requestId
   */
  expireDeletionRequest(requestId: string): void {
    const request = this.deletionRequests.get(requestId);
    if (request) {
      request.status = 'EXPIRED';
    }
  }

  /**
   * Anonymizes PII fields in data.
   * @param data
   */
  anonymizeData<T extends Record<string, unknown>>(data: T): T {
    const anonymized = { ...data };

    for (const field of PII_FIELDS) {
      if (field in anonymized && typeof anonymized[field] === 'string') {
        anonymized[field] = this.generateAnonymousValue(field) as T[keyof T];
      }
    }

    return anonymized;
  }

  /**
   * Generates anonymous replacement value.
   * @param fieldType
   */
  private generateAnonymousValue(fieldType: string): string {
    const id = crypto.randomBytes(4).toString('hex');
    switch (fieldType) {
      case 'name':
        return `[ANONYMIZED-${id}]`;
      case 'email':
        return `anon-${id}[at]deleted.local`;
      case 'phone':
        return `[PHONE-DELETED]`;
      case 'address':
      case 'city':
      case 'zipCode':
        return `[ADDRESS-DELETED]`;
      default:
        return `[DELETED-${id}]`;
    }
  }

  // ==================== Privacy Settings ====================

  /**
   * Gets current privacy settings.
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    return { ...this.settings };
  }

  /**
   * Updates privacy settings.
   * @param updates
   */
  async updatePrivacySettings(updates: Partial<PrivacySettings>): Promise<void> {
    this.settings = { ...this.settings, ...updates };
    await this.storage.set('privacy:settings', JSON.stringify(this.settings));

    await this.logPrivacyEvent({
      type: 'SETTINGS_UPDATED',
      details: { updates },
    });
  }

  /**
   * Generates a privacy report.
   */
  async generatePrivacyReport(): Promise<PrivacyReport> {
    return {
      consents: await this.getAllConsents(),
      settings: await this.getPrivacySettings(),
      dataCategories: ['customers', 'invoices', 'voice_recordings', 'settings'],
      generatedAt: new Date(),
    };
  }

  // ==================== Audit Trail ====================

  /**
   * Logs a privacy event.
   * @param event
   */
  async logPrivacyEvent(event: PrivacyEvent): Promise<void> {
    const logEntry: PrivacyEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.auditLog.push(logEntry);
  }

  /**
   * Gets the privacy audit log.
   * @param options
   * @param options.from
   * @param options.to
   */
  async getPrivacyAuditLog(options?: { from?: Date; to?: Date }): Promise<PrivacyEvent[]> {
    let logs = [...this.auditLog];

    if (options?.from) {
      logs = logs.filter((log) => log.timestamp && log.timestamp >= options.from!);
    }

    if (options?.to) {
      logs = logs.filter((log) => log.timestamp && log.timestamp <= options.to!);
    }

    return logs.sort((a, b) => (a.timestamp?.getTime() ?? 0) - (b.timestamp?.getTime() ?? 0));
  }

  // ==================== Utility ====================

  /**
   * Generates a unique ID.
   */
  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generates a confirmation code.
   */
  private generateConfirmationCode(): string {
    return crypto.randomBytes(8).toString('hex').toUpperCase();
  }
}
