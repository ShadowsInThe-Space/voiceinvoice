import { describe, it, expect } from 'vitest';
import {
  SERVER_DATABASE_VERSION,
  DATABASE_PROVIDER,
  DEFAULT_SERVER_CONFIG,
  TENANT_SCOPED_MODELS,
  isTenantScopedModel,
  createAuditLogEntry,
  AUDIT_ACTIONS,
  INVOICE_STATUS,
  RECORDING_STATUS,
  MATCH_STATUS,
  CUSTOMER_TYPE,
  CATEGORY_TYPE,
  type TenantScopedModelName,
  type AuditAction,
  type InvoiceStatus,
  type RecordingStatus,
  type MatchStatus,
  type CustomerType,
  type CategoryType,
} from '../src/server/index';

describe('Server Database Module', () => {
  describe('Constants', () => {
    it('should export SERVER_DATABASE_VERSION', () => {
      expect(SERVER_DATABASE_VERSION).toBe('0.1.0');
      expect(SERVER_DATABASE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('should export DATABASE_PROVIDER as postgresql', () => {
      expect(DATABASE_PROVIDER).toBe('postgresql');
    });

    it('should export DEFAULT_SERVER_CONFIG with correct values', () => {
      expect(DEFAULT_SERVER_CONFIG.connectionPoolSize).toBe(10);
      expect(DEFAULT_SERVER_CONFIG.connectionTimeoutMs).toBe(10000);
      expect(DEFAULT_SERVER_CONFIG.queryTimeoutMs).toBe(30000);
      expect(DEFAULT_SERVER_CONFIG.logging).toBe(false);
      expect(DEFAULT_SERVER_CONFIG.ssl).toBe(true);
    });
  });

  describe('TENANT_SCOPED_MODELS', () => {
    it('should include all multi-tenant models', () => {
      expect(TENANT_SCOPED_MODELS).toContain('Customer');
      expect(TENANT_SCOPED_MODELS).toContain('Invoice');
      expect(TENANT_SCOPED_MODELS).toContain('InvoiceItem');
      expect(TENANT_SCOPED_MODELS).toContain('Recording');
      expect(TENANT_SCOPED_MODELS).toContain('Category');
      expect(TENANT_SCOPED_MODELS).toContain('BankTransaction');
      expect(TENANT_SCOPED_MODELS).toContain('AppSettings');
      expect(TENANT_SCOPED_MODELS).toContain('AuditLog');
    });

    it('should have exactly 8 models', () => {
      expect(TENANT_SCOPED_MODELS).toHaveLength(8);
    });
  });

  describe('isTenantScopedModel', () => {
    it('should return true for valid tenant-scoped models', () => {
      expect(isTenantScopedModel('Customer')).toBe(true);
      expect(isTenantScopedModel('Invoice')).toBe(true);
      expect(isTenantScopedModel('AuditLog')).toBe(true);
    });

    it('should return false for non-tenant-scoped models', () => {
      expect(isTenantScopedModel('User')).toBe(false);
      expect(isTenantScopedModel('Tenant')).toBe(false);
      expect(isTenantScopedModel('Session')).toBe(false);
      expect(isTenantScopedModel('')).toBe(false);
    });

    it('should work as type guard', () => {
      const modelName = 'Customer' as string;
      if (isTenantScopedModel(modelName)) {
        // TypeScript should recognize this as TenantScopedModelName
        const _typed: TenantScopedModelName = modelName;
        expect(_typed).toBe('Customer');
      }
    });
  });

  describe('AUDIT_ACTIONS', () => {
    it('should export all audit action types', () => {
      expect(AUDIT_ACTIONS.CREATE).toBe('CREATE');
      expect(AUDIT_ACTIONS.UPDATE).toBe('UPDATE');
      expect(AUDIT_ACTIONS.DELETE).toBe('DELETE');
      expect(AUDIT_ACTIONS.LOGIN).toBe('LOGIN');
      expect(AUDIT_ACTIONS.LOGOUT).toBe('LOGOUT');
      expect(AUDIT_ACTIONS.EXPORT).toBe('EXPORT');
      expect(AUDIT_ACTIONS.IMPORT).toBe('IMPORT');
      expect(AUDIT_ACTIONS.VIEW).toBe('VIEW');
      expect(AUDIT_ACTIONS.DOWNLOAD).toBe('DOWNLOAD');
      expect(AUDIT_ACTIONS.SHARE).toBe('SHARE');
    });
  });

  describe('createAuditLogEntry', () => {
    it('should create basic audit log entry', () => {
      const entry = createAuditLogEntry('tenant-123', 'CREATE', 'Customer');

      expect(entry.tenantId).toBe('tenant-123');
      expect(entry.action).toBe('CREATE');
      expect(entry.entityType).toBe('Customer');
      expect(entry.entityId).toBeUndefined();
      expect(entry.userId).toBeUndefined();
    });

    it('should include optional fields when provided', () => {
      const entry = createAuditLogEntry('tenant-123', 'UPDATE', 'Invoice', {
        entityId: 'inv-456',
        userId: 'user-789',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      });

      expect(entry.entityId).toBe('inv-456');
      expect(entry.userId).toBe('user-789');
      expect(entry.ipAddress).toBe('192.168.1.1');
      expect(entry.userAgent).toBe('Mozilla/5.0');
    });

    it('should stringify previousValues and newValues', () => {
      const previousValues = { status: 'DRAFT', amount: 100 };
      const newValues = { status: 'SENT', amount: 100 };

      const entry = createAuditLogEntry('tenant-123', 'UPDATE', 'Invoice', {
        previousValues,
        newValues,
      });

      expect(entry.previousValues).toBe(JSON.stringify(previousValues));
      expect(entry.newValues).toBe(JSON.stringify(newValues));
    });

    it('should stringify metadata', () => {
      const metadata = { source: 'api', version: '1.0' };

      const entry = createAuditLogEntry('tenant-123', 'CREATE', 'Customer', {
        metadata,
      });

      expect(entry.metadata).toBe(JSON.stringify(metadata));
    });

    it('should work with all audit action types', () => {
      Object.values(AUDIT_ACTIONS).forEach((action) => {
        const entry = createAuditLogEntry('t1', action, 'Entity');
        expect(entry.action).toBe(action);
      });
    });
  });

  describe('Status Enums', () => {
    describe('INVOICE_STATUS', () => {
      it('should export all invoice statuses', () => {
        expect(INVOICE_STATUS.DRAFT).toBe('DRAFT');
        expect(INVOICE_STATUS.SENT).toBe('SENT');
        expect(INVOICE_STATUS.PAID).toBe('PAID');
        expect(INVOICE_STATUS.OVERDUE).toBe('OVERDUE');
        expect(INVOICE_STATUS.CANCELLED).toBe('CANCELLED');
      });

      it('should have correct type', () => {
        const status: InvoiceStatus = 'DRAFT';
        expect(status).toBe(INVOICE_STATUS.DRAFT);
      });
    });

    describe('RECORDING_STATUS', () => {
      it('should export all recording statuses', () => {
        expect(RECORDING_STATUS.PENDING).toBe('PENDING');
        expect(RECORDING_STATUS.PROCESSING).toBe('PROCESSING');
        expect(RECORDING_STATUS.COMPLETED).toBe('COMPLETED');
        expect(RECORDING_STATUS.FAILED).toBe('FAILED');
      });

      it('should have correct type', () => {
        const status: RecordingStatus = 'PENDING';
        expect(status).toBe(RECORDING_STATUS.PENDING);
      });
    });

    describe('MATCH_STATUS', () => {
      it('should export all match statuses', () => {
        expect(MATCH_STATUS.PENDING).toBe('PENDING');
        expect(MATCH_STATUS.MATCHED).toBe('MATCHED');
        expect(MATCH_STATUS.UNMATCHED).toBe('UNMATCHED');
        expect(MATCH_STATUS.MANUAL).toBe('MANUAL');
      });

      it('should have correct type', () => {
        const status: MatchStatus = 'MATCHED';
        expect(status).toBe(MATCH_STATUS.MATCHED);
      });
    });

    describe('CUSTOMER_TYPE', () => {
      it('should export all customer types', () => {
        expect(CUSTOMER_TYPE.CUSTOMER).toBe('CUSTOMER');
        expect(CUSTOMER_TYPE.SUPPLIER).toBe('SUPPLIER');
        expect(CUSTOMER_TYPE.BOTH).toBe('BOTH');
      });

      it('should have correct type', () => {
        const type: CustomerType = 'CUSTOMER';
        expect(type).toBe(CUSTOMER_TYPE.CUSTOMER);
      });
    });

    describe('CATEGORY_TYPE', () => {
      it('should export all category types', () => {
        expect(CATEGORY_TYPE.INCOME).toBe('INCOME');
        expect(CATEGORY_TYPE.EXPENSE).toBe('EXPENSE');
        expect(CATEGORY_TYPE.BOTH).toBe('BOTH');
      });

      it('should have correct type', () => {
        const type: CategoryType = 'EXPENSE';
        expect(type).toBe(CATEGORY_TYPE.EXPENSE);
      });
    });
  });

  describe('Type Exports', () => {
    it('should export type aliases that work at compile time', () => {
      // These are compile-time checks - if they compile, the types are exported correctly
      const modelName: TenantScopedModelName = 'Customer';
      const action: AuditAction = 'CREATE';
      const invoiceStatus: InvoiceStatus = 'PAID';
      const recordingStatus: RecordingStatus = 'COMPLETED';
      const matchStatus: MatchStatus = 'MATCHED';
      const customerType: CustomerType = 'BOTH';
      const categoryType: CategoryType = 'INCOME';

      expect(modelName).toBe('Customer');
      expect(action).toBe('CREATE');
      expect(invoiceStatus).toBe('PAID');
      expect(recordingStatus).toBe('COMPLETED');
      expect(matchStatus).toBe('MATCHED');
      expect(customerType).toBe('BOTH');
      expect(categoryType).toBe('INCOME');
    });
  });

  describe('Re-exports from tenant-context', () => {
    it('should re-export TenantContext utilities', async () => {
      // Import from server/index to verify re-exports work
      const serverModule = await import('../src/server/index');

      expect(serverModule.TenantContext).toBeDefined();
      expect(serverModule.TenantError).toBeDefined();
      expect(serverModule.createTenantContext).toBeDefined();
      expect(serverModule.extractTenantId).toBeDefined();
      expect(serverModule.withTenantContext).toBeDefined();
      expect(serverModule.isValidTenantId).toBeDefined();
      expect(serverModule.hasTenantId).toBeDefined();
      expect(serverModule.stripTenantId).toBeDefined();
      expect(serverModule.stripTenantIdFromMany).toBeDefined();
    });
  });
});
