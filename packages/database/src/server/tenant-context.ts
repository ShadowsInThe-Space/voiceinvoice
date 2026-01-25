/**
 * Multi-tenant context and helper utilities for VoiceInvoice Enterprise Server.
 *
 * Provides type-safe tenant isolation for all database operations.
 * All queries are automatically scoped to the current tenant.
 *
 * @module @voiceinvoice/database/server
 */

/**
 * Error thrown when tenant operations fail.
 */
export class TenantError extends Error {
  public readonly code: string;

  /**
   * Creates a new TenantError.
   *
   * @param message - Error message describing the issue
   * @param code - Error code for programmatic handling
   *
   * @example
   * throw new TenantError('Tenant ID is required', 'TENANT_REQUIRED');
   */
  constructor(message: string, code: string) {
    super(message);
    this.name = 'TenantError';
    this.code = code;
  }
}

/**
 * Validates a tenant ID for proper format and content.
 *
 * @param tenantId - The tenant ID to validate
 * @returns True if valid, false otherwise
 *
 * @example
 * if (!isValidTenantId(id)) {
 *   throw new TenantError('Invalid tenant ID', 'INVALID_TENANT_ID');
 * }
 */
export function isValidTenantId(tenantId: unknown): tenantId is string {
  if (typeof tenantId !== 'string') {
    return false;
  }

  // Must be non-empty
  if (tenantId.trim().length === 0) {
    return false;
  }

  // Must be reasonable length (UUID is 36 chars)
  if (tenantId.length > 128) {
    return false;
  }

  // Only allow alphanumeric, hyphens, and underscores
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(tenantId);
}

/**
 * Base where clause type for tenant-scoped queries.
 */
export interface TenantWhereClause {
  tenantId: string;
}

/**
 * Configuration options for TenantContext.
 */
export interface TenantContextOptions {
  /**
   * Whether to validate tenant ID on creation.
   * @default true
   */
  validateOnCreate?: boolean;

  /**
   * Custom validator function for tenant IDs.
   */
  customValidator?: (tenantId: string) => boolean;
}

/**
 * Prisma model interface for tenant-scoped operations.
 * Generic interface that works with any Prisma model.
 */
export interface TenantScopedModel<
  TCreate,
  TUpdate,
  TWhere,
  TSelect = unknown,
  TInclude = unknown,
> {
  findMany(args?: {
    where?: TWhere;
    select?: TSelect;
    include?: TInclude;
    orderBy?: unknown;
    take?: number;
    skip?: number;
    cursor?: unknown;
  }): Promise<unknown[]>;

  findFirst(args?: {
    where?: TWhere;
    select?: TSelect;
    include?: TInclude;
    orderBy?: unknown;
  }): Promise<unknown | null>;

  findUnique(args: {
    where: { id: string } & Partial<TWhere>;
    select?: TSelect;
    include?: TInclude;
  }): Promise<unknown | null>;

  create(args: { data: TCreate; select?: TSelect; include?: TInclude }): Promise<unknown>;

  createMany(args: { data: TCreate[]; skipDuplicates?: boolean }): Promise<{ count: number }>;

  update(args: {
    where: { id: string } & Partial<TWhere>;
    data: TUpdate;
    select?: TSelect;
    include?: TInclude;
  }): Promise<unknown>;

  updateMany(args: { where: TWhere; data: TUpdate }): Promise<{ count: number }>;

  delete(args: { where: { id: string } & Partial<TWhere> }): Promise<unknown>;

  deleteMany(args: { where: TWhere }): Promise<{ count: number }>;

  count(args?: { where?: TWhere }): Promise<number>;
}

/**
 * Tenant context for scoping database operations to a specific tenant.
 *
 * This class provides helper methods to ensure all database operations
 * are properly scoped to a single tenant, preventing data leakage
 * between tenants in a multi-tenant environment.
 *
 * @example
 * // Create a tenant context
 * const ctx = new TenantContext('tenant-123');
 *
 * // Use with Prisma queries
 * const customers = await prisma.customer.findMany({
 *   where: ctx.where({ type: 'CUSTOMER' })
 * });
 *
 * // Create with tenant ID
 * const newCustomer = await prisma.customer.create({
 *   data: ctx.create({ companyName: 'Acme Corp', type: 'CUSTOMER' })
 * });
 */
export class TenantContext {
  private readonly _tenantId: string;
  private readonly _options: Required<TenantContextOptions>;

