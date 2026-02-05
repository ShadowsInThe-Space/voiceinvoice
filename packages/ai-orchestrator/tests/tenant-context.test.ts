import { describe, it, expect, beforeEach } from 'vitest';
import { TenantContext, globalTenantContext } from '../src/rag/tenant-context';

describe('TenantContext', () => {
  let context: TenantContext;

  beforeEach(() => {
    context = new TenantContext();
  });

  describe('setTenant / getTenantId', () => {
    it('should set and get tenant ID', () => {
      context.setTenant('tenant-123');
      expect(context.getTenantId()).toBe('tenant-123');
    });

    it('should throw if tenant not set', () => {
      expect(() => context.getTenantId()).toThrow('Tenant context not initialized');
    });

    it('should allow changing tenant ID', () => {
      context.setTenant('tenant-123');
      context.setTenant('tenant-456');
      expect(context.getTenantId()).toBe('tenant-456');
    });
  });

  describe('isInitialized', () => {
    it('should return false when not initialized', () => {
      expect(context.isInitialized()).toBe(false);
    });

    it('should return true when initialized', () => {
      context.setTenant('tenant-123');
      expect(context.isInitialized()).toBe(true);
    });
  });

  describe('getContextSQL', () => {
    it('should generate SQL for setting context', () => {
      context.setTenant('tenant-456');
      const sql = context.getContextSQL();
      expect(sql).toContain("set_tenant_context('tenant-456')");
    });

    it('should throw if tenant not set', () => {
      expect(() => context.getContextSQL()).toThrow('Tenant context not initialized');
    });
  });

  describe('clear', () => {
    it('should clear the tenant context', () => {
      context.setTenant('tenant-123');
      expect(context.isInitialized()).toBe(true);

      context.clear();
      expect(context.isInitialized()).toBe(false);
    });

    it('should cause getTenantId to throw after clear', () => {
      context.setTenant('tenant-123');
      context.clear();
      expect(() => context.getTenantId()).toThrow('Tenant context not initialized');
    });
  });

  describe('globalTenantContext singleton', () => {
    beforeEach(() => {
      globalTenantContext.clear();
    });

    it('should be a singleton instance', () => {
      globalTenantContext.setTenant('global-tenant');
      expect(globalTenantContext.getTenantId()).toBe('global-tenant');
    });

    it('should persist across imports', () => {
      globalTenantContext.setTenant('persistent-tenant');
      // In a real scenario, this would be accessed from another module
      expect(globalTenantContext.isInitialized()).toBe(true);
    });
  });
});
