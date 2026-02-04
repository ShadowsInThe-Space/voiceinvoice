/**
 * Encrypted Sync Routes Tests
 *
 * Tests for the E2E encrypted sync endpoint.
 * The server stores encrypted blobs without decryption (Zero-Knowledge).
 *
 * @module tests/routes/encrypted-sync
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance, FastifyRequest } from 'fastify';

// Mock the license auth hook to allow testing
vi.mock('../../src/routes/license', () => ({
  registerLicenseRoutes: vi.fn(),
  createLicenseAuthHook: vi.fn().mockReturnValue(async (request: FastifyRequest) => {
    // Simulate license validation - extract tenant from header
    const licenseKey = request.headers['x-license-key'] as string | undefined;
    const tenantId = request.headers['x-tenant-id'] as string | undefined;
    if (!licenseKey) {
      throw { statusCode: 401, message: 'License key required' };
    }
    (request as FastifyRequest & { license: { licenseKey: string; tenantId?: string } }).license = {
      licenseKey,
      tenantId,
    };
  }),
}));

// Mock external services
vi.mock('../../src/services/speech-service', () => ({
  transcribeAudio: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../../src/server';

describe('Encrypted Sync Routes', () => {
  let server: FastifyInstance;

  const validLicenseKey = 'LIC-TEST-1234-5678';
  const validTenantId = 'tenant-abc-123-test-tenant';

  beforeAll(async () => {
    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/sync/encrypted', () => {
    const validPayload = {
      document_type: 'invoice',
      encrypted_content: 'SGVsbG8gV29ybGQh', // Base64 encoded "Hello World!"
      iv: 'AAAAAAAAAAAAAAAA', // 12 bytes base64
      embedding: Array(768).fill(0.1), // 768-dim vector
      metadata: {
        entity_id: 'invoice-123',
        entity_type: 'INVOICE',
        operation: 'CREATE',
        timestamp: Date.now(),
      },
      sync_version: 1,
    };

    it('should accept valid encrypted payload and return 201', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
          'Content-Type': 'application/json',
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success', true);
    });

    it('should return 401 when license key is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-tenant-id': validTenantId,
          'Content-Type': 'application/json',
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-license-key': validLicenseKey,
          'Content-Type': 'application/json',
        },
        payload: validPayload,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('tenant');
    });

    it('should return 400 when document_type is invalid', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
          'Content-Type': 'application/json',
        },
        payload: {
          ...validPayload,
          document_type: 'invalid_type',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when encrypted_content is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { encrypted_content, ...payloadWithoutContent } = validPayload;

      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
          'Content-Type': 'application/json',
        },
        payload: payloadWithoutContent,
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 when embedding has wrong dimensions', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
          'Content-Type': 'application/json',
        },
        payload: {
          ...validPayload,
          embedding: Array(100).fill(0.1), // Wrong dimension
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should accept payload without embedding for DELETE operations', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sync/encrypted',
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
          'Content-Type': 'application/json',
        },
        payload: {
          ...validPayload,
          embedding: undefined,
          metadata: {
            ...validPayload.metadata,
            operation: 'DELETE',
          },
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('should accept all valid document types', async () => {
      const documentTypes = [
        'invoice',
        'customer',
        'recording',
        'category',
        'bank_transaction',
        'app_settings',
      ];

      for (const docType of documentTypes) {
        const response = await server.inject({
          method: 'POST',
          url: '/api/sync/encrypted',
          headers: {
            'x-license-key': validLicenseKey,
            'x-tenant-id': validTenantId,
            'Content-Type': 'application/json',
          },
          payload: {
            ...validPayload,
            document_type: docType,
          },
        });

        expect(response.statusCode).toBe(201);
      }
    });
  });

  describe('GET /api/sync/encrypted/pull', () => {
    it('should return encrypted documents since timestamp', async () => {
      const since = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      const response = await server.inject({
        method: 'GET',
        url: `/api/sync/encrypted/pull?since=${encodeURIComponent(since)}`,
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('documents');
      expect(body).toHaveProperty('timestamp');
      expect(Array.isArray(body.documents)).toBe(true);
    });

    it('should return 401 when license key is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sync/encrypted/pull',
        headers: {
          'x-tenant-id': validTenantId,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 400 when tenant ID is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sync/encrypted/pull',
        headers: {
          'x-license-key': validLicenseKey,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should filter by document types', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sync/encrypted/pull?types=invoice,customer',
        headers: {
          'x-license-key': validLicenseKey,
          'x-tenant-id': validTenantId,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});
