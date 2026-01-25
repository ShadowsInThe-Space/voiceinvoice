import { describe, it, expect, beforeEach } from 'vitest';
import {
  TenantContext,
  TenantError,
  createTenantContext,
  extractTenantId,
  withTenantContext,
  isValidTenantId,
  hasTenantId,
  stripTenantId,
  stripTenantIdFromMany,
} from '../src/server/tenant-context';

describe('TenantContext', () => {
  describe('constructor', () => {
    it('should create context with valid tenant ID', () => {
      const ctx = new TenantContext('tenant-123');
      expect(ctx.tenantId).toBe('tenant-123');
    });

    it('should accept UUID format tenant IDs', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const ctx = new TenantContext(uuid);
      expect(ctx.tenantId).toBe(uuid);
    });

    it('should accept alphanumeric tenant IDs with underscores', () => {
      const ctx = new TenantContext('org_abc_123');
      expect(ctx.tenantId).toBe('org_abc_123');
    });

    it('should throw TenantError for empty tenant ID', () => {
      expect(() => new TenantContext('')).toThrow(TenantError);
      try {
        new TenantContext('');
      } catch (error) {
        expect((error as TenantError).code).toBe('INVALID_TENANT_ID');
      }
    });

    it('should throw TenantError for whitespace-only tenant ID', () => {
      expect(() => new TenantContext('   ')).toThrow(TenantError);
    });

    it('should throw TenantError for tenant ID with invalid characters', () => {
      expect(() => new TenantContext('tenant@123')).toThrow(TenantError);
      expect(() => new TenantContext('tenant 123')).toThrow(TenantError);
      expect(() => new TenantContext('tenant.123')).toThrow(TenantError);
    });

    it('should throw TenantError for tenant ID exceeding max length', () => {
      const longId = 'a'.repeat(129);
      expect(() => new TenantContext(longId)).toThrow(TenantError);
    });

    it('should allow skipping validation when option is false', () => {
      const ctx = new TenantContext('invalid@id', { validateOnCreate: false });
      expect(ctx.tenantId).toBe('invalid@id');
    });

    it('should use custom validator when provided', () => {
      const customValidator = (id: string): boolean => id.startsWith('custom-');

      const ctx = new TenantContext('custom-123', { customValidator });
      expect(ctx.tenantId).toBe('custom-123');

      expect(() => new TenantContext('other-123', { customValidator })).toThrow(TenantError);
    });
  });

  describe('where', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-abc');
    });

    it('should return object with tenantId', () => {
      const where = ctx.where();
      expect(where).toEqual({ tenantId: 'tenant-abc' });
    });

    it('should merge additional filters', () => {
      const where = ctx.where({ status: 'ACTIVE', type: 'CUSTOMER' });
      expect(where).toEqual({
        tenantId: 'tenant-abc',
        status: 'ACTIVE',
        type: 'CUSTOMER',
      });
    });

    it('should handle nested filter objects', () => {
      const where = ctx.where({
        createdAt: { gte: new Date('2024-01-01') },
        OR: [{ status: 'ACTIVE' }, { status: 'PENDING' }],
      });

      expect(where.tenantId).toBe('tenant-abc');
      expect(where.createdAt).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('should not allow overwriting tenantId', () => {
      // TypeScript should prevent this, but let's test runtime behavior
      // The implementation spreads tenantId last to prevent override attempts
      const where = ctx.where({ tenantId: 'other-tenant' } as Record<string, unknown>);
      expect(where.tenantId).toBe('tenant-abc');
    });
  });

  describe('create', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-xyz');
    });

    it('should add tenantId to data object', () => {
      const data = ctx.create({ companyName: 'Acme Corp', type: 'CUSTOMER' });
      expect(data).toEqual({
        tenantId: 'tenant-xyz',
        companyName: 'Acme Corp',
        type: 'CUSTOMER',
      });
    });

    it('should handle complex data objects', () => {
      const data = ctx.create({
        invoiceNumber: 'INV-001',
        items: [
          { description: 'Item 1', quantity: 2 },
          { description: 'Item 2', quantity: 1 },
        ],
        metadata: { source: 'voice' },
      });

      expect(data.tenantId).toBe('tenant-xyz');
      expect(data.items).toHaveLength(2);
    });
  });

  describe('createMany', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-bulk');
    });

    it('should add tenantId to all data objects', () => {
      const dataArray = ctx.createMany([
        { companyName: 'Company A' },
        { companyName: 'Company B' },
        { companyName: 'Company C' },
      ]);

      expect(dataArray).toHaveLength(3);
      expect(dataArray.every((d) => d.tenantId === 'tenant-bulk')).toBe(true);
    });

    it('should handle empty array', () => {
      const dataArray = ctx.createMany([]);
      expect(dataArray).toEqual([]);
    });
  });

  describe('belongsToTenant', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-owner');
    });

    it('should return true for matching tenant', () => {
      const record = { id: '1', tenantId: 'tenant-owner', name: 'Test' };
      expect(ctx.belongsToTenant(record)).toBe(true);
    });

    it('should return false for non-matching tenant', () => {
      const record = { id: '1', tenantId: 'other-tenant', name: 'Test' };
      expect(ctx.belongsToTenant(record)).toBe(false);
    });

    it('should return false for null or undefined', () => {
      expect(ctx.belongsToTenant(null)).toBe(false);
      expect(ctx.belongsToTenant(undefined)).toBe(false);
    });

    it('should throw for record without tenantId field', () => {
      const record = { id: '1', name: 'Test' };
      expect(() => ctx.belongsToTenant(record)).toThrow(TenantError);
      try {
        ctx.belongsToTenant(record);
      } catch (error) {
        expect((error as TenantError).code).toBe('MISSING_TENANT_ID');
      }
    });
  });

  describe('assertBelongsToTenant', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-check');
    });

    it('should not throw for matching tenant', () => {
      const record = { id: '1', tenantId: 'tenant-check', name: 'Test' };
      expect(() => ctx.assertBelongsToTenant(record)).not.toThrow();
    });

    it('should throw TenantError for mismatched tenant', () => {
      const record = { id: '1', tenantId: 'wrong-tenant', name: 'Test' };
      expect(() => ctx.assertBelongsToTenant(record)).toThrow(TenantError);
      try {
        ctx.assertBelongsToTenant(record);
      } catch (error) {
        expect((error as TenantError).code).toBe('TENANT_MISMATCH');
      }
    });

    it('should throw for null record', () => {
      expect(() => ctx.assertBelongsToTenant(null)).toThrow(TenantError);
      try {
        ctx.assertBelongsToTenant(null);
      } catch (error) {
        expect((error as TenantError).code).toBe('INVALID_RECORD');
      }
    });

    it('should throw for record without tenantId', () => {
      const record = { id: '1' };
      expect(() => ctx.assertBelongsToTenant(record)).toThrow(TenantError);
      try {
        ctx.assertBelongsToTenant(record);
      } catch (error) {
        expect((error as TenantError).code).toBe('MISSING_TENANT_ID');
      }
    });
  });

  describe('whereId', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-find');
    });

    it('should create where clause with id and tenantId', () => {
      const where = ctx.whereId('record-123');
      expect(where).toEqual({
        id: 'record-123',
        tenantId: 'tenant-find',
      });
    });
  });

  describe('filterByTenant', () => {
    let ctx: TenantContext;

    beforeEach(() => {
      ctx = new TenantContext('tenant-filter');
    });

    it('should filter records by tenant', () => {
      const records = [
        { id: '1', tenantId: 'tenant-filter', name: 'A' },
        { id: '2', tenantId: 'other-tenant', name: 'B' },
        { id: '3', tenantId: 'tenant-filter', name: 'C' },
        { id: '4', tenantId: 'another-tenant', name: 'D' },
      ];

      const filtered = ctx.filterByTenant(records);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((r) => r.name)).toEqual(['A', 'C']);
    });

    it('should return empty array when no records match', () => {
      const records = [{ id: '1', tenantId: 'other-tenant', name: 'A' }];

      const filtered = ctx.filterByTenant(records);
      expect(filtered).toEqual([]);
    });
  });

  describe('toString and toJSON', () => {
    it('should return string representation', () => {
      const ctx = new TenantContext('tenant-str');
      expect(ctx.toString()).toBe('TenantContext(tenant-str)');
    });

    it('should return JSON representation', () => {
      const ctx = new TenantContext('tenant-json');
      expect(ctx.toJSON()).toEqual({ tenantId: 'tenant-json' });
    });
  });
});

