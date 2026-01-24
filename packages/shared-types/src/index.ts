/**
 * Shared types and validation utilities for VoiceInvoice Enterprise.
 *
 * This package provides the core type definitions and runtime validation
 * schemas used across the desktop application and proxy server.
 *
 * @packageDocumentation
 * @module @voiceinvoice/shared-types
 */

// Core type definitions
export type {
  Customer,
  Invoice,
  Recording,
  Category,
  BankTransaction,
  AppSettings,
  AuditLog,
  CustomerType,
  InvoiceStatus,
  TaxRate,
  PrivacyMode,
  LicenseStatus,
} from './types';

// Zod schemas for runtime validation
export {
  CustomerTypeSchema,
  InvoiceStatusSchema,
  TaxRateSchema,
  PrivacyModeSchema,
  LicenseStatusSchema,
  InvoiceDataSchema,
  CustomerDataSchema,
  RecordingDataSchema,
  BankTransactionDataSchema,
  AppSettingsSchema,
} from './schemas';

// Schema input/output types
export type {
  InvoiceDataInput,
  InvoiceDataOutput,
  CustomerDataInput,
  CustomerDataOutput,
  RecordingDataInput,
  BankTransactionDataInput,
  AppSettingsInput,
} from './schemas';

// Validation utilities
export {
  validateInvoiceData,
  validateCustomerData,
  ValidationError,
  isValidationError,
} from './validation';

export type {
  ValidationResult,
  ValidationErrorInfo,
  InvoiceData,
  CustomerData,
} from './validation';
