/**
 * IPC Handler implementations for VoiceInvoice Desktop.
 *
 * These handlers process requests from the renderer process
 * and interact with the database and other services.
 *
 * @module electron/ipc/handlers
 */

import { validateInvoiceData } from '@voiceinvoice/shared-types';

/**
 * Database operations interface.
 *
 * Abstraction layer for database operations to enable
 * dependency injection and testing.
 */
export interface DatabaseOperations {
  createInvoice: (data: unknown) => Promise<unknown>;
  getCustomers: () => Promise<unknown[]>;
  getSettings: () => Promise<unknown>;
  updateSettings: (data: unknown) => Promise<unknown>;
}

/**
 * Context provided to IPC handlers.
 *
 * Contains all dependencies needed by handlers.
 */
export interface IpcHandlerContext {
  database: DatabaseOperations;
}

/**
 * Result type for IPC handler responses.
 *
 * Provides consistent success/error structure for all handlers.
 */
export interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    field?: string;
    code?: string;
  };
}

/**
 * Default application settings.
 *
 * Used when no settings exist in the database.
 */
const DEFAULT_SETTINGS = {
  privacyMode: 'STRICT' as const,
  n8nEnabled: false,
  bankSyncEnabled: false,
};

/**
 * Validates a URL string.
 *
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid URL
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a new invoice from voice or manual input.
 *
 * Validates the invoice data using shared-types validation
 * before persisting to the database.
 *
 * @param {IpcHandlerContext} context - Handler context with dependencies
 * @param {unknown} data - Invoice data to create
 * @returns {Promise<IpcResult<unknown>>} Result with created invoice or error
 *
 * @example
 * const result = await createInvoiceHandler(context, {
 *   customerName: 'Acme Corp',
 *   amount: 1000,
 *   taxRate: 19
 * });
 */
export async function createInvoiceHandler(
  context: IpcHandlerContext,
  data: unknown
): Promise<IpcResult<unknown>> {
  // Validate invoice data
  const validation = validateInvoiceData(data);

  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
    };
  }

  try {
    const invoice = await context.database.createInvoice(validation.data);
    return {
      success: true,
      data: invoice,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Database error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Retrieves all customers from the database.
 *
 * Returns an empty array if no customers exist.
 *
 * @param {IpcHandlerContext} context - Handler context with dependencies
 * @returns {Promise<IpcResult<unknown[]>>} Result with customers array
 */
export async function getCustomersHandler(
  context: IpcHandlerContext
): Promise<IpcResult<unknown[]>> {
  try {
    const customers = await context.database.getCustomers();
    return {
      success: true,
      data: customers,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Failed to fetch customers: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Retrieves current application settings.
 *
 * Returns default settings if none exist in the database.
 *
 * @param {IpcHandlerContext} context - Handler context with dependencies
 * @returns {Promise<IpcResult<unknown>>} Result with settings object
 */
export async function getSettingsHandler(context: IpcHandlerContext): Promise<IpcResult<unknown>> {
  try {
    const settings = await context.database.getSettings();

    if (settings === null) {
      return {
        success: true,
        data: DEFAULT_SETTINGS,
      };
    }

    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Failed to fetch settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}

/**
 * Updates application settings.
 *
 * Validates settings data before persisting.
 *
 * @param {IpcHandlerContext} context - Handler context with dependencies
 * @param {unknown} data - Settings data to update
 * @returns {Promise<IpcResult<unknown>>} Result with updated settings or error
 */
export async function updateSettingsHandler(
  context: IpcHandlerContext,
  data: unknown
): Promise<IpcResult<unknown>> {
  // Validate settings data
  const settingsData = data as Record<string, unknown>;

  // Validate webhook URL if provided
  if (settingsData.n8nWebhookUrl && typeof settingsData.n8nWebhookUrl === 'string') {
    if (!isValidUrl(settingsData.n8nWebhookUrl)) {
      return {
        success: false,
        error: {
          message: 'Invalid webhook URL',
          field: 'n8nWebhookUrl',
        },
      };
    }
  }

  try {
    const settings = await context.database.updateSettings(data);
    return {
      success: true,
      data: settings,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        message: `Failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
    };
  }
}