  /**
   * Creates a new TenantContext for the specified tenant.
   *
   * @param tenantId - The unique identifier for the tenant
   * @param options - Configuration options
   * @throws {TenantError} If tenant ID is invalid and validation is enabled
   *
   * @example
   * const ctx = new TenantContext('org-abc-123');
   */
  constructor(tenantId: string, options?: TenantContextOptions) {
    this._options = {
      validateOnCreate: options?.validateOnCreate ?? true,
      customValidator: options?.customValidator ?? isValidTenantId,
    };

    if (this._options.validateOnCreate) {
      if (!this._options.customValidator(tenantId)) {
        throw new TenantError(
          `Invalid tenant ID: "${tenantId}". Must be non-empty alphanumeric string.`,
          'INVALID_TENANT_ID'
        );
      }
    }

    this._tenantId = tenantId;
  }

  /**
   * Gets the current tenant ID.
   *
   * @returns The tenant ID
   *
   * @example
   * console.log(`Operating on tenant: ${ctx.tenantId}`);
   */
  get tenantId(): string {
    return this._tenantId;
  }

  /**
   * Creates a where clause scoped to the current tenant.
   *
   * @param additionalFilters - Additional filter conditions to merge
   * @returns Where clause object with tenantId included
   *
   * @example
   * // Simple tenant filter
   * const where = ctx.where();
   * // { tenantId: 'tenant-123' }
   *
   * // With additional filters
   * const where = ctx.where({ status: 'ACTIVE', type: 'CUSTOMER' });
   * // { tenantId: 'tenant-123', status: 'ACTIVE', type: 'CUSTOMER' }
   */
  where<T extends Record<string, unknown>>(additionalFilters?: T): TenantWhereClause & T {
    return {
      ...additionalFilters,
      tenantId: this._tenantId,
    } as TenantWhereClause & T;
  }

  /**
   * Creates a data object with tenantId included for insert operations.
   *
   * @param data - The data to create
   * @returns Data object with tenantId included
   *
   * @example
   * const customerData = ctx.create({
   *   companyName: 'Acme Corp',
   *   type: 'CUSTOMER',
   *   email: 'info@acme.com'
   * });
   * // { tenantId: 'tenant-123', companyName: 'Acme Corp', ... }
   */
  create<T extends Record<string, unknown>>(data: T): TenantWhereClause & T {
    return {
      ...data,
      tenantId: this._tenantId,
    } as TenantWhereClause & T;
  }

  /**
   * Creates multiple data objects with tenantId included for bulk insert.
   *
   * @param dataArray - Array of data objects to create
   * @returns Array of data objects with tenantId included
   *
   * @example
   * const customers = ctx.createMany([
   *   { companyName: 'Acme Corp', type: 'CUSTOMER' },
   *   { companyName: 'Widgets Inc', type: 'SUPPLIER' }
   * ]);
   */
  createMany<T extends Record<string, unknown>>(dataArray: T[]): (TenantWhereClause & T)[] {
    return dataArray.map((data) => this.create(data));
  }

  /**
   * Validates that a record belongs to the current tenant.
   *
   * @param record - The record to validate
   * @returns True if the record belongs to this tenant
   * @throws {TenantError} If record has no tenantId
   *
   * @example
   * const customer = await prisma.customer.findUnique({ where: { id } });
   * if (!ctx.belongsToTenant(customer)) {
   *   throw new Error('Access denied');
   * }
   */
  belongsToTenant(record: unknown): boolean {
    if (!record || typeof record !== 'object') {
      return false;
    }

    const tenantRecord = record as Record<string, unknown>;

    if (!('tenantId' in tenantRecord)) {
      throw new TenantError('Record does not have a tenantId field', 'MISSING_TENANT_ID');
    }

    return tenantRecord.tenantId === this._tenantId;
  }

  /**
   * Asserts that a record belongs to the current tenant.
   *
   * @param record - The record to validate
   * @throws {TenantError} If record does not belong to this tenant
   *
   * @example
   * const customer = await prisma.customer.findUnique({ where: { id } });
   * ctx.assertBelongsToTenant(customer);
   * // Throws if customer.tenantId !== ctx.tenantId
   */
  assertBelongsToTenant(record: unknown): void {
    if (!record || typeof record !== 'object') {
      throw new TenantError('Record is null or not an object', 'INVALID_RECORD');
    }

    const tenantRecord = record as Record<string, unknown>;

    if (!('tenantId' in tenantRecord)) {
      throw new TenantError('Record does not have a tenantId field', 'MISSING_TENANT_ID');
    }

    if (tenantRecord.tenantId !== this._tenantId) {
      throw new TenantError(
        `Record belongs to tenant "${tenantRecord.tenantId}", not "${this._tenantId}"`,
        'TENANT_MISMATCH'
      );
    }
  }

  /**
   * Creates a unique where clause for finding a single record.
   *
   * @param id - The record ID
   * @returns Where clause with both id and tenantId
   *
   * @example
   * const customer = await prisma.customer.findFirst({
   *   where: ctx.whereId('customer-uuid')
   * });
   */
  whereId(id: string): { id: string } & TenantWhereClause {
    return {
      id,
      tenantId: this._tenantId,
    };
  }