describe('isValidTenantId', () => {
  it('should return true for valid tenant IDs', () => {
    expect(isValidTenantId('tenant-123')).toBe(true);
    expect(isValidTenantId('org_abc')).toBe(true);
    expect(isValidTenantId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidTenantId('ABC123')).toBe(true);
  });

  it('should return false for invalid tenant IDs', () => {
    expect(isValidTenantId('')).toBe(false);
    expect(isValidTenantId('   ')).toBe(false);
    expect(isValidTenantId('tenant@123')).toBe(false);
    expect(isValidTenantId('tenant 123')).toBe(false);
    expect(isValidTenantId(null)).toBe(false);
    expect(isValidTenantId(undefined)).toBe(false);
    expect(isValidTenantId(123)).toBe(false);
    expect(isValidTenantId({})).toBe(false);
  });

  it('should return false for IDs exceeding max length', () => {
    expect(isValidTenantId('a'.repeat(129))).toBe(false);
    expect(isValidTenantId('a'.repeat(128))).toBe(true);
  });
});

describe('createTenantContext', () => {
  it('should create TenantContext instance', () => {
    const ctx = createTenantContext('tenant-factory');
    expect(ctx).toBeInstanceOf(TenantContext);
    expect(ctx.tenantId).toBe('tenant-factory');
  });

  it('should pass options to constructor', () => {
    const ctx = createTenantContext('invalid@id', { validateOnCreate: false });
    expect(ctx.tenantId).toBe('invalid@id');
  });
});

