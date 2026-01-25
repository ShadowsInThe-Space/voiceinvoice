/**
 * Server-side database module for VoiceInvoice Enterprise.
 *
 * Provides multi-tenant PostgreSQL database access with tenant isolation,
 * connection management, and helper utilities for scoped queries.
 *
 * @module @voiceinvoice/database/server
 */

// Re-export all tenant context utilities
export {
  TenantContext,
  TenantError,
  createTenantContext,
  extractTenantId,
  withTenantContext,
  isValidTenantId,
  hasTenantId,
  stripTenantId,
  stripTenantIdFromMany,
  type TenantContextOptions,
  type TenantWhereClause,
  type TenantScopedModel,
} from './tenant-context';

/**
 * Server database module version for compatibility checking.
 */
export const SERVER_DATABASE_VERSION = '0.1.0';

/**
 * Database provider type for the server.
 */
export const DATABASE_PROVIDER = 'postgresql' as const;

/**
 * Configuration for server database connection.
 */
export interface ServerDatabaseConfig {
  /** PostgreSQL connection URL */
  databaseUrl?: string;
  /** Maximum number of connections in the pool */
  connectionPoolSize?: number;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs?: number;
  /** Query timeout in milliseconds */
  queryTimeoutMs?: number;
  /** Enable query logging */
  logging?: boolean;
  /** Enable SSL connection */
  ssl?: boolean;
}

/**
 * Default server database configuration.
 */
export const DEFAULT_SERVER_CONFIG: Required<Omit<ServerDatabaseConfig, 'databaseUrl'>> = {
  connectionPoolSize: 10,
  connectionTimeoutMs: 10000,
  queryTimeoutMs: 30000,
  logging: false,
  ssl: true,
};

/**
 * Multi-tenant model names that require tenantId filtering.
 */
export const TENANT_SCOPED_MODELS = [
  'Customer',
  'Invoice',
  'InvoiceItem',
  'Recording',
  'Category',
  'BankTransaction',
  'AppSettings',
  'AuditLog',
] as const;

/**
 * Type for tenant-scoped model names.
 */
export type TenantScopedModelName = (typeof TENANT_SCOPED_MODELS)[number];

/**
 * Checks if a model requires tenant scoping.
 *
 * @param modelName - Name of the Prisma model
 * @returns True if the model requires tenant scoping
 *
 * @example
 * if (isTenantScopedModel('Customer')) {
 *   // Apply tenant filter
 * }
 */
export function isTenantScopedModel(modelName: string): modelName is TenantScopedModelName {
  return TENANT_SCOPED_MODELS.includes(modelName as TenantScopedModelName);
}

/**
 * Audit action types for logging.
 */
export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  VIEW: 'VIEW',
  DOWNLOAD: 'DOWNLOAD',
  SHARE: 'SHARE',
} as const;

/**
 * Type for audit action values.
 */
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Creates an audit log entry data object.
 *
 * @param tenantId - The tenant ID
 * @param action - The action being logged
 * @param entityType - The type of entity affected
 * @param options - Additional audit log options
 * @param options.entityId - The ID of the affected entity
 * @param options.userId - The ID of the user performing the action
 * @param options.previousValues - Previous values before the change
 * @param options.newValues - New values after the change
 * @param options.ipAddress - IP address of the request
 * @param options.userAgent - User agent string of the client
 * @param options.metadata - Additional metadata for the audit entry
 * @returns Audit log data object for Prisma create
 *
 * @example
 * await prisma.auditLog.create({
 *   data: createAuditLogEntry('tenant-123', 'CREATE', 'Customer', {
 *     entityId: customer.id,
 *     userId: user.id,
 *     newValues: customer
 *   })
 * });
 */
export function createAuditLogEntry(
  tenantId: string,
  action: AuditAction,
  entityType: string,
  options?: {
    entityId?: string;
    userId?: string;
    previousValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  }
): {
  tenantId: string;
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  previousValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: string;
} {
  return {
    tenantId,
    action,
    entityType,
    entityId: options?.entityId,
    userId: options?.userId,
    previousValues: options?.previousValues ? JSON.stringify(options.previousValues) : undefined,
    newValues: options?.newValues ? JSON.stringify(options.newValues) : undefined,
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
    metadata: options?.metadata ? JSON.stringify(options.metadata) : undefined,
  };
}

/**
 * Invoice status values.
 */
export const INVOICE_STATUS = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;

/**
 * Type for invoice status values.
 */
export type InvoiceStatus = (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

/**
 * Recording processing status values.
 */
export const RECORDING_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

/**
 * Type for recording status values.
 */
export type RecordingStatus = (typeof RECORDING_STATUS)[keyof typeof RECORDING_STATUS];

/**
 * Bank transaction match status values.
 */
export const MATCH_STATUS = {
  PENDING: 'PENDING',
  MATCHED: 'MATCHED',
  UNMATCHED: 'UNMATCHED',
  MANUAL: 'MANUAL',
} as const;

/**
 * Type for match status values.
 */
export type MatchStatus = (typeof MATCH_STATUS)[keyof typeof MATCH_STATUS];

/**
 * Customer type values.
 */
export const CUSTOMER_TYPE = {
  CUSTOMER: 'CUSTOMER',
  SUPPLIER: 'SUPPLIER',
  BOTH: 'BOTH',
} as const;

/**
 * Type for customer type values.
 */
export type CustomerType = (typeof CUSTOMER_TYPE)[keyof typeof CUSTOMER_TYPE];

/**
 * Category type values.
 */
export const CATEGORY_TYPE = {
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
  BOTH: 'BOTH',
} as const;

/**
 * Type for category type values.
 */
export type CategoryType = (typeof CATEGORY_TYPE)[keyof typeof CATEGORY_TYPE];
