/**
 * License Service
 *
 * JWT-based license token generation and validation for VoiceInvoice Enterprise.
 * Handles secure license authentication and authorization.
 *
 * @module services/license-service
 */

import { createHmac, randomBytes } from 'crypto';

/**
 * Error messages for license-related operations.
 */
export const LICENSE_ERRORS = {
  LICENSE_NOT_FOUND: 'License not found',
  LICENSE_EXPIRED: 'License has expired',
  LICENSE_SUSPENDED: 'License is suspended',
  QUOTA_EXCEEDED: 'Monthly quota exceeded',
  NO_TOKEN: 'Authorization token required',
  INVALID_TOKEN: 'Invalid or expired token',
  MISSING_SECRET: 'JWT_SECRET environment variable is required',
} as const;

/**
 * Payload contained in a license JWT token.
 */
export interface LicenseTokenPayload {
  /** Unique license key identifier */
  licenseKey: string;
  /** Company name associated with the license */
  companyName: string;
  /** ISO date string when the license expires */
  expiresAt: string;
}

/**
 * Internal JWT header structure.
 */
interface JwtHeader {
  alg: string;
  typ: string;
}

/**
 * Internal JWT payload structure.
 */
interface JwtPayload extends LicenseTokenPayload {
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Options for token generation.
 */
export interface TokenOptions {
  /** Token expiration time (e.g., '24h', '7d', '1ms') */
  expiresIn?: string;
}

/**
 * Get the JWT secret from environment variables.
 *
 * @returns The JWT secret key
 * @throws Error if JWT_SECRET is not set
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(LICENSE_ERRORS.MISSING_SECRET);
  }
  return secret;
}

/**
 * Base64URL encode a string or buffer.
 *
 * @param input - String or Buffer to encode
 * @returns Base64URL encoded string
 */
function base64UrlEncode(input: string | Buffer): string {
  const base64 = Buffer.from(input).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL decode a string.
 *
 * @param input - Base64URL encoded string
 * @returns Decoded string
 */
function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Parse duration string to milliseconds.
 *
 * @param duration - Duration string (e.g., '24h', '7d', '1ms')
 * @returns Duration in milliseconds
 */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    return 24 * 60 * 60 * 1000; // Default: 24 hours
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
}

/**
 * Create HMAC-SHA256 signature.
 *
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns Base64URL encoded signature
 */
function createSignature(data: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(data);
  return base64UrlEncode(hmac.digest());
}

/**
 * Generate a JWT license token.
 *
 * Creates a cryptographically signed token containing license information
 * that can be used for API authentication.
 *
 * @param payload - License token payload
 * @param options - Token generation options
 * @returns Signed JWT token string
 *
 * @example
 * ```typescript
 * const token = generateLicenseToken({
 *   licenseKey: 'LIC-001',
 *   companyName: 'Acme GmbH',
 *   expiresAt: '2025-12-31T23:59:59Z',
 * });
 * ```
 */
export function generateLicenseToken(
  payload: LicenseTokenPayload,
  options: TokenOptions = {}
): string {
  const secret = getJwtSecret();
  const { expiresIn = '24h' } = options;

  const now = Math.floor(Date.now() / 1000);
  const expiresInMs = parseDuration(expiresIn);
  const exp = Math.floor((Date.now() + expiresInMs) / 1000);

  const header: JwtHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const jwtPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp,
    jti: randomBytes(16).toString('hex'),
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(jwtPayload));
  const signature = createSignature(`${headerEncoded}.${payloadEncoded}`, secret);

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

/**
 * Verify and decode a JWT license token.
 *
 * Validates the token signature and expiration, returning the decoded
 * payload if valid.
 *
 * @param token - JWT token string to verify
 * @returns Decoded token payload or null if invalid
 *
 * @example
 * ```typescript
 * const payload = verifyLicenseToken(token);
 * if (payload) {
 *   console.log(`License key: ${payload.licenseKey}`);
 * } else {
 *   console.error('Invalid token');
 * }
 * ```
 */
export function verifyLicenseToken(token: string): LicenseTokenPayload | null {
  try {
    const secret = getJwtSecret();
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [headerEncoded, payloadEncoded, signature] = parts;

    // Verify signature
    const expectedSignature = createSignature(`${headerEncoded}.${payloadEncoded}`, secret);

    if (signature !== expectedSignature) {
      return null;
    }

    // Decode and validate payload
    const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadEncoded));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    // Return only the license-relevant fields
    return {
      licenseKey: payload.licenseKey,
      companyName: payload.companyName,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Extract token from Authorization header.
 *
 * @param authHeader - Authorization header value
 * @returns Token string or null if not found/invalid format
 *
 * @example
 * ```typescript
 * const token = extractBearerToken('Bearer eyJhbGc...');
 * ```
 */
export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}
