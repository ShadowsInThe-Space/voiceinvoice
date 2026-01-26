/**
 * Settings Page
 *
 * Configuration page for API keys, locale, TTS settings, webhook integrations,
 * company branding (logo upload), and license management.
 *
 * @module pages/settings
 */

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { LogoUpload, LOGO_STORAGE_KEY } from '../components/LogoUpload';
import { WORKFLOW_STORAGE_KEYS } from '../lib/workflow';
import { licenseApi } from '../lib/api/license-api';

/**
 * Available locale options.
 */
const LOCALE_OPTIONS = [
  { value: 'de-DE', label: 'Deutsch (Deutschland)' },
  { value: 'en-US', label: 'English (US)' },
];

/**
 * Available TTS voice options.
 */
const VOICE_OPTIONS = [
  { value: 'de-DE-Wavenet-A', label: 'Wavenet-A (Weiblich)' },
  { value: 'de-DE-Wavenet-B', label: 'Wavenet-B (Maennlich)' },
  { value: 'de-DE-Wavenet-C', label: 'Wavenet-C (Weiblich)' },
  { value: 'de-DE-Wavenet-D', label: 'Wavenet-D (Maennlich)' },
  { value: 'de-DE-Wavenet-E', label: 'Wavenet-E (Maennlich)' },
  { value: 'de-DE-Wavenet-F', label: 'Wavenet-F (Weiblich)' },
];

/**
 * LocalStorage keys.
 */
const STORAGE_KEYS = {
  apiKey: 'voiceinvoice_google_api_key',
  locale: 'voiceinvoice_locale',
  ttsVoice: 'voiceinvoice_tts_voice',
  ttsRate: 'voiceinvoice_tts_rate',
  ttsProvider: 'voiceinvoice_tts_provider', // 'google' or 'browser'
};

/**
 * Settings Page component.
 */
