import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  Shield,
  Key,
  AlertTriangle,
  CheckCircle,
  Clock,
  ShoppingCart,
  Star,
  Zap,
  Crown,
  Settings,
} from 'lucide-react';
import { licenseApi, License } from '../../lib/api/license-api';

const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    price: '29€',
    description: 'Für Einzelunternehmer',
    quota: '100 Transkriptionen / Monat',
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: '79€',
    description: 'Für kleine Teams',
    quota: '500 Transkriptionen / Monat',
    icon: Star,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    popular: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '199€',
    description: 'Für große Organisationen',
    quota: '10.000 Transkriptionen / Monat',
    icon: Crown,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
  },
];

/**
 *
 */
export default function LicenseSettings() {
  const router = useRouter();
  const [license, setLicense] = useState<License | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const status = await licenseApi.getStatus();
      setLicense(status);
      setError(null);
    } catch (err) {
      console.error('Failed to load license status:', err);
      // Try to load from localStorage backup if "Offline" handling is improved later
      setError('Konnte Lizenzstatus nicht laden. Bitte prüfen Sie Ihre Verbindung.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setValidating(true);
    setError(null);

    try {
      const response = await licenseApi.validateLicense(inputKey);
      setLicense(response.license);
      setInputKey('');
      alert('Lizenz erfolgreich aktualisiert!');
    } catch (err) {
      console.error('Failed to validate license:', err);
      setError(err instanceof Error ? err.message : 'Lizenz konnte nicht validiert werden');
    } finally {
      setValidating(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    setPurchasing(planId);
    setError(null);

    // Get company name and email from existing license or settings
    // For now, prompt for demo purposes if not available, or use defaults
    const companyName = license?.companyName || 'My Company';
    const email = 'customer@example.com';

    try {
      const response = await licenseApi.createCheckoutSession({
        planId,
        companyName,
        email,
        successUrl: `${window.location.origin}/settings/license?success=true`,
        cancelUrl: `${window.location.origin}/settings/license?canceled=true`,
      });

      // Redirect to Stripe checkout
      window.location.href = response.url;
    } catch (err) {
      console.error('Failed to initiate purchase:', err);
      setError(
        'Zahlungsvorgang konnte nicht gestartet werden. Bitte versuchen Sie es später erneut.'
      );
      setPurchasing(null);
    }
  };

  const handleManageSubscription = async () => {
    setOpeningPortal(true);
    setError(null);

    try {
      const response = await licenseApi.createPortalSession({
        returnUrl: `${window.location.origin}/settings/license`,
      });

      // Redirect to Stripe Billing Portal
      window.location.href = response.url;
    } catch (err) {
      console.error('Failed to open billing portal:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Portal konnte nicht geöffnet werden. Bitte versuchen Sie es später erneut.'
      );
      setOpeningPortal(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
      case 'TRIAL':
        return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400';
      case 'EXPIRED':
        return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <Head>
        <title>Lizenzverwaltung - VoiceInvoice</title>
      </Head>

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Shield className="h-6 w-6 text-blue-600" />
          Lizenzverwaltung
        </h1>
        <button
          onClick={() => router.push('/settings')}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Zurück zu Einstellungen
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 mb-12">
        {/* Status Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Aktueller Status
          </h2>

          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
          ) : license ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Firma</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {license.companyName}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(license.status)}`}
                >
                  {license.status}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-500 dark:text-gray-400">Gültig bis</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {new Date(license.expiresAt).toLocaleDateString()}
                </span>
              </div>

              <div className="mt-6">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Quota Nutzung</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {license.currentUsage} / {license.monthlyQuota}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (license.currentUsage / license.monthlyQuota) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              {/* Manage Subscription Button */}
              {license.status === 'ACTIVE' && (
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={handleManageSubscription}
                    disabled={openingPortal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Settings className="h-4 w-4" />
                    {openingPortal ? 'Öffne Portal...' : 'Abo verwalten'}
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                    Zahlungsmethode ändern, Rechnungen ansehen, Abo kündigen
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p>Keine Lizenzinformationen verfügbar.</p>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
          )}
        </div>

        {/* Update Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Key className="h-5 w-5 text-blue-500" />
            Lizenzschlüssel aktivieren
          </h2>

          <form onSubmit={handleUpdateLicense} className="space-y-4">
            <div>
              <label
                htmlFor="licenseKey"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Lizenzschlüssel
              </label>
              <input
                id="licenseKey"
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={validating || !inputKey.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating ? 'Validiere...' : 'Lizenz aktivieren'}
            </button>
          </form>

          <div className="mt-6 bg-gray-50 dark:bg-gray-900/50 rounded p-4 text-sm text-gray-500 dark:text-gray-400">
            <p className="flex items-start gap-2">
              <Clock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Nach dem Kauf erhalten Sie Ihren Lizenzschlüssel per E-Mail. Nutzen Sie diesen hier,
                um Ihren Enterprise-Status zu aktivieren.
              </span>
            </p>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
          Pläne & Upgrades
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6 flex flex-col ${
                plan.popular
                  ? 'border-blue-500 ring-1 ring-blue-500'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 right-6 transform -translate-y-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  Beliebt
                </div>
              )}

              <div className={`p-3 rounded-lg w-fit mb-4 ${plan.bgColor}`}>
                <plan.icon className={`h-6 w-6 ${plan.color}`} />
              </div>

              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{plan.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {plan.price}
                </span>
                <span className="text-gray-500 dark:text-gray-400">/Jahr</span>
              </div>

              <ul className="space-y-3 mb-8 flex-grow">
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {plan.quota}
                </li>
                <li className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Voice-to-Invoice Support
                </li>
              </ul>

              <button
                onClick={() => handlePurchase(plan.id)}
                disabled={purchasing !== null}
                className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
                  plan.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {purchasing === plan.id ? 'Lädt...' : 'Jetzt auswählen'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
