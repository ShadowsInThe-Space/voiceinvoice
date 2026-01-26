/**
 * Core type definitions for VoiceInvoice Enterprise.
 *
 * This module contains all shared TypeScript interfaces and types
 * used across the desktop application and proxy server.
 *
 * @module types
 */

/**
 * Customer type classification for accounting purposes.
 *
 * - CUSTOMER: Clients who receive invoices
 * - SUPPLIER: Vendors who send invoices
 * - BOTH: Entities that act as both customer and supplier
 */
export type CustomerType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';

/**
 * Invoice status throughout its lifecycle.
 *
 * - DRAFT: Initial state, not yet finalized
 * - PENDING: Sent to customer, awaiting payment
 * - PAID: Payment received and confirmed
 * - CANCELLED: Invoice was cancelled/voided
 * - OVERDUE: Payment deadline has passed
 */
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PENDING' | 'PAID' | 'CANCELLED' | 'OVERDUE';

/**
 * Supported tax rates in Germany.
 *
 * - 0: Export/tax-exempt transactions
 * - 7: Reduced rate (food, books, etc.)
 * - 19: Standard rate
 */
export type TaxRate = 0 | 7 | 19;

/**
 * Privacy mode configuration for data handling.
 *
 * - STRICT: Full anonymization, no raw data stored
 * - STANDARD: Balanced privacy with audit capability
 * - MINIMAL: Basic privacy, optimized for usability
 */
export type PrivacyMode = 'STRICT' | 'STANDARD' | 'MINIMAL';

/**
 * License status for the application.
 *
 * - TRIAL: Free trial period
 * - ACTIVE: Valid paid license
 * - EXPIRED: License has expired
 * - INVALID: License validation failed
 */
export type LicenseStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'INVALID';

/**
 * Represents a customer or supplier entity.
 *
 * Contains all business contact information and tax-relevant
 * identifiers required for German accounting standards.
 */
export interface Customer {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Classification of the business relationship */
  type: CustomerType;

  /** Legal company name */
  companyName: string;

  /** Primary contact person's name */
  contactPerson?: string;

  /** Business email address */
  email?: string;

  /** Phone number with country code */
  phone?: string;

  /** German tax number (Steuernummer) */
  taxNumber?: string;

  /** EU VAT identification number */
  vatId?: string;

  /** Bank account IBAN */
  iban?: string;

  /** Bank identifier code (BIC/SWIFT) */
  bic?: string;

  /** Street address including house number */
  street?: string;

  /** Postal/ZIP code */
  zip?: string;

  /** City name */
  city?: string;

  /** ISO 3166-1 alpha-2 country code */
  country: string;

  /** Token for privacy-preserving customer reference */
  anonymizedToken?: string;

  /** Record creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;
}

/**
 * Represents a single line item on an invoice.
 *
 * Contains description, quantity, and pricing information
 * for individual products or services.
 */
export interface InvoiceItem {
  /** Unique identifier (UUID v4) */
  id?: string;

  /** Item description */
  description: string;

  /** Quantity of items */
  quantity: number;

  /** Unit of measurement (e.g., 'Stück', 'Stunde') */
  unit?: string;

  /** Price per unit before tax */
  unitPrice: number;

  /** Total amount for this line item (quantity * unitPrice) */
  totalPrice?: number;
}

/**
 * Represents an invoice document.
 *
 * Contains all fields required for legally compliant invoicing
 * in Germany, including voice recording references for the
 * voice-first workflow.
 */
export interface Invoice {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Sequential invoice number (must be unique) */
  invoiceNumber: string;

  /** Reference to the customer entity */
  customerId: string;

  /** Reference to the category for classification */
  categoryId?: string;

  /** Invoice issue date */
  date: Date;

  /** Payment due date */
  dueDate?: Date;

  /** Net amount before tax in EUR */
  netAmount: number;

  /** Applied tax rate (0, 7, or 19) */
  taxRate: TaxRate;

  /** Calculated tax amount */
  taxAmount: number;

  /** Total amount including tax */
  grossAmount: number;

  /** Currency code (default: EUR) */
  currency: string;

  /** Current invoice status */
  status: InvoiceStatus;

  /** Human-readable description or notes */
  description?: string;

