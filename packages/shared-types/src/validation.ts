/**
 * Validation utilities for VoiceInvoice Enterprise.
 *
 * This module provides type-safe validation functions that wrap Zod schemas
 * and return structured results with field-level error information.
 *
 * @module validation
 */

import { InvoiceDataSchema, CustomerDataSchema } from './schemas';

/**
 * Custom error class for validation failures.
 *
 * Extends the standard Error with field-specific information
 * to enable targeted error display in the UI.
 *
 * @example
 * try {
 *   // validation logic
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     console.log(`Field ${error.field}: ${error.message}`);
 *   }
 * }
 */
export class ValidationError extends Error {
  /**
   * The field name that caused the validation failure.
   * Can be a nested path like 'address.street'.
   */
  public readonly field: string;

  /**
   * Creates a new ValidationError.
   *
   * @param {string} message - Human-readable error description
   * @param {string} field - The field name that failed validation
   */
  constructor(message: string, field: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;

    // Maintains proper stack trace in V8 environments
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if ('captureStackTrace' in Error) {
      (
        Error as { captureStackTrace?: (target: object, constructor: unknown) => void }
      ).captureStackTrace?.(this, ValidationError);
    }
  }
}

/**
 * Validation error information for failed validations.
 *
 * Contains structured information about what went wrong.
 */
export interface ValidationErrorInfo {
  /** Human-readable error message */
  message: string;

  /** Field that failed validation */
  field: string;

  /** Original error code from Zod */
  code?: string;
}

/**
 * Result type for validation operations.
 *
 * Uses discriminated union pattern for type-safe handling
 * of success and failure cases.
 */
export type ValidationResult<T> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: ValidationErrorInfo };

/**
 * Input data structure for invoice validation.
 *
 * Represents the raw data that can be validated as an invoice.
 */
export interface InvoiceData {
  /** Customer or company name */
  customerName: string;

  /** Invoice amount in EUR */
  amount: number;

  /** Tax rate (0, 7, or 19) */
  taxRate: number;

  /** Optional description */
  description?: string;
}

/**
 * Input data structure for customer validation.
 *
 * Represents the raw data that can be validated as a customer.
 */
export interface CustomerData {
  /** Company name */
  companyName: string;

  /** Customer type */
  type: 'CUSTOMER' | 'SUPPLIER' | 'BOTH';

  /** Contact person */
  contactPerson?: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone?: string;

  /** Tax number */
  taxNumber?: string;

  /** VAT ID */
  vatId?: string;

  /** Street address */
  street?: string;

  /** ZIP code */
  zip?: string;

  /** City */
  city?: string;

  /** Country code */
  country?: string;
}

/**
 * Validates invoice data for correctness and completeness.
 *
 * This function performs comprehensive validation of invoice objects,
 * checking required fields, data types, and business rules like
 * positive amounts and valid tax rates (0%, 7%, or 19%).
 *
 * The validation includes:
 * - Customer name must be non-empty after trimming whitespace
 * - Amount must be a positive number greater than zero
 * - Tax rate must be exactly 0, 7, or 19
 * - Description is optional
 *
 * @param {unknown} invoiceData - The invoice object to validate
 * @returns {ValidationResult<InvoiceData>} Validation result with data or error
 *
 * @example
 * // Successful validation
 * const result = validateInvoiceData({
 *   customerName: 'Acme Corp',
 *   amount: 1000,
 *   taxRate: 19
 * });
 * if (result.success) {
 *   console.log('Valid invoice:', result.data);
 * }
 *
 * @example
 * // Failed validation
 * const result = validateInvoiceData({
 *   customerName: '',
 *   amount: -100,
 *   taxRate: 25
 * });
 * if (!result.success) {
 *   console.log(`Error in ${result.error.field}: ${result.error.message}`);
 * }
 */
export function validateInvoiceData(invoiceData: unknown): ValidationResult<InvoiceData> {
  const result = InvoiceDataSchema.safeParse(invoiceData);

  if (result.success) {
    return {
      success: true,
      data: result.data as InvoiceData,
    };
  }

  // Extract the first error for simplified error reporting
  const firstError = result.error.errors[0];
  const field = firstError?.path[0]?.toString() ?? 'unknown';
  const message = firstError?.message ?? 'Validation failed';

  return {
    success: false,
    error: {
      message,
      field,
      code: firstError?.code,
    },
  };
}

/**
 * Validates customer data for correctness and completeness.
 *
 * This function validates customer entity data including:
 * - Company name must be non-empty after trimming
 * - Type must be 'CUSTOMER', 'SUPPLIER', or 'BOTH'
 * - Email must be valid format if provided
 * - Country defaults to 'DE' if not provided
 *
 * All optional fields are validated for correct format when present.
 *
 * @param {unknown} customerData - The customer object to validate
 * @returns {ValidationResult<CustomerData>} Validation result with data or error
 *
 * @example
 * const result = validateCustomerData({
 *   companyName: 'Mustermann GmbH',
 *   type: 'CUSTOMER',
 *   email: 'info@mustermann.de'
 * });
 * if (result.success) {
 *   console.log('Valid customer:', result.data);
 * }
 */
export function validateCustomerData(customerData: unknown): ValidationResult<CustomerData> {
  const result = CustomerDataSchema.safeParse(customerData);

  if (result.success) {
    return {
      success: true,
      data: result.data as CustomerData,
    };
  }

  // Extract the first error for simplified error reporting
  const firstError = result.error.errors[0];
  const field = firstError?.path[0]?.toString() ?? 'unknown';
  const message = firstError?.message ?? 'Validation failed';

  return {
    success: false,
    error: {
      message,
      field,
      code: firstError?.code,
    },
  };
}

/**
 * Type guard to check if an error is a ValidationError.
 *
 * Useful for error handling in try-catch blocks.
 *
 * @param {unknown} error - The error to check
 * @returns {boolean} True if error is a ValidationError
 *
 * @example
 * try {
 *   // some operation
 * } catch (error) {
 *   if (isValidationError(error)) {
 *     handleFieldError(error.field, error.message);
 *   }
 * }
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}
