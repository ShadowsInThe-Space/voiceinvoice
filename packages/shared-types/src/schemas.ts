/**
 * Zod validation schemas for runtime type checking.
 *
 * This module provides runtime validation for all core entities,
 * ensuring data integrity at API boundaries and user input processing.
 *
 * @module schemas
 */

import { z } from 'zod';

/**
 * Schema for customer type enumeration.
 *
 * Validates that the type is one of the allowed values.
 */
export const CustomerTypeSchema = z.enum(['CUSTOMER', 'SUPPLIER', 'BOTH']);

/**
 * Schema for invoice status enumeration.
 *
 * Tracks the lifecycle state of an invoice.
 */
export const InvoiceStatusSchema = z.enum(['DRAFT', 'SENT', 'PENDING', 'PAID', 'CANCELLED', 'OVERDUE']);

/**
 * Schema for German tax rates.
 *
 * Only the legally valid rates are accepted.
 */
export const TaxRateSchema = z.union([z.literal(0), z.literal(7), z.literal(19)]);

/**
 * Schema for privacy mode settings.
 *
 * Controls how sensitive data is handled.
 */
export const PrivacyModeSchema = z.enum(['STRICT', 'STANDARD', 'MINIMAL']);

/**
 * Schema for license status tracking.
 *
 * Used to validate and display license state.
 */
export const LicenseStatusSchema = z.enum(['TRIAL', 'ACTIVE', 'EXPIRED', 'INVALID']);

/**
 * Schema for invoice data input validation.
 *
 * Used when creating or updating invoices from voice input
 * or manual entry. Ensures all business rules are met.
 *
 * @example
 * const result = InvoiceDataSchema.safeParse({
 *   customerName: 'Acme Corp',
 *   amount: 1000,
 *   taxRate: 19
 * });
 */
export const InvoiceDataSchema = z.object({
  /** Customer or company name (required, min 1 char after trim) */
  customerName: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Customer name is required')),

  /** Invoice amount in EUR (must be positive) */
  amount: z.number().positive('Amount must be greater than zero'),

  /** Tax rate: 0%, 7%, or 19% */
  taxRate: TaxRateSchema,

  /** Optional description or notes */
  description: z.string().optional(),

  /** List of invoice items */
  items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unitPrice: z.number().nonnegative('Price must be non-negative'),
  })).optional(),
});

/**
 * Schema for customer data input validation.
 *
 * Validates customer creation and update requests with
 * proper format checking for optional fields.
 *
 * @example
 * const result = CustomerDataSchema.safeParse({
 *   companyName: 'Mustermann GmbH',
 *   type: 'CUSTOMER',
 *   email: 'info@mustermann.de'
 * });
 */
export const CustomerDataSchema = z.object({
  /** Legal company name (required) */
  companyName: z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, 'Company name is required')),

  /** Customer type classification */
  type: CustomerTypeSchema,

  /** Contact person name */
  contactPerson: z.string().optional(),

  /** Email address with format validation */
  email: z.string().email('Invalid email format').optional(),

  /** Phone number */
  phone: z.string().optional(),

  /** German tax number (Steuernummer) */
  taxNumber: z.string().optional(),

  /** EU VAT ID */
  vatId: z.string().optional(),

  /** Street address */
  street: z.string().optional(),

  /** Postal code */
  zip: z.string().optional(),

  /** City */
  city: z.string().optional(),

  /** Country code (ISO 3166-1 alpha-2, defaults to DE) */
  country: z.string().length(2).default('DE'),
});

/**
 * Schema for recording metadata validation.
 *
 * Validates audio recording metadata before storage.
 */
export const RecordingDataSchema = z.object({
  /** File path to audio file */
  audioPath: z.string().min(1),

  /** Audio format (webm, wav, etc.) */
  audioFormat: z.string().default('webm'),

  /** Duration in milliseconds */
  duration: z.number().int().positive(),

  /** Sample rate in Hz */
  sampleRate: z.number().int().positive().default(48000),

  /** BCP-47 language code */
  language: z.string().default('de-DE'),
});

/**
 * Schema for bank transaction import validation.
 *
 * Validates data parsed from bank statement files.
 */
export const BankTransactionDataSchema = z.object({
  /** Transaction date */
  transactionDate: z.coerce.date(),

  /** Value date */
  valueDate: z.coerce.date(),

  /** Counterparty name */
  counterparty: z.string().min(1),

  /** Counterparty IBAN */
  counterpartyIban: z.string().optional(),

  /** Amount (positive or negative) */
  amount: z.number(),

  /** Currency code */
  currency: z.string().default('EUR'),

  /** Purpose text */
  purpose: z.string().optional(),
});

/**
 * Schema for app settings validation.
 *
 * Validates settings updates with proper defaults.
 */
export const AppSettingsSchema = z.object({
  /** n8n webhook URL */
  n8nWebhookUrl: z.string().url().optional(),

  /** n8n integration enabled */
  n8nEnabled: z.boolean().default(false),

  /** Bank import folder path */
  bankFolderPath: z.string().optional(),

  /** Bank sync enabled */
  bankSyncEnabled: z.boolean().default(false),

  /** License key */
  licenseKey: z.string().optional(),

  /** Privacy mode */
  privacyMode: PrivacyModeSchema.default('STRICT'),
});

// Export inferred types for convenience
export type InvoiceDataInput = z.input<typeof InvoiceDataSchema>;
export type InvoiceDataOutput = z.output<typeof InvoiceDataSchema>;
export type CustomerDataInput = z.input<typeof CustomerDataSchema>;
export type CustomerDataOutput = z.output<typeof CustomerDataSchema>;
export type RecordingDataInput = z.input<typeof RecordingDataSchema>;
export type BankTransactionDataInput = z.input<typeof BankTransactionDataSchema>;
export type AppSettingsInput = z.input<typeof AppSettingsSchema>;