  /** Line items on the invoice */
  items?: InvoiceItem[];

  /** Reference to the source voice recording */
  recordingId?: string;

  /** Transcribed text from voice recording */
  transcription?: string;

  /** AI-enriched structured data (JSON string) */
  enrichedData?: string;

  /** Reference to matched bank transaction */
  bankTransactionId?: string;

  /** Record creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;
}

/**
 * Represents a voice recording session.
 *
 * Stores metadata about the audio recording and its processing
 * status, including transcription and privacy-related tokens.
 */
export interface Recording {
  /** Unique identifier (UUID v4) */
  id: string;

  /** File path to the audio file */
  audioPath: string;

  /** Audio format (e.g., 'webm', 'wav') */
  audioFormat: string;

  /** Duration in milliseconds */
  duration: number;

  /** Audio sample rate in Hz */
  sampleRate: number;

  /** Transcribed text content */
  transcription?: string;

  /** BCP-47 language code (e.g., 'de-DE') */
  language: string;

  /** AI-enriched structured data (JSON string) */
  enrichedData?: string;

  /** Confidence score from AI processing (0.0-1.0) */
  confidence?: number;

  /** Privacy-masked version of transcription */
  anonymizedTranscript?: string;

  /** Token mapping for de-anonymization (JSON string) */
  privacyTokenMap?: string;

  /** Record creation timestamp */
  createdAt: Date;
}

/**
 * Category for invoice classification.
 *
 * Supports hierarchical categorization with parent-child
 * relationships for organized bookkeeping.
 */
export interface Category {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Display name */
  name: string;

  /** Optional accounting code (e.g., SKR03/SKR04) */
  code?: string;

  /** UI display color (hex) */
  color?: string;

  /** Parent category ID for hierarchy */
  parentId?: string;

  /** Record creation timestamp */
  createdAt: Date;
}

/**
 * Bank transaction from imported statements.
 *
 * Used for automatic reconciliation with invoices.
 */
export interface BankTransaction {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Import timestamp */
  importDate: Date;

  /** Source file name */
  sourceFile?: string;

  /** Transaction booking date */
  transactionDate: Date;

  /** Value/settlement date */
  valueDate: Date;

  /** Counterparty name */
  counterparty: string;

  /** Counterparty IBAN */
  counterpartyIban?: string;

  /** Transaction amount (positive or negative) */
  amount: number;

  /** Currency code */
  currency: string;

  /** Payment purpose/reference text */
  purpose?: string;

  /** Reference to matched invoice */
  matchedInvoiceId?: string;

  /** Confidence score for automatic matching */
  matchConfidence?: number;

  /** Whether reconciliation is confirmed */
  reconciled: boolean;

  /** Record creation timestamp */
  createdAt: Date;
}

/**
 * Application settings singleton.
 *
 * Stores user preferences and integration configurations.
 */
export interface AppSettings {
  /** Singleton identifier (always 'singleton') */
  id: string;

  /** n8n webhook URL for automation */
  n8nWebhookUrl?: string;

  /** Whether n8n integration is enabled */
  n8nEnabled: boolean;

  /** Watch folder for bank statement imports */
  bankFolderPath?: string;

  /** Whether automatic bank sync is enabled */
  bankSyncEnabled: boolean;

  /** License key string */
  licenseKey?: string;

  /** Current license status */
  licenseStatus: LicenseStatus;

  /** License expiration date */
  licenseValidUntil?: Date;

  /** Privacy mode configuration */
  privacyMode: PrivacyMode;

  /** Last settings modification timestamp */
  updatedAt: Date;
}

/**
 * Audit log entry for compliance tracking.
 *
 * Records all significant actions for GDPR compliance
 * and debugging purposes.
 */
export interface AuditLog {
  /** Unique identifier (UUID v4) */
  id: string;

  /** Action type (e.g., 'CREATE', 'UPDATE', 'DELETE') */
  action: string;

  /** Entity type affected (e.g., 'Invoice', 'Customer') */
  entityType: string;

  /** Entity ID if applicable */
  entityId?: string;

  /** Additional details (JSON string) */
  details?: string;

  /** Name of the AI agent if automated */
  agentName?: string;

  /** Action timestamp */
  createdAt: Date;
}
