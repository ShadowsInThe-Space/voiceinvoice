/**
 * Window Manager for VoiceInvoice Desktop.
 *
 * Provides utilities for creating and managing Electron windows
 * with secure defaults and consistent configuration.
 *
 * @module electron/window-manager
 */

/**
 * Web preferences configuration for BrowserWindow.
 */
export interface WebPreferences {
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  preload?: string;
  devTools?: boolean;
  sandbox?: boolean;
}

/**
 * Window configuration options.
 *
 * Extends standard BrowserWindow options with type safety.
 */
export interface WindowConfig {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number | undefined;
  maxHeight?: number | undefined;
  title?: string;
  frame?: boolean;
  show?: boolean;
  center?: boolean;
  resizable?: boolean;
  webPreferences?: WebPreferences;
}

/**
 * Default window configuration.
 *
 * Provides reasonable defaults for the main application window.
 */
export const DEFAULT_WINDOW_CONFIG: Required<
  Pick<
    WindowConfig,
    'width' | 'height' | 'minWidth' | 'minHeight' | 'frame' | 'show' | 'center' | 'resizable'
  >
> = {
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  frame: true,
  show: true,
  center: true,
  resizable: true,
};

/**
 * Secure web preferences defaults.
 *
 * These settings cannot be overridden by user options
 * to maintain application security.
 */
const SECURE_WEB_PREFERENCES: Partial<WebPreferences> = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
};

/**
 * Creates a window configuration by merging options with defaults.
 *
 * Enforces security settings and ensures minimum dimensions
 * are respected.
 *
 * @param {Partial<WindowConfig>} options - Custom window options
 * @param {string} preloadPath - Path to the preload script
 * @returns {WindowConfig} Complete window configuration
 *
 * @example
 * const config = createWindowConfig(
 *   { width: 1600, height: 1000 },
 *   path.join(__dirname, 'preload.js')
 * );
 *
 * const win = new BrowserWindow(config);
 */
export function createWindowConfig(
  options: Partial<WindowConfig> = {},
  preloadPath?: string
): WindowConfig {
  // Merge user webPreferences with secure defaults
  const webPreferences: WebPreferences = {
    ...options.webPreferences,
    ...SECURE_WEB_PREFERENCES,
    ...(preloadPath ? { preload: preloadPath } : {}),
  };

  // Calculate dimensions, enforcing minimums
  let width = options.width ?? DEFAULT_WINDOW_CONFIG.width;
  let height = options.height ?? DEFAULT_WINDOW_CONFIG.height;

  // Enforce minimum dimensions
  const minWidth = options.minWidth ?? DEFAULT_WINDOW_CONFIG.minWidth;
  const minHeight = options.minHeight ?? DEFAULT_WINDOW_CONFIG.minHeight;

  if (width < minWidth) {
    width = minWidth;
  }
  if (height < minHeight) {
    height = minHeight;
  }

  const config: WindowConfig = {
    width,
    height,
    minWidth,
    minHeight,
    title: options.title ?? 'VoiceInvoice Enterprise',
    frame: options.frame ?? DEFAULT_WINDOW_CONFIG.frame,
    show: options.show ?? DEFAULT_WINDOW_CONFIG.show,
    center: options.center ?? DEFAULT_WINDOW_CONFIG.center,
    resizable: options.resizable ?? DEFAULT_WINDOW_CONFIG.resizable,
    webPreferences,
  };

  // Only add maxWidth/maxHeight if specified (avoid undefined with exactOptionalPropertyTypes)
  if (options.maxWidth !== undefined) {
    config.maxWidth = options.maxWidth;
  }
  if (options.maxHeight !== undefined) {
    config.maxHeight = options.maxHeight;
  }

  return config;
}