  /**
   * Filters an array of records to only those belonging to this tenant.
   *
   * @param records - Array of records to filter
   * @returns Filtered array containing only this tenant's records
   *
   * @example
   * const allRecords = await someExternalSource();
   * const tenantRecords = ctx.filterByTenant(allRecords);
   */
  filterByTenant<T extends { tenantId: string }>(records: T[]): T[] {
    return records.filter((record) => record.tenantId === this._tenantId);
  }

  /**
   * Creates a string representation of the tenant context.
   *
   * @returns String representation
   */
  toString(): string {
    return `TenantContext(${this._tenantId})`;
  }

  /**
   * Creates a JSON representation of the tenant context.
   *
   * @returns JSON-serializable object
   */
  toJSON(): { tenantId: string } {
    return { tenantId: this._tenantId };
  }
}

/**
 * Creates a new TenantContext instance.
 *
 * Factory function for creating tenant contexts with a cleaner API.
 *
 * @param tenantId - The unique identifier for the tenant
 * @param options - Configuration options
 * @returns A new TenantContext instance
 *
 * @example
 * const ctx = createTenantContext('tenant-123');
 * const customers = await prisma.customer.findMany({
 *   where: ctx.where({ type: 'CUSTOMER' })
 * });
 */
export function createTenantContext(
  tenantId: string,
  options?: TenantContextOptions
): TenantContext {
  return new TenantContext(tenantId, options);
}

/**
 * Extracts tenant ID from various sources (headers, JWT claims, etc.).
 *
 * @param source - Object containing potential tenant ID
 * @param keys - Keys to check for tenant ID (in order of priority)
 * @returns The extracted tenant ID or null if not found
 *
 * @example
 * // From request headers
 * const tenantId = extractTenantId(req.headers, ['x-tenant-id', 'tenant']);
 *
 * // From JWT claims
 * const tenantId = extractTenantId(jwtPayload, ['tenant_id', 'org_id']);
 */
export function extractTenantId(
  source: Record<string, unknown>,
  keys: string[] = ['tenantId', 'tenant_id', 'x-tenant-id', 'organizationId', 'org_id']
): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && isValidTenantId(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Middleware helper that extracts tenant context from request.
 *
 * @param getTenantId - Function to extract tenant ID from request
 * @returns Middleware function
 *
 * @example
 * // Express middleware
 * app.use(withTenantContext((req) => req.headers['x-tenant-id'] as string));
 *
 * // Access in route handler
 * app.get('/customers', (req, res) => {
 *   const ctx = req.tenantContext;
 *   // ...
 * });
 */
export function withTenantContext<TRequest extends Record<string, unknown>>(
  getTenantId: (req: TRequest) => string | null | undefined
): (req: TRequest) => TenantContext {
  return (req: TRequest): TenantContext => {
    const tenantId = getTenantId(req);

    if (!tenantId) {
      throw new TenantError('Tenant ID not found in request', 'TENANT_NOT_FOUND');
    }

    return new TenantContext(tenantId);
  };
}

/**
 * Type guard to check if an object has a tenantId property.
 *
 * @param obj - Object to check
 * @returns True if object has a valid tenantId
 *
 * @example
 * if (hasTenantId(record)) {
 *   console.log(`Record belongs to tenant: ${record.tenantId}`);
 * }
 */
export function hasTenantId(obj: unknown): obj is { tenantId: string } {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'tenantId' in obj &&
    typeof (obj as Record<string, unknown>).tenantId === 'string'
  );
}

/**
 * Strips tenantId from an object for safe external exposure.
 *
 * @param obj - Object to strip tenantId from
 * @returns New object without tenantId
 *
 * @example
 * const customer = await prisma.customer.findUnique({ where: { id } });
 * const safeCustomer = stripTenantId(customer);
 * // safeCustomer does not contain tenantId
 */
export function stripTenantId<T extends { tenantId: string }>(obj: T): Omit<T, 'tenantId'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { tenantId, ...rest } = obj;
  return rest as Omit<T, 'tenantId'>;
}

/**
 * Strips tenantId from an array of objects.
 *
 * @param objects - Array of objects to strip tenantId from
 * @returns New array with objects without tenantId
 *
 * @example
 * const customers = await prisma.customer.findMany({ where: ctx.where() });
 * const safeCustomers = stripTenantIdFromMany(customers);
 */
export function stripTenantIdFromMany<T extends { tenantId: string }>(
  objects: T[]
): Omit<T, 'tenantId'>[] {
  return objects.map(stripTenantId);
}
