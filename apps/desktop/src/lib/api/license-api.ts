import { LicenseStatus } from '@voiceinvoice/shared-types';

export interface License {
  licenseKey: string;
  companyName: string;
  status: LicenseStatus;
  monthlyQuota: number;
  currentUsage: number;
  remainingQuota?: number;
  usageResetDate?: string;
  expiresAt: string;
}

export interface ValidateLicenseResponse {
  token: string;
  license: License;
}

export interface LicenseStatusResponse extends License {
  usageResetDate: string;
}

export interface CheckoutSessionParams {
  planId: string;
  companyName: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class LicenseApi {
  private static instance: LicenseApi;
  private token: string | null = null;

  private constructor() {}

  public static getInstance(): LicenseApi {
    if (!LicenseApi.instance) {
      LicenseApi.instance = new LicenseApi();
    }
    return LicenseApi.instance;
  }

  public setToken(token: string) {
    this.token = token;
    localStorage.setItem('voiceinvoice_license_token', token);
  }

  public getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('voiceinvoice_license_token');
    }
    return this.token;
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    const headers = new Headers(options.headers);

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    return response;
  }

  /**
   * Validate a license key and get an auth token.
   * @param licenseKey
   */
  public async validateLicense(licenseKey: string): Promise<ValidateLicenseResponse> {
    const response = await fetch(`${API_BASE_URL}/api/license/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ licenseKey }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to validate license');
    }

    const data = await response.json();
    this.setToken(data.token);
    return data;
  }

  /**
   * Get current license status.
   */
  public async getStatus(): Promise<LicenseStatusResponse> {
    const response = await this.fetchWithAuth('/api/license/status');

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Unauthorized');
      }
      const error = await response.json();
      throw new Error(error.error || 'Failed to get license status');
    }

    return response.json();
  }

  /**
   * Create a Stripe checkout session for a license plan.
   * @param params
   */
  public async createCheckoutSession(
    params: CheckoutSessionParams
  ): Promise<CheckoutSessionResponse> {
    const response = await fetch(`${API_BASE_URL}/api/stripe/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create checkout session');
    }

    return response.json();
  }

  public logout() {
    this.token = null;
    localStorage.removeItem('voiceinvoice_license_token');
  }
}

export const licenseApi = LicenseApi.getInstance();