export default function SettingsPage(): React.ReactElement {
  // Form state
  const [apiKey, setApiKey] = useState('');
  const [locale, setLocale] = useState('de-DE');
  const [ttsVoice, setTtsVoice] = useState('de-DE-Wavenet-C');
  const [ttsRate, setTtsRate] = useState(1.0);
  const [ttsProvider, setTtsProvider] = useState<'google' | 'browser'>('google');
  const [workflowsEnabled, setWorkflowsEnabled] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // License state
  const [licenseKey, setLicenseKey] = useState('');
  const [licenseStatus, setLicenseStatus] = useState<'free' | 'active' | 'expired'>('free');
  const [licenseDetails, setLicenseDetails] = useState<{
    plan?: string;
    monthlyQuota?: number;
    currentUsage?: number;
    expiresAt?: string;
  } | null>(null);
  const [isValidatingLicense, setIsValidatingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState('');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Load saved settings or defaults on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const savedLocale = localStorage.getItem(STORAGE_KEYS.locale);
    const savedVoice = localStorage.getItem(STORAGE_KEYS.ttsVoice);
    const savedRate = localStorage.getItem(STORAGE_KEYS.ttsRate);
    const savedProvider = localStorage.getItem(STORAGE_KEYS.ttsProvider);

    // PRIORITY:
    // 1. LocalStorage (User overwrote it)
    // 2. Environment Variable (Demo Build / Pre-configured)
    // 3. Empty (User must input)

    if (savedApiKey) {
      setApiKey(savedApiKey);
    } else if (process.env.NEXT_PUBLIC_DEMO_API_KEY) {
      // Auto-inject Demo Key if available and nothing saved
      console.log('Using embedded Demo API Key');
      setApiKey(process.env.NEXT_PUBLIC_DEMO_API_KEY);
      // Optional: Auto-save it so it persists? 
      // Better: Just set it in state. If user saves, it writes to storage.
    }

    if (savedLocale) setLocale(savedLocale);
    if (savedVoice) setTtsVoice(savedVoice);
    if (savedRate) setTtsRate(parseFloat(savedRate));
    if (savedProvider === 'google' || savedProvider === 'browser') {
      setTtsProvider(savedProvider);
    }

    // Load backend settings
    if (typeof window !== 'undefined' && window.voiceinvoice?.settings?.get) {
      const getPromise = window.voiceinvoice.settings.get();
      if (getPromise && typeof getPromise.then === 'function') {
        getPromise
          .then((settings: unknown) => {
            const typedSettings = settings as Record<string, string>;
            if (typedSettings) {
              if (typedSettings[WORKFLOW_STORAGE_KEYS.enabled] !== undefined) {
                setWorkflowsEnabled(typedSettings[WORKFLOW_STORAGE_KEYS.enabled] === 'true');
              }
            }
          })
          .catch((err) => console.error('Failed to load backend settings:', err));
      }
    }

    // Check license status if token exists
    const checkLicenseStatus = async () => {
      const token = licenseApi.getToken();
      if (token) {
        try {
          const status = await licenseApi.getStatus();
          setLicenseStatus('active');
          setLicenseDetails({
            plan: status.companyName,
            monthlyQuota: status.monthlyQuota,
            currentUsage: status.currentUsage,
            expiresAt: status.expiresAt,
          });
        } catch (err) {
          console.error('Failed to load license status:', err);
          setLicenseStatus('free');
        }
      }
    };

    checkLicenseStatus();
  }, []);

  /**
   * Toggle API key visibility.
   */
  const toggleApiKeyVisibility = useCallback(() => {
    setShowApiKey((prev) => !prev);
  }, []);

  /**
   * Validate form.
   */
  const validateForm = useCallback((): boolean => {
    if (!apiKey.trim()) {
      setErrorMessage('API Key ist erforderlich');
      return false;
    }
    setErrorMessage('');
    return true;
  }, [apiKey]);

  /**
   * Save settings to localStorage.
   */
  const handleSave = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSaveStatus(null);

      if (!validateForm()) {
        return;
      }

      setIsSaving(true);

      try {
        localStorage.setItem(STORAGE_KEYS.apiKey, apiKey);
        localStorage.setItem(STORAGE_KEYS.locale, locale);
        localStorage.setItem(STORAGE_KEYS.ttsVoice, ttsVoice);
        localStorage.setItem(STORAGE_KEYS.ttsRate, ttsRate.toString());
        localStorage.setItem(STORAGE_KEYS.ttsProvider, ttsProvider);

        // Save to backend
        if (typeof window !== 'undefined' && window.voiceinvoice?.settings?.update) {
          await window.voiceinvoice.settings.update({
            [WORKFLOW_STORAGE_KEYS.enabled]: String(workflowsEnabled),
          });
        }

        setSaveStatus('success');

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
        setErrorMessage('Fehler beim Speichern der Einstellungen');
      } finally {
        setIsSaving(false);
      }
    },
    [
      apiKey,
      locale,
      ttsVoice,
      ttsRate,
      ttsProvider,
      workflowsEnabled,
      validateForm,
    ]
  );

  /**
   * Open reset confirmation dialog.
   */
  const handleResetClick = useCallback(() => {
    setShowResetDialog(true);
  }, []);

  /**
   * Cancel reset.
   */
  const handleResetCancel = useCallback(() => {
    setShowResetDialog(false);
  }, []);

  /**
   * Confirm reset and clear all settings.
   */
  const handleResetConfirm = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.apiKey);
    localStorage.removeItem(STORAGE_KEYS.locale);
    localStorage.removeItem(STORAGE_KEYS.ttsVoice);
    localStorage.removeItem(STORAGE_KEYS.ttsRate);
    localStorage.removeItem(STORAGE_KEYS.ttsProvider);

    // Remove company logo
    localStorage.removeItem(LOGO_STORAGE_KEY);

    // Reset license
    licenseApi.logout();
    setLicenseKey('');
    setLicenseStatus('free');
    setLicenseDetails(null);
    setLicenseError('');

    // Reset form to defaults
    setApiKey('');
    setLocale('de-DE');
    setTtsVoice('de-DE-Wavenet-C');
    setTtsRate(1.0);
    setTtsProvider('google');
    setWorkflowsEnabled(false);

    if (typeof window !== 'undefined' && window.voiceinvoice?.settings?.update) {
      window.voiceinvoice.settings
        .update({
          [WORKFLOW_STORAGE_KEYS.enabled]: 'false',
        })
        .catch(console.error);
    }

    setShowResetDialog(false);
    setSaveStatus(null);
    setErrorMessage('');
  }, []);

  /**
   * Handle logo change from LogoUpload component.
   */
  const handleLogoChange = useCallback((logoBase64: string | null) => {
    // Logo is saved directly by LogoUpload component
    // This callback can be used for additional side effects if needed
    console.log('Logo updated:', logoBase64 ? 'Logo set' : 'Logo removed');
  }, []);

  /**
   * Validate license key.
   */
  const handleValidateLicense = useCallback(async () => {
    if (!licenseKey.trim()) {
      setLicenseError('Bitte geben Sie einen Lizenzschlüssel ein');
      return;
    }

    setIsValidatingLicense(true);
    setLicenseError('');

    try {
      const result = await licenseApi.validateLicense(licenseKey);

      setLicenseStatus('active');
      setLicenseDetails({
        plan: result.license.companyName,
        monthlyQuota: result.license.monthlyQuota,
        currentUsage: result.license.currentUsage,
        expiresAt: result.license.expiresAt,
      });

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Ungültiger Lizenzschlüssel';
      setLicenseError(errorMsg);
      setLicenseStatus('free');
      setLicenseDetails(null);
    } finally {
      setIsValidatingLicense(false);
    }
  }, [licenseKey]);

  /**
   * Handle upgrade - create Stripe checkout session.
   */
  const handleUpgrade = useCallback(async (planId: string) => {
    try {
      const result = await licenseApi.createCheckoutSession({
        planId,
        companyName: 'Demo Company',
        email: 'demo@example.com',
        successUrl: `${window.location.origin}/settings?success=true`,
        cancelUrl: `${window.location.origin}/settings?canceled=true`,
      });

      // Redirect to Stripe checkout
      window.location.href = result.url;
    } catch (err) {
      const errorMsg =
        err instanceof Error ? err.message : 'Fehler beim Erstellen der Checkout-Session';
      setLicenseError(errorMsg);
    }
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Einstellungen</h1>

      <form role="form" onSubmit={handleSave} className="space-y-8">
        {/* Integration Section */}
        <section role="group" aria-labelledby="integration-section">
          <h2
            id="integration-section"
            className="text-lg font-medium text-gray-900 dark:text-white mb-4"
          >
            Integrationen
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label
                  htmlFor="workflowsEnabled"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Automatisierte Workflows
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Automatischer E-Mail-Versand und Zahlungserinnerungen
                </p>
              </div>
              <div className="flex items-center h-5">
                <input
                  id="workflowsEnabled"
                  type="checkbox"
                  checked={workflowsEnabled}
                  onChange={(e) => setWorkflowsEnabled(e.target.checked)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </section>

        {/* API Configuration Section */}
        <section role="group" aria-labelledby="api-section">
          <h2 id="api-section" className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            API-Konfiguration
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <div>
              <label
                htmlFor="apiKey"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Google AI API Key
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  id="apiKey"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="block w-full pr-10 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  aria-invalid={!!errorMessage}
                  aria-describedby={errorMessage ? 'apiKey-error' : undefined}
                />
                <button
                  type="button"
                  onClick={toggleApiKeyVisibility}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  {showApiKey ? 'Ausblenden' : 'Anzeigen'}
                </button>
              </div>
              {errorMessage && (
                <p id="apiKey-error" className="mt-1 text-sm text-red-600">
                  {errorMessage}
                </p>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Ihr API-Schluessel fuer Google Gemini und Cloud TTS
              </p>
            </div>
          </div>
        </section>

        {/* Language Section */}
        <section role="group" aria-labelledby="language-section">
          <h2
            id="language-section"
            className="text-lg font-medium text-gray-900 dark:text-white mb-4"
          >
            Sprache
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <div>
              <label
                htmlFor="locale"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Sprache/Region
              </label>
              <select
                id="locale"
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {LOCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Bestimmt Sprache fuer Transkription und UI
              </p>
            </div>
          </div>
        </section>

        {/* TTS Section */}
        <section role="group" aria-labelledby="tts-section">
          <h2 id="tts-section" className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Sprachausgabe (TTS)
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            {/* TTS Provider Toggle */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  TTS-Anbieter
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Google Cloud TTS bietet höhere Qualität, Browser TTS funktioniert offline
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTtsProvider('browser')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-l-md border transition-colors ${ttsProvider === 'browser'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                >
                  Browser
                </button>
                <button
                  type="button"
                  onClick={() => setTtsProvider('google')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-r-md border transition-colors ${ttsProvider === 'google'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                >
                  Google Cloud
                </button>
              </div>
            </div>

            {/* Voice Selection (only for Google TTS) */}
            <div className={ttsProvider === 'google' ? 'opacity-100' : 'opacity-50'}>
              <label
                htmlFor="ttsVoice"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Stimme {ttsProvider === 'browser' && '(nur für Google Cloud TTS)'}
              </label>
              <select
                id="ttsVoice"
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {VOICE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ttsRate"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Sprechgeschwindigkeit: {ttsRate.toFixed(1)}x
              </label>
              <input
                type="range"
                id="ttsRate"
                min="0.5"
                max="2.0"
                step="0.1"
                value={ttsRate}
                onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                className="block w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Langsam (0.5x)</span>
                <span>Normal (1.0x)</span>
                <span>Schnell (2.0x)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Company Branding Section */}
        <section role="group" aria-labelledby="branding-section">
          <h2
            id="branding-section"
            className="text-lg font-medium text-gray-900 dark:text-white mb-4"
          >
            Firmenbranding
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Firmenlogo
              </label>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Das Logo wird auf allen generierten PDF-Rechnungen angezeigt
              </p>
              <LogoUpload onLogoChange={handleLogoChange} />
            </div>
          </div>
        </section>

        {/* License & Subscription Section */}
        <section role="group" aria-labelledby="license-section">
          <h2
            id="license-section"
            className="text-lg font-medium text-gray-900 dark:text-white mb-4"
          >
            Lizenz & Abonnement
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            {/* Current Status */}
            <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Aktueller Status
                </span>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${licenseStatus === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                    : licenseStatus === 'expired'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                >
                  {licenseStatus === 'active'
                    ? '✓ Aktiv'
                    : licenseStatus === 'expired'
                      ? '✗ Abgelaufen'
                      : 'Kostenlos'}
                </span>
              </div>

              {licenseDetails && licenseStatus === 'active' && (
                <div className="mt-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Plan</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {licenseDetails.plan || 'Premium'}
                    </span>
                  </div>

                  {licenseDetails.monthlyQuota && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Monatsquote</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {licenseDetails.currentUsage || 0} / {licenseDetails.monthlyQuota}
                        </span>
                      </div>

                      {/* Usage Progress Bar */}
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(
                              ((licenseDetails.currentUsage || 0) / licenseDetails.monthlyQuota) *
                              100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                    </>
                  )}

                  {licenseDetails.expiresAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Läuft ab am</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {new Date(licenseDetails.expiresAt).toLocaleDateString('de-DE')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* License Key Input */}
            <div>
              <label
                htmlFor="licenseKey"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Lizenzschlüssel
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="licenseKey"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  disabled={isValidatingLicense}
                />
                <button
                  type="button"
                  onClick={handleValidateLicense}
                  disabled={isValidatingLicense || !licenseKey.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isValidatingLicense ? 'Prüfe...' : 'Validieren'}
                </button>
              </div>
              {licenseError && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{licenseError}</p>
              )}
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Geben Sie Ihren Lizenzschlüssel ein, um Premium-Funktionen freizuschalten
              </p>
            </div>

            {/* Available Plans */}
            {licenseStatus === 'free' && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                  Verfügbare Pläne
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Starter Plan */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Starter
                    </h4>
                    <div className="mb-3">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">€29</span>
                      <span className="text-gray-600 dark:text-gray-400">/Monat</span>
                    </div>
                    <ul className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                      <li>✓ 500 Rechnungen/Monat</li>
                      <li>✓ Basis-Support</li>
                      <li>✓ PDF Export</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleUpgrade('starter')}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Jetzt upgraden
                    </button>
                  </div>

                  {/* Professional Plan */}
                  <div className="border-2 border-blue-600 rounded-lg p-4 relative">
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        Beliebt
                      </span>
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Professional
                    </h4>
                    <div className="mb-3">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">€79</span>
                      <span className="text-gray-600 dark:text-gray-400">/Monat</span>
                    </div>
                    <ul className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                      <li>✓ 2000 Rechnungen/Monat</li>
                      <li>✓ Priority Support</li>
                      <li>✓ API-Zugriff</li>
                      <li>✓ n8n Integration</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleUpgrade('professional')}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Jetzt upgraden
                    </button>
                  </div>

                  {/* Enterprise Plan */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Enterprise
                    </h4>
                    <div className="mb-3">
                      <span className="text-2xl font-bold text-gray-900 dark:text-white">€199</span>
                      <span className="text-gray-600 dark:text-gray-400">/Monat</span>
                    </div>
                    <ul className="space-y-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                      <li>✓ Unbegrenzt</li>
                      <li>✓ 24/7 Support</li>
                      <li>✓ Custom Features</li>
                      <li>✓ SLA Garantie</li>
                    </ul>
                    <button
                      type="button"
                      onClick={() => handleUpgrade('enterprise')}
                      className="w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                    >
                      Jetzt upgraden
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Save Status */}
        {saveStatus && (
          <div
            role="status"
            className={`p-4 rounded-md ${saveStatus === 'success'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/50 dark:text-green-300'
              : 'bg-red-50 text-red-800 dark:bg-red-900/50 dark:text-red-300'
              }`}
          >
            {saveStatus === 'success' ? 'Einstellungen gespeichert!' : 'Fehler beim Speichern'}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={handleResetClick}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Zuruecksetzen
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Speichert...' : 'Speichern'}
          </button>
        </div>
      </form>

      {/* Reset Confirmation Dialog */}
      {showResetDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4">
            <h3
              id="reset-dialog-title"
              className="text-lg font-medium text-gray-900 dark:text-white mb-4"
            >
              Zuruecksetzen bestaetigen
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Moechten Sie alle Einstellungen auf die Standardwerte zuruecksetzen? Diese Aktion kann
              nicht rueckgaengig gemacht werden.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleResetCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleResetConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
              >
                Ja, zuruecksetzen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
