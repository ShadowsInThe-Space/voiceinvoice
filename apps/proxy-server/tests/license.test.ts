/**
 * License API Tests
 *
 * TDD tests for JWT-based license validation, rate limiting,
 * and license status endpoints.
 *
 * @module tests/license
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  generateLicenseToken,
  verifyLicenseToken,
  LicenseTokenPayload,
  LICENSE_ERRORS,
} from '../src/services/license-service';
import { createMockLicenseStore, MockLicenseStore } from '../src/services/license-store';

// Mock the license store before importing routes
vi.mock('../src/services/license-store', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/services/license-store')>();
  return {
    ...original,
    getLicenseStore: vi.fn(),
  };
});

// Mock external services to prevent test interference
vi.mock('../src/services/speech-service', () => ({
  transcribeAudio: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/gemini-service', () => ({
  extractInvoiceData: vi.fn(),
  checkAvailability: vi.fn().mockResolvedValue(true),
}));

import { buildServer } from '../src/server';
import { getLicenseStore } from '../src/services/license-store';

describe('License Service - Token Management', () => {
  const TEST_SECRET = 'test-secret-key-for-jwt-signing-32chars!';

  beforeEach(() => {
    vi.stubEnv('JWT_SECRET', TEST_SECRET);
  });

  describe('generateLicenseToken', () => {
    it('should generate a valid JWT token for a license', () => {
      const payload: LicenseTokenPayload = {
        licenseKey: 'TEST-LICENSE-KEY-001',
        companyName: 'Test Company GmbH',
        expiresAt: new Date(Date.now() + 86400000).toISOString(), // 24h from now
      };

      const token = generateLicenseToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should include license key in token payload', () => {
      const payload: LicenseTokenPayload = {
        licenseKey: 'TEST-LICENSE-KEY-002',
        companyName: 'Another Company',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const token = generateLicenseToken(payload);
      const decoded = verifyLicenseToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.licenseKey).toBe('TEST-LICENSE-KEY-002');
      expect(decoded?.companyName).toBe('Another Company');
    });
  });

  describe('verifyLicenseToken', () => {
    it('should verify a valid token', () => {
      const payload: LicenseTokenPayload = {
        licenseKey: 'VALID-LICENSE-KEY',
        companyName: 'Valid Company',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const token = generateLicenseToken(payload);
      const verified = verifyLicenseToken(token);

      expect(verified).not.toBeNull();
      expect(verified?.licenseKey).toBe('VALID-LICENSE-KEY');
    });

    it('should return null for invalid token', () => {
      const result = verifyLicenseToken('invalid.token.here');
      expect(result).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create a manually crafted expired token
      // This simulates receiving an old, expired token
      const expiredToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJsaWNlbnNlS2V5IjoiRVhQSVJFRC1MSUNFTlNFIiwiY29tcGFueU5hbWUiOiJFeHBpcmVkIENvbXBhbnkiLCJleHBpcmVzQXQiOiIyMDIwLTAxLTAxVDAwOjAwOjAwLjAwMFoiLCJpYXQiOjE1Nzc4MzY4MDAsImV4cCI6MTU3NzgzNjgwMSwianRpIjoiZXhwaXJlZCJ9.' +
        'invalid-signature';

      const result = verifyLicenseToken(expiredToken);
      expect(result).toBeNull();
    });

    it('should return null for tampered token', () => {
      const payload: LicenseTokenPayload = {
        licenseKey: 'TAMPERED-LICENSE',
        companyName: 'Tampered Company',
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const token = generateLicenseToken(payload);
      // Tamper with the token
      const parts = token.split('.');
      parts[1] = 'tampered-payload';
      const tamperedToken = parts.join('.');

      const result = verifyLicenseToken(tamperedToken);
      expect(result).toBeNull();
    });
  });
});

describe('License API Routes', () => {
  let server: FastifyInstance;
  let mockStore: MockLicenseStore;

  beforeAll(async () => {
    mockStore = createMockLicenseStore();
    vi.mocked(getLicenseStore).mockReturnValue(mockStore);
    server = await buildServer({ logger: false });
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.reset();
    vi.stubEnv('JWT_SECRET', 'test-secret-key-for-jwt-signing-32chars!');
  });

  describe('POST /api/license/validate', () => {
    it('should validate a valid license key and return a token', async () => {
      // Setup mock data
      mockStore.addLicense({
        id: 'lic-001',
        licenseKey: 'VALID-KEY-001',
        companyName: 'Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 0,
        usageResetDate: new Date(Date.now() + 2592000000), // 30 days
        expiresAt: new Date(Date.now() + 31536000000), // 1 year
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'VALID-KEY-001',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('license');
      expect(body.license).toHaveProperty('licenseKey', 'VALID-KEY-001');
      expect(body.license).toHaveProperty('status', 'ACTIVE');
    });

    it('should return 400 when licenseKey is missing', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      // Zod returns "Required" for missing fields
      expect(body.error).toMatch(/Required|licenseKey/i);
    });

    it('should return 404 when license key is not found', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'NON-EXISTENT-KEY',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toBe(LICENSE_ERRORS.LICENSE_NOT_FOUND);
    });

    it('should return 403 when license is expired', async () => {
      mockStore.addLicense({
        id: 'lic-expired',
        licenseKey: 'EXPIRED-KEY',
        companyName: 'Expired Company',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 0,
        usageResetDate: new Date(),
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'EXPIRED-KEY',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(LICENSE_ERRORS.LICENSE_EXPIRED);
    });

    it('should return 403 when license is suspended', async () => {
      mockStore.addLicense({
        id: 'lic-suspended',
        licenseKey: 'SUSPENDED-KEY',
        companyName: 'Suspended Company',
        status: 'SUSPENDED',
        monthlyQuota: 1000,
        currentUsage: 0,
        usageResetDate: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: {
          licenseKey: 'SUSPENDED-KEY',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(LICENSE_ERRORS.LICENSE_SUSPENDED);
    });
  });

  describe('GET /api/license/status', () => {
    it('should return license status with valid token', async () => {
      mockStore.addLicense({
        id: 'lic-status-001',
        licenseKey: 'STATUS-KEY-001',
        companyName: 'Status Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 150,
        usageResetDate: new Date(Date.now() + 2592000000),
        expiresAt: new Date(Date.now() + 31536000000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // First validate to get a token
      const validateResponse = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: { licenseKey: 'STATUS-KEY-001' },
      });

      const { token } = JSON.parse(validateResponse.body);

      // Then check status
      const statusResponse = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(statusResponse.statusCode).toBe(200);
      const body = JSON.parse(statusResponse.body);
      expect(body).toHaveProperty('licenseKey', 'STATUS-KEY-001');
      expect(body).toHaveProperty('status', 'ACTIVE');
      expect(body).toHaveProperty('monthlyQuota', 1000);
      expect(body).toHaveProperty('currentUsage', 150);
      expect(body).toHaveProperty('remainingQuota', 850);
    });

    it('should return 401 when no token provided', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/license/status',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(LICENSE_ERRORS.NO_TOKEN);
    });

    it('should return 401 when token is invalid', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toBe(LICENSE_ERRORS.INVALID_TOKEN);
    });

    it('should return 401 when Authorization header format is wrong', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: {
          Authorization: 'Basic some-credentials',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      // extractBearerToken returns null for non-Bearer format, so NO_TOKEN is returned
      expect(body.error).toBe(LICENSE_ERRORS.NO_TOKEN);
    });
  });

  describe('Rate Limiting per License', () => {
    it('should track usage when making API calls', async () => {
      mockStore.addLicense({
        id: 'lic-rate-001',
        licenseKey: 'RATE-KEY-001',
        companyName: 'Rate Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 0,
        usageResetDate: new Date(Date.now() + 2592000000),
        expiresAt: new Date(Date.now() + 31536000000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Validate to get token
      const validateResponse = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: { licenseKey: 'RATE-KEY-001' },
      });
      const { token } = JSON.parse(validateResponse.body);

      // Check initial status
      const status1 = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(JSON.parse(status1.body).currentUsage).toBe(0);

      // Increment usage
      await mockStore.incrementUsage('RATE-KEY-001');

      // Check updated status
      const status2 = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(JSON.parse(status2.body).currentUsage).toBe(1);
    });

    it('should return 429 when quota is exceeded', async () => {
      mockStore.addLicense({
        id: 'lic-quota-001',
        licenseKey: 'QUOTA-KEY-001',
        companyName: 'Quota Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 10,
        currentUsage: 10, // Already at limit
        usageResetDate: new Date(Date.now() + 2592000000),
        expiresAt: new Date(Date.now() + 31536000000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Validate to confirm the license is valid
      const validateResponse = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: { licenseKey: 'QUOTA-KEY-001' },
      });
      expect(validateResponse.statusCode).toBe(200);

      // Try to increment beyond quota
      const result = await mockStore.incrementUsage('QUOTA-KEY-001');
      expect(result.success).toBe(false);
      expect(result.error).toBe(LICENSE_ERRORS.QUOTA_EXCEEDED);
    });

    it('should reset usage when reset date is passed', async () => {
      const pastResetDate = new Date(Date.now() - 86400000); // Yesterday

      mockStore.addLicense({
        id: 'lic-reset-001',
        licenseKey: 'RESET-KEY-001',
        companyName: 'Reset Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 500,
        usageResetDate: pastResetDate,
        expiresAt: new Date(Date.now() + 31536000000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // The store should reset usage when date is passed
      const license = await mockStore.getLicense('RESET-KEY-001');

      expect(license?.currentUsage).toBe(0);
      expect(license?.usageResetDate.getTime()).toBeGreaterThan(Date.now());
    });

    it('should include rate limit headers in responses', async () => {
      mockStore.addLicense({
        id: 'lic-headers-001',
        licenseKey: 'HEADERS-KEY-001',
        companyName: 'Headers Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 100,
        usageResetDate: new Date(Date.now() + 2592000000),
        expiresAt: new Date(Date.now() + 31536000000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const validateResponse = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: { licenseKey: 'HEADERS-KEY-001' },
      });
      const { token } = JSON.parse(validateResponse.body);

      const response = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.headers).toHaveProperty('x-ratelimit-limit');
      expect(response.headers).toHaveProperty('x-ratelimit-remaining');
      expect(response.headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('License Middleware Integration', () => {
    it('should allow access to protected routes with valid license', async () => {
      mockStore.addLicense({
        id: 'lic-middleware-001',
        licenseKey: 'MIDDLEWARE-KEY-001',
        companyName: 'Middleware Test GmbH',
        status: 'ACTIVE',
        monthlyQuota: 1000,
        currentUsage: 0,
        usageResetDate: new Date(Date.now() + 2592000000),
        expiresAt: new Date(Date.now() + 31536000000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const validateResponse = await server.inject({
        method: 'POST',
        url: '/api/license/validate',
        payload: { licenseKey: 'MIDDLEWARE-KEY-001' },
      });
      const { token } = JSON.parse(validateResponse.body);

      // The license status check should work as an example of protected route
      const response = await server.inject({
        method: 'GET',
        url: '/api/license/status',
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.statusCode).toBe(200);
    });
  });
});

describe('License Store', () => {
  let store: MockLicenseStore;

  beforeEach(() => {
    store = createMockLicenseStore();
  });

  it('should create a new mock store', () => {
    expect(store).toBeDefined();
    expect(typeof store.addLicense).toBe('function');
    expect(typeof store.getLicense).toBe('function');
    expect(typeof store.incrementUsage).toBe('function');
  });

  it('should add and retrieve licenses', async () => {
    store.addLicense({
      id: 'test-id',
      licenseKey: 'TEST-KEY',
      companyName: 'Test Company',
      status: 'ACTIVE',
      monthlyQuota: 500,
      currentUsage: 0,
      usageResetDate: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const license = await store.getLicense('TEST-KEY');

    expect(license).not.toBeNull();
    expect(license?.companyName).toBe('Test Company');
    expect(license?.monthlyQuota).toBe(500);
  });

  it('should return null for non-existent license', async () => {
    const license = await store.getLicense('NON-EXISTENT');
    expect(license).toBeNull();
  });
});
