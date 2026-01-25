/**
 * Settings Page
 *
 * Configuration page for API keys, locale, TTS settings, webhook integrations,
 * and company branding (logo upload).
 *
 * @module pages/settings
 */

import React, { useState, useEffect, useCallback, FormEvent } from 'react';
import { LogoUpload, LOGO_STORAGE_KEY } from '../components/LogoUpload';
import Link from 'next/link';

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
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showResetDialog, setShowResetDialog] = useState(false);

  // Load saved settings on mount
  useEffect(() => {
    const savedApiKey = localStorage.getItem(STORAGE_KEYS.apiKey);
    const savedLocale = localStorage.getItem(STORAGE_KEYS.locale);
    const savedVoice = localStorage.getItem(STORAGE_KEYS.ttsVoice);
    const savedRate = localStorage.getItem(STORAGE_KEYS.ttsRate);

    if (savedApiKey) setApiKey(savedApiKey);
    if (savedLocale) setLocale(savedLocale);
    if (savedVoice) setTtsVoice(savedVoice);
    if (savedRate) setTtsRate(parseFloat(savedRate));

    // Load backend settings
    if (typeof window !== 'undefined' && window.voiceinvoice) {
      window.voiceinvoice.settings
        .get()
        .then((settings: unknown) => {
          const typedSettings = settings as { n8nWebhookUrl?: string };
          if (typedSettings && typedSettings.n8nWebhookUrl) {
            setN8nWebhookUrl(typedSettings.n8nWebhookUrl);
          }
        })
        .catch((err) => console.error('Failed to load backend settings:', err));
    }
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

        // Save to backend
        if (typeof window !== 'undefined' && window.voiceinvoice) {
          await window.voiceinvoice.settings.update({
            n8nWebhookUrl,
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
    [apiKey, locale, ttsVoice, ttsRate, n8nWebhookUrl, validateForm]
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

    // Remove company logo
    localStorage.removeItem(LOGO_STORAGE_KEY);

    // Reset form to defaults
    setApiKey('');
    setLocale('de-DE');
    setTtsVoice('de-DE-Wavenet-C');
    setTtsRate(1.0);
    setN8nWebhookUrl('');

    if (typeof window !== 'undefined' && window.voiceinvoice) {
      window.voiceinvoice.settings.update({ n8nWebhookUrl: '' }).catch(console.error);
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
            <div>
              <label
                htmlFor="n8nWebhook"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                n8n Webhook URL
              </label>
              <input
                type="url"
                id="n8nWebhook"
                value={n8nWebhookUrl}
                onChange={(e) => setN8nWebhookUrl(e.target.value)}
                placeholder="https://n8n.example.com/webhook/..."
                className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                URL fuer Webhook-Trigger bei Statusaenderungen
              </p>
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
            <div>
              <Link
                href="/settings/license"
                className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Verwalten
              </Link>
              <label
                htmlFor="ttsVoice"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Stimme
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

        {/* Save Status */}
        {saveStatus && (
          <div
            role="status"
            className={`p-4 rounded-md ${
              saveStatus === 'success'
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
