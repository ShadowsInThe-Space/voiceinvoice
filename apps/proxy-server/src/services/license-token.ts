/**
 * License Token Service
 *
 * Issues and verifies JWTs for license-based authentication.
 *
 * @module services/license-token
 */

import jwt, { JwtPayload } from 'jsonwebtoken';
import { LicenseTokenPayload } from './license-service';

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Get the JWT secret from environment.
 *
 * @returns JWT secret string
 * @throws Error if secret is not configured
 */
function getJwtSecret(): string {
  const secret = process.env.LICENSE_JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('LICENSE_JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * Calculates token TTL in seconds, respecting license expiry.
 *
 * @param expiresAt - License expiration date
 * @param ttlSeconds - Desired TTL in seconds
 * @returns TTL in seconds
 */
function resolveTtlSeconds(expiresAt?: Date, ttlSeconds?: number): number {
  const maxTtl = ttlSeconds ?? DEFAULT_TTL_SECONDS;
  if (!expiresAt) {
    return maxTtl;
  }

  const secondsUntilExpiry = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
  if (secondsUntilExpiry <= 0) {
    return 1;
  }

  return Math.min(maxTtl, secondsUntilExpiry);
}

/**
 * Signs a license JWT.
 *
 * @param payload - License token payload
 * @param expiresAt - License expiration date
 * @param ttlSeconds - Optional TTL override in seconds
 * @returns Signed JWT
 */
export function signLicenseToken(
  payload: LicenseTokenPayload,
  expiresAt?: Date,
  ttlSeconds?: number
): string {
  const secret = getJwtSecret();
  const expiresIn = resolveTtlSeconds(expiresAt, ttlSeconds);

  return jwt.sign(payload, secret, {
    expiresIn,
    issuer: 'voiceinvoice-proxy',
    subject: payload.licenseKey,
  });
}

/**
 * Verifies a license JWT and returns the payload.
 *
 * @param token - JWT string
 * @returns License token payload
 * @throws Error if token is invalid or expired
 */
export function verifyLicenseToken(token: string): LicenseTokenPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret, {
    issuer: 'voiceinvoice-proxy',
  }) as JwtPayload & LicenseTokenPayload;

  if (!decoded.licenseKey || !decoded.tenantId) {
    throw new Error('Invalid license token payload');
  }

  return {
    licenseKey: decoded.licenseKey,
    tenantId: decoded.tenantId,
  };
}
