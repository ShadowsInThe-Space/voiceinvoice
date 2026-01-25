/**
 * Settings Page
 *
 * Configuration page for API keys, locale, and TTS settings.
 *
 * @module pages/settings
 */

import React, { useState, useEffect, useCallback, FormEvent } from 'react';

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
  companyName: 'voiceinvoice_company_name',
  companyAddress: 'voiceinvoice_company_address',
  companyTaxId: 'voiceinvoice_company_tax_id',
  companyBankInfo: 'voiceinvoice_company_bank_info',
  companyPhone: 'voiceinvoice_company_phone',
  companyEmail: 'voiceinvoice_company_email',
  companyWebsite: 'voiceinvoice_company_website',
  companyLogo: 'voiceinvoice_company_logo',
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
  const [showApiKey, setShowApiKey] = useState(false);

  // Company Info State
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyTaxId, setCompanyTaxId] = useState('');
  const [companyBankInfo, setCompanyBankInfo] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

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

    // Load company info
    const savedCompanyName = localStorage.getItem(STORAGE_KEYS.companyName);
    const savedCompanyAddress = localStorage.getItem(STORAGE_KEYS.companyAddress);
    const savedCompanyTaxId = localStorage.getItem(STORAGE_KEYS.companyTaxId);
    const savedCompanyBankInfo = localStorage.getItem(STORAGE_KEYS.companyBankInfo);
    const savedCompanyPhone = localStorage.getItem(STORAGE_KEYS.companyPhone);
    const savedCompanyEmail = localStorage.getItem(STORAGE_KEYS.companyEmail);
    const savedCompanyWebsite = localStorage.getItem(STORAGE_KEYS.companyWebsite);
    const savedCompanyLogo = localStorage.getItem(STORAGE_KEYS.companyLogo);

    if (savedApiKey) setApiKey(savedApiKey);
    if (savedLocale) setLocale(savedLocale);
    if (savedVoice) setTtsVoice(savedVoice);
    if (savedRate) setTtsRate(parseFloat(savedRate));

    if (savedCompanyName) setCompanyName(savedCompanyName);
    if (savedCompanyAddress) setCompanyAddress(savedCompanyAddress);
    if (savedCompanyTaxId) setCompanyTaxId(savedCompanyTaxId);
    if (savedCompanyBankInfo) setCompanyBankInfo(savedCompanyBankInfo);
    if (savedCompanyPhone) setCompanyPhone(savedCompanyPhone);
    if (savedCompanyEmail) setCompanyEmail(savedCompanyEmail);
    if (savedCompanyWebsite) setCompanyWebsite(savedCompanyWebsite);
    if (savedCompanyLogo) setCompanyLogo(savedCompanyLogo);
  }, []);

  /**
   * Toggle API key visibility.
   */
  const toggleApiKeyVisibility = useCallback(() => {
    setShowApiKey((prev) => !prev);
  }, []);

  /**
   * Handle logo upload
   */
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit
        setErrorMessage('Logo-Datei darf maximal 2MB groß sein');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setCompanyLogo(reader.result as string);
        setErrorMessage('');
      };
      reader.onerror = () => {
        setErrorMessage('Fehler beim Laden der Bilddatei');
      };
      reader.readAsDataURL(file);
    }
  }, []);

  /**
   * Remove logo
   */
  const handleRemoveLogo = useCallback(() => {
    setCompanyLogo('');
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

        localStorage.setItem(STORAGE_KEYS.companyName, companyName);
        localStorage.setItem(STORAGE_KEYS.companyAddress, companyAddress);
        localStorage.setItem(STORAGE_KEYS.companyTaxId, companyTaxId);
        localStorage.setItem(STORAGE_KEYS.companyBankInfo, companyBankInfo);
        localStorage.setItem(STORAGE_KEYS.companyPhone, companyPhone);
        localStorage.setItem(STORAGE_KEYS.companyEmail, companyEmail);
        localStorage.setItem(STORAGE_KEYS.companyWebsite, companyWebsite);
        localStorage.setItem(STORAGE_KEYS.companyLogo, companyLogo);

        setSaveStatus('success');

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSaveStatus(null);
        }, 3000);
      } catch (err) {
        setSaveStatus('error');
        setErrorMessage('Fehler beim Speichern der Einstellungen');
      } finally {
        setIsSaving(false);
      }
    },
    [
      apiKey, locale, ttsVoice, ttsRate, validateForm,
      companyName, companyAddress, companyTaxId, companyBankInfo,
      companyPhone, companyEmail, companyWebsite, companyLogo
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

    localStorage.removeItem(STORAGE_KEYS.companyName);
    localStorage.removeItem(STORAGE_KEYS.companyAddress);
    localStorage.removeItem(STORAGE_KEYS.companyTaxId);
    localStorage.removeItem(STORAGE_KEYS.companyBankInfo);
    localStorage.removeItem(STORAGE_KEYS.companyPhone);
    localStorage.removeItem(STORAGE_KEYS.companyEmail);
    localStorage.removeItem(STORAGE_KEYS.companyWebsite);
    localStorage.removeItem(STORAGE_KEYS.companyLogo);

    // Reset form to defaults
    setApiKey('');
    setLocale('de-DE');
    setTtsVoice('de-DE-Wavenet-C');
    setTtsRate(1.0);

    setCompanyName('');
    setCompanyAddress('');
    setCompanyTaxId('');
    setCompanyBankInfo('');
    setCompanyPhone('');
    setCompanyEmail('');
    setCompanyWebsite('');
    setCompanyLogo('');

    setShowResetDialog(false);
    setSaveStatus(null);
    setErrorMessage('');
  }, []);

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Einstellungen
      </h1>

      <form role="form" onSubmit={handleSave} className="space-y-8">

        {/* Company Info Section */}
        <section role="group" aria-labelledby="company-section">
          <h2 id="company-section" className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Firmendaten
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Firmenlogo
                </label>
                <div className="flex items-center space-x-6">
                  <div className="shrink-0">
                    {companyLogo ? (
                      <img
                        src={companyLogo}
                        alt="Firmenlogo"
                        className="h-20 w-auto object-contain border rounded p-1 bg-white"
                      />
                    ) : (
                      <div className="h-20 w-32 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-xs">
                        Kein Logo
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block">
                      <span className="sr-only">Logo wählen</span>
                      <input
                        type="file"
                        accept="image/png, image/jpeg"
                        onChange={handleLogoUpload}
                        className="block w-full text-sm text-slate-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-full file:border-0
                          file:text-sm file:font-semibold
                          file:bg-blue-50 file:text-blue-700
                          hover:file:bg-blue-100
                        "
                      />
                    </label>
                    <p className="mt-1 text-xs text-gray-500">PNG oder JPG, max 2MB</p>
                    {companyLogo && (
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="mt-2 text-xs text-red-600 hover:text-red-800"
                      >
                        Logo entfernen
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Firmenname
                </label>
                <input
                  type="text"
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="companyAddress" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Adresse (mit Zeilenumbrüchen)
                </label>
                <textarea
                  id="companyAddress"
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  rows={3}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefon
                </label>
                <input
                  type="text"
                  id="companyPhone"
                  value={companyPhone}
                  onChange={(e) => setCompanyPhone(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  E-Mail
                </label>
                <input
                  type="email"
                  id="companyEmail"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="companyWebsite" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Webseite
                </label>
                <input
                  type="text"
                  id="companyWebsite"
                  value={companyWebsite}
                  onChange={(e) => setCompanyWebsite(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="companyTaxId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  USt-IdNr. / Steuernummer
                </label>
                <input
                  type="text"
                  id="companyTaxId"
                  value={companyTaxId}
                  onChange={(e) => setCompanyTaxId(e.target.value)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label htmlFor="companyBankInfo" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bankverbindung (mit Zeilenumbrüchen)
                </label>
                <textarea
                  id="companyBankInfo"
                  value={companyBankInfo}
                  onChange={(e) => setCompanyBankInfo(e.target.value)}
                  rows={2}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Bankname&#10;IBAN: DE..."
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
          <h2 id="language-section" className="text-lg font-medium text-gray-900 dark:text-white mb-4">
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
            {saveStatus === 'success'
              ? 'Einstellungen gespeichert!'
              : 'Fehler beim Speichern'}
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
              Moechten Sie alle Einstellungen auf die Standardwerte zuruecksetzen?
              Diese Aktion kann nicht rueckgaengig gemacht werden.
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