describe('extractTenantId', () => {
  it('should extract tenantId from object', () => {
    const source = { tenantId: 'tenant-extract', other: 'data' };
    expect(extractTenantId(source)).toBe('tenant-extract');
  });

  it('should try multiple keys in order', () => {
    const source1 = { tenant_id: 'from-underscore' };
    expect(extractTenantId(source1)).toBe('from-underscore');

    const source2 = { 'x-tenant-id': 'from-header' };
    expect(extractTenantId(source2)).toBe('from-header');

    const source3 = { organizationId: 'from-org' };
    expect(extractTenantId(source3)).toBe('from-org');
  });

  it('should use custom keys', () => {
    const source = { myTenantKey: 'custom-value' };
    expect(extractTenantId(source, ['myTenantKey'])).toBe('custom-value');
  });

  it('should return null if not found', () => {
    const source = { other: 'data' };
    expect(extractTenantId(source)).toBeNull();
  });

  it('should return null for invalid tenant IDs', () => {
    const source = { tenantId: '' };
    expect(extractTenantId(source)).toBeNull();
  });
});

describe('withTenantContext', () => {
  it('should create TenantContext from request', () => {
    const getTenantId = (req: { headers: { tenantId: string } }): string => req.headers.tenantId;
    const middleware = withTenantContext(getTenantId);

    const req = { headers: { tenantId: 'tenant-middleware' } };
    const ctx = middleware(req);

    expect(ctx).toBeInstanceOf(TenantContext);
    expect(ctx.tenantId).toBe('tenant-middleware');
  });

  it('should throw TenantError when tenant ID not found', () => {
    const getTenantId = (): null => null;
    const middleware = withTenantContext(getTenantId);

    expect(() => middleware({})).toThrow(TenantError);
    try {
      middleware({});
    } catch (error) {
      expect((error as TenantError).code).toBe('TENANT_NOT_FOUND');
    }
  });
});

describe('hasTenantId', () => {
  it('should return true for objects with tenantId', () => {
    expect(hasTenantId({ tenantId: 'abc', other: 'data' })).toBe(true);
  });

  it('should return false for objects without tenantId', () => {
    expect(hasTenantId({ other: 'data' })).toBe(false);
    expect(hasTenantId(null)).toBe(false);
    expect(hasTenantId(undefined)).toBe(false);
    expect(hasTenantId('string')).toBe(false);
  });

  it('should return false for non-string tenantId', () => {
    expect(hasTenantId({ tenantId: 123 })).toBe(false);
    expect(hasTenantId({ tenantId: null })).toBe(false);
  });
});

describe('stripTenantId', () => {
  it('should remove tenantId from object', () => {
    const obj = { tenantId: 'tenant-123', id: '1', name: 'Test' };
    const result = stripTenantId(obj);

    expect(result).toEqual({ id: '1', name: 'Test' });
    expect('tenantId' in result).toBe(false);
  });

  it('should preserve all other properties', () => {
    const obj = {
      tenantId: 'tenant-123',
      nested: { foo: 'bar' },
      array: [1, 2, 3],
    };
    const result = stripTenantId(obj);

    expect(result.nested).toEqual({ foo: 'bar' });
    expect(result.array).toEqual([1, 2, 3]);
  });
});

describe('stripTenantIdFromMany', () => {
  it('should remove tenantId from all objects', () => {
    const objects = [
      { tenantId: 't1', id: '1', name: 'A' },
      { tenantId: 't2', id: '2', name: 'B' },
    ];

    const results = stripTenantIdFromMany(objects);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: '1', name: 'A' });
    expect(results[1]).toEqual({ id: '2', name: 'B' });
    expect(results.every((r) => !('tenantId' in r))).toBe(true);
  });

  it('should handle empty array', () => {
    expect(stripTenantIdFromMany([])).toEqual([]);
  });
});

describe('TenantError', () => {
  it('should create error with message and code', () => {
    const error = new TenantError('Test error', 'TEST_CODE');

    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('TenantError');
  });

  it('should be instance of Error', () => {
    const error = new TenantError('Test', 'CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(TenantError);
  });
});
