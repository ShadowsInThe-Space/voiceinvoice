/**
 * TenantContext manages the current tenant identity for multi-tenant operations.
 * Used to set Supabase RLS context and ensure tenant isolation.
 *
 * @example
 * ```typescript
 * // Initialize tenant context after license validation
 * globalTenantContext.setTenant(deriveTenantId(licenseKey));
 *
 * // Use in Supabase queries
 * await supabase.rpc('set_tenant_context', { p_tenant_id: globalTenantContext.getTenantId() });
 * ```
 */
export class TenantContext {
  private tenantId: string | null = null;

  /**
   * Sets the current tenant ID.
   * Should be called after license validation with the derived tenant ID.
   *
   * @param tenantId - The tenant ID derived from the license key
   */
  setTenant(tenantId: string): void {
    this.tenantId = tenantId;
  }

  /**
   * Gets the current tenant ID.
   *
   * @returns The current tenant ID
   * @throws Error if tenant context has not been initialized
   */
  getTenantId(): string {
    if (!this.tenantId) {
      throw new Error('Tenant context not initialized');
    }
    return this.tenantId;
  }

  /**
   * Checks if the tenant context has been initialized.
   *
   * @returns true if a tenant ID has been set, false otherwise
   */
  isInitialized(): boolean {
    return this.tenantId !== null;
  }

  /**
   * Generates the SQL statement to set tenant context in Supabase.
   * This should be executed before any RLS-protected queries.
   *
   * @returns SQL SELECT statement that calls set_tenant_context()
   * @throws Error if tenant context has not been initialized
   */
  getContextSQL(): string {
    return `SELECT set_tenant_context('${this.getTenantId()}')`;
  }

  /**
   * Clears the tenant context.
   * Should be called on logout or license revocation.
   */
  clear(): void {
    this.tenantId = null;
  }
}

/**
 * Global singleton instance for app-wide tenant context.
 * Use this to share tenant context across modules.
 *
 * @example
 * ```typescript
 * import { globalTenantContext } from '@voiceinvoice/ai-orchestrator';
 *
 * // Set tenant on app initialization
 * globalTenantContext.setTenant(tenantId);
 *
 * // Access tenant from anywhere
 * const currentTenant = globalTenantContext.getTenantId();
 * ```
 */
export const globalTenantContext = new TenantContext();
