/**
 * Settings Page Tests
 *
 * TDD tests for the Settings page component.
 * Tests API key configuration, locale settings, and TTS voice selection.
 *
 * @module tests/pages/settings.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/router
vi.mock('next/router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    pathname: '/settings',
  })),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    _getStore: () => store,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock window.voiceinvoice API for backend settings
// Note: Set up a proper mock that works in test environment
const settingsGetMock = vi.fn();
const settingsUpdateMock = vi.fn();
const settingsGetApiKeyMock = vi.fn();
const settingsSetApiKeyMock = vi.fn();

settingsGetMock.mockReturnValue(Promise.resolve({}));
settingsUpdateMock.mockReturnValue(Promise.resolve(undefined));
settingsGetApiKeyMock.mockReturnValue(Promise.resolve(''));
settingsSetApiKeyMock.mockReturnValue(Promise.resolve(true));

const voiceinvoiceMock = {
  settings: {
    get: settingsGetMock,
    update: settingsUpdateMock,
    getApiKey: settingsGetApiKeyMock,
    setApiKey: settingsSetApiKeyMock,
  },
};

// Set on window before component import
(global as any).window = Object.assign(global.window || {}, {
  voiceinvoice: voiceinvoiceMock,
});

// Import after mocks
import SettingsPage from '../../src/pages/settings';

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Reset mocks
    settingsGetMock.mockReturnValue(Promise.resolve({}));
    settingsUpdateMock.mockReturnValue(Promise.resolve(undefined));
    settingsGetApiKeyMock.mockReturnValue(Promise.resolve(''));
    settingsSetApiKeyMock.mockReturnValue(Promise.resolve(true));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the settings title', () => {
      render(<SettingsPage />);

      expect(screen.getByRole('heading', { name: /einstellungen/i })).toBeInTheDocument();
    });

    it('should display API configuration section', () => {
      render(<SettingsPage />);

      expect(screen.getByText(/api-konfiguration/i)).toBeInTheDocument();
    });

    it('should display language settings section', () => {
      render(<SettingsPage />);

      expect(screen.getByText(/sprache\/region/i)).toBeInTheDocument();
    });

    it('should display TTS settings section', () => {
      render(<SettingsPage />);

      expect(screen.getByText(/sprachausgabe/i)).toBeInTheDocument();
    });
  });

  describe('API Key Configuration', () => {
    it('should have an input field for Google AI API key', () => {
      render(<SettingsPage />);

      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      expect(apiKeyInput).toBeInTheDocument();
      expect(apiKeyInput).toHaveAttribute('type', 'password');
    });

    it('should load saved API key from secure storage', async () => {
      settingsGetApiKeyMock.mockReturnValue(Promise.resolve('saved-api-key-123'));

      render(<SettingsPage />);

      await waitFor(() => {
        const apiKeyInput = screen.getByLabelText(/google ai api key/i) as HTMLInputElement;
        expect(apiKeyInput.value).toBe('saved-api-key-123');
      });
    });

    it('should save API key to secure storage on submit', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'new-api-key-456');

      const saveButton = screen.getByRole('button', { name: /speichern/i });
      await user.click(saveButton);

      expect(settingsSetApiKeyMock).toHaveBeenCalledWith('new-api-key-456');
    });

    it('should toggle API key visibility', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      expect(apiKeyInput).toHaveAttribute('type', 'password');

      const toggleButton = screen.getByRole('button', { name: /anzeigen/i });
      await user.click(toggleButton);

      expect(apiKeyInput).toHaveAttribute('type', 'text');
    });
  });

  describe('Language Settings', () => {
    it('should have a locale selector', () => {
      render(<SettingsPage />);

      const localeSelect = screen.getByLabelText(/sprache\/region/i);
      expect(localeSelect).toBeInTheDocument();
    });

    it('should include de-DE and en-US options', () => {
      render(<SettingsPage />);

      expect(screen.getByRole('option', { name: /deutsch/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /english/i })).toBeInTheDocument();
    });

    it('should default to de-DE', () => {
      render(<SettingsPage />);

      const localeSelect = screen.getByLabelText(/sprache\/region/i) as HTMLSelectElement;
      expect(localeSelect.value).toBe('de-DE');
    });

    it('should save locale to localStorage', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      // First add an API key so validation passes
      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      await user.type(apiKeyInput, 'test-key');

      const localeSelect = screen.getByLabelText(/sprache\/region/i);
      await user.selectOptions(localeSelect, 'en-US');

      const saveButton = screen.getByRole('button', { name: /speichern/i });
      await user.click(saveButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('voiceinvoice_locale', 'en-US');
    });
  });

  describe('TTS Voice Settings', () => {
    it('should have a voice selector', () => {
      render(<SettingsPage />);

      const voiceSelect = screen.getByLabelText(/stimme/i);
      expect(voiceSelect).toBeInTheDocument();
    });

    it('should display available German Wavenet voices', () => {
      render(<SettingsPage />);

      expect(screen.getByRole('option', { name: /wavenet-a/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /wavenet-c/i })).toBeInTheDocument();
    });

    it('should have speaking rate slider', () => {
      render(<SettingsPage />);

      const rateSlider = screen.getByLabelText(/sprechgeschwindigkeit/i);
      expect(rateSlider).toBeInTheDocument();
      expect(rateSlider).toHaveAttribute('type', 'range');
    });
  });

  describe('Form Submission', () => {
    it('should show success message after saving', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      // Set a valid API key first
      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      await user.type(apiKeyInput, 'test-key');

      const saveButton = screen.getByRole('button', { name: /speichern/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/einstellungen gespeichert/i)).toBeInTheDocument();
      });
    });

    it('should validate API key is not empty when saving', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const saveButton = screen.getByRole('button', { name: /speichern/i });
      await user.click(saveButton);

      expect(screen.getByText(/api key ist erforderlich/i)).toBeInTheDocument();
    });
  });

  describe('Reset Settings', () => {
    it('should have a reset button', () => {
      render(<SettingsPage />);

      expect(screen.getByRole('button', { name: /zuruecksetzen/i })).toBeInTheDocument();
    });

    it('should show confirmation dialog when clicking reset', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const resetButton = screen.getByRole('button', { name: /zuruecksetzen/i });
      await user.click(resetButton);

      expect(screen.getByText(/zuruecksetzen bestaetigen/i)).toBeInTheDocument();
    });

    it('should reset settings when confirming', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const resetButton = screen.getByRole('button', { name: /zuruecksetzen/i });
      await user.click(resetButton);

      const confirmButton = screen.getByRole('button', { name: /ja, zuruecksetzen/i });
      await user.click(confirmButton);

      expect(localStorageMock.removeItem).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have a form element', () => {
      render(<SettingsPage />);

      expect(screen.getByRole('form')).toBeInTheDocument();
    });

    it('should announce save status to screen readers', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      // Set a valid API key first
      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      await user.type(apiKeyInput, 'test-key');

      const saveButton = screen.getByRole('button', { name: /speichern/i });
      await user.click(saveButton);

      await waitFor(() => {
        const statusElement = screen.getByRole('status');
        expect(statusElement).toBeInTheDocument();
      });
    });
  });

  describe('Webhook Settings', () => {
    it('should display automation and webhooks section', () => {
      render(<SettingsPage />);

      expect(screen.getByText(/automatisierung & webhooks/i)).toBeInTheDocument();
    });

    it('should have webhook enable toggle', () => {
      render(<SettingsPage />);

      const toggle = screen.getByRole('checkbox', { name: /webhooks aktivieren/i });
      expect(toggle).toBeInTheDocument();
    });

    it('should have n8n webhook URL input', () => {
      render(<SettingsPage />);

      const urlInput = screen.getByLabelText(/n8n webhook url/i);
      expect(urlInput).toBeInTheDocument();
      expect(urlInput).toHaveAttribute('type', 'url');
    });

    it('should have backup webhook URL input', () => {
      render(<SettingsPage />);

      const backupInput = screen.getByLabelText(/backup webhook url/i);
      expect(backupInput).toBeInTheDocument();
      expect(backupInput).toHaveAttribute('type', 'url');
    });

    it('should load saved webhook config from localStorage', () => {
      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'voiceinvoice_webhook_enabled') return 'true';
        if (key === 'voiceinvoice_webhook_url') return 'https://n8n.example.com/webhook';
        if (key === 'voiceinvoice_webhook_backup_url') return 'https://backup.example.com/webhook';
        return null;
      });

      render(<SettingsPage />);

      const toggle = screen.getByRole('checkbox', {
        name: /webhooks aktivieren/i,
      }) as HTMLInputElement;
      const urlInput = screen.getByLabelText(/n8n webhook url/i) as HTMLInputElement;
      const backupInput = screen.getByLabelText(/backup webhook url/i) as HTMLInputElement;

      expect(toggle.checked).toBe(true);
      expect(urlInput.value).toBe('https://n8n.example.com/webhook');
      expect(backupInput.value).toBe('https://backup.example.com/webhook');
    });

    it('should save webhook config to localStorage', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      // First add an API key so validation passes
      const apiKeyInput = screen.getByLabelText(/google ai api key/i);
      await user.type(apiKeyInput, 'test-key');

      // Enable webhooks
      const toggle = screen.getByRole('checkbox', { name: /webhooks aktivieren/i });
      await user.click(toggle);

      // Enter webhook URL
      const urlInput = screen.getByLabelText(/n8n webhook url/i);
      await user.type(urlInput, 'https://n8n.example.com/webhook');

      // Save
      const saveButton = screen.getByRole('button', { name: /speichern/i });
      await user.click(saveButton);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('voiceinvoice_webhook_enabled', 'true');
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'voiceinvoice_webhook_url',
        'https://n8n.example.com/webhook'
      );
    });

    it('should show validation error for invalid webhook URL', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      // Enable webhooks
      const toggle = screen.getByRole('checkbox', { name: /webhooks aktivieren/i });
      await user.click(toggle);

      // Enter invalid URL
      const urlInput = screen.getByLabelText(/n8n webhook url/i);
      await user.type(urlInput, 'not-a-valid-url');

      // Blur to trigger validation
      await user.tab();

      expect(screen.getByText(/ungueltige webhook url/i)).toBeInTheDocument();
    });

    it('should disable URL inputs when webhooks are disabled', () => {
      render(<SettingsPage />);

      const toggle = screen.getByRole('checkbox', {
        name: /webhooks aktivieren/i,
      }) as HTMLInputElement;
      const urlInput = screen.getByLabelText(/n8n webhook url/i) as HTMLInputElement;
      const backupInput = screen.getByLabelText(/backup webhook url/i) as HTMLInputElement;

      // By default webhooks are disabled
      expect(toggle.checked).toBe(false);
      expect(urlInput).toBeDisabled();
      expect(backupInput).toBeDisabled();
    });

    it('should enable URL inputs when webhooks are enabled', async () => {
      const user = userEvent.setup();
      render(<SettingsPage />);

      const toggle = screen.getByRole('checkbox', { name: /webhooks aktivieren/i });
      await user.click(toggle);

      const urlInput = screen.getByLabelText(/n8n webhook url/i) as HTMLInputElement;
      const backupInput = screen.getByLabelText(/backup webhook url/i) as HTMLInputElement;

      expect(urlInput).not.toBeDisabled();
      expect(backupInput).not.toBeDisabled();
    });

    it('should clear webhook settings on reset', async () => {
      const user = userEvent.setup();

      localStorageMock.getItem.mockImplementation((key: string) => {
        if (key === 'voiceinvoice_webhook_enabled') return 'true';
        if (key === 'voiceinvoice_webhook_url') return 'https://n8n.example.com/webhook';
        return null;
      });

      render(<SettingsPage />);

      const resetButton = screen.getByRole('button', { name: /zuruecksetzen/i });
      await user.click(resetButton);

      const confirmButton = screen.getByRole('button', { name: /ja, zuruecksetzen/i });
      await user.click(confirmButton);

      // Backend settings are now updated via window.voiceinvoice.settings.update()
      expect(settingsUpdateMock).toHaveBeenCalledWith({
        n8nWebhookUrl: '',
        voiceinvoice_workflow_enabled: 'false',
        voiceinvoice_workflow_base_url: 'http://localhost:5678',
      });
    });
  });
});
