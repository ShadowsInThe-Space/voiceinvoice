/**
 * Tests for Electron Window Manager.
 *
 * Tests the window creation and management utilities
 * without requiring the full Electron environment.
 *
 * @module tests/electron/window-manager
 */

import { describe, it, expect } from 'vitest';
import { createWindowConfig, DEFAULT_WINDOW_CONFIG } from '../../electron/window-manager';

describe('Window Manager', () => {
  describe('createWindowConfig', () => {
    it('should return default config when no options provided', () => {
      const config = createWindowConfig();

      expect(config.width).toBe(DEFAULT_WINDOW_CONFIG.width);
      expect(config.height).toBe(DEFAULT_WINDOW_CONFIG.height);
      expect(config.minWidth).toBe(DEFAULT_WINDOW_CONFIG.minWidth);
      expect(config.minHeight).toBe(DEFAULT_WINDOW_CONFIG.minHeight);
    });

    it('should merge custom options with defaults', () => {
      const config = createWindowConfig({
        width: 1600,
        height: 1000,
      });

      expect(config.width).toBe(1600);
      expect(config.height).toBe(1000);
      expect(config.minWidth).toBe(DEFAULT_WINDOW_CONFIG.minWidth);
    });

    it('should always include webPreferences', () => {
      const config = createWindowConfig();

      expect(config.webPreferences).toBeDefined();
      expect(config.webPreferences?.nodeIntegration).toBe(false);
      expect(config.webPreferences?.contextIsolation).toBe(true);
    });

    it('should set preload path in webPreferences', () => {
      const config = createWindowConfig({}, '/path/to/preload.js');

      expect(config.webPreferences?.preload).toBe('/path/to/preload.js');
    });

    it('should allow custom webPreferences except security settings', () => {
      const config = createWindowConfig({
        webPreferences: {
          devTools: true,
          nodeIntegration: true, // Should be overridden
        },
      });

      expect(config.webPreferences?.devTools).toBe(true);
      expect(config.webPreferences?.nodeIntegration).toBe(false);
    });

    it('should set title from options', () => {
      const config = createWindowConfig({
        title: 'VoiceInvoice',
      });

      expect(config.title).toBe('VoiceInvoice');
    });

    it('should enforce minimum dimensions', () => {
      const config = createWindowConfig({
        width: 400, // Below minimum
        height: 300, // Below minimum
      });

      expect(config.width).toBeGreaterThanOrEqual(DEFAULT_WINDOW_CONFIG.minWidth!);
      expect(config.height).toBeGreaterThanOrEqual(DEFAULT_WINDOW_CONFIG.minHeight!);
    });
  });

  describe('DEFAULT_WINDOW_CONFIG', () => {
    it('should have reasonable default dimensions', () => {
      expect(DEFAULT_WINDOW_CONFIG.width).toBeGreaterThanOrEqual(800);
      expect(DEFAULT_WINDOW_CONFIG.height).toBeGreaterThanOrEqual(600);
    });

    it('should have minimum dimensions set', () => {
      expect(DEFAULT_WINDOW_CONFIG.minWidth).toBeDefined();
      expect(DEFAULT_WINDOW_CONFIG.minHeight).toBeDefined();
    });

    it('should have frame enabled by default', () => {
      expect(DEFAULT_WINDOW_CONFIG.frame).toBe(true);
    });

    it('should show window by default', () => {
      expect(DEFAULT_WINDOW_CONFIG.show).toBe(true);
    });
  });
});
