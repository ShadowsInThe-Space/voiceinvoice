/**
 * React hook for global keyboard shortcuts.
 *
 * Provides a simple API for registering global hotkeys that work
 * anywhere in the application, even when the component is not focused.
 *
 * @module hooks/use-hotkey
 */

import { useEffect, useCallback, useRef } from 'react';

/**
 * Keyboard modifier keys.
 */
export interface HotkeyModifiers {
  /** Alt/Option key */
  alt?: boolean;
  /** Ctrl/Control key */
  ctrl?: boolean;
  /** Shift key */
  shift?: boolean;
  /** Meta/Command/Windows key */
  meta?: boolean;
}

/**
 * Hotkey configuration.
 */
export interface HotkeyConfig {
  /** Key to listen for (e.g., 'Space', 'Enter', 'a') */
  key: string;
  /** Modifier keys that must be pressed */
  modifiers?: HotkeyModifiers;
  /** Callback when hotkey is triggered */
  callback: (event: KeyboardEvent) => void;
  /** Whether to prevent default browser behavior (default: true) */
  preventDefault?: boolean;
  /** Whether to stop event propagation (default: false) */
  stopPropagation?: boolean;
  /** Whether the hotkey is enabled (default: true) */
  enabled?: boolean;
  /** Description for accessibility/documentation */
  description?: string;
}

/**
 * Checks if the keyboard event matches the hotkey configuration.
 *
 * @param {KeyboardEvent} event - The keyboard event
 * @param {Pick<HotkeyConfig, 'key' | 'modifiers'>} config - The hotkey key/modifiers to match
 * @returns {boolean} True if the event matches the hotkey
 */
function matchesHotkey(
  event: KeyboardEvent,
  config: Pick<HotkeyConfig, 'key'> & { modifiers?: HotkeyModifiers }
): boolean {
  // Check if key matches (case-insensitive)
  const keyMatches = event.key.toLowerCase() === config.key.toLowerCase();
  if (!keyMatches) return false;

  // Check modifiers
  const modifiers = config.modifiers ?? {};

  if (modifiers.alt !== undefined && event.altKey !== modifiers.alt) return false;
  if (modifiers.ctrl !== undefined && event.ctrlKey !== modifiers.ctrl) return false;
  if (modifiers.shift !== undefined && event.shiftKey !== modifiers.shift) return false;
  if (modifiers.meta !== undefined && event.metaKey !== modifiers.meta) return false;

  return true;
}

/**
 * Formats hotkey config into human-readable string.
 *
 * @param {HotkeyConfig} config - The hotkey configuration
 * @returns {string} Formatted hotkey string (e.g., "Alt + Space")
 *
 * @example
 * formatHotkey({ key: 'Space', modifiers: { alt: true } })
 * // Returns: "Alt + Space"
 */
export function formatHotkey(config: HotkeyConfig): string {
  const parts: string[] = [];

  if (config.modifiers?.ctrl) parts.push('Ctrl');
  if (config.modifiers?.alt) parts.push('Alt');
  if (config.modifiers?.shift) parts.push('Shift');
  if (config.modifiers?.meta) parts.push('⌘');

  // Format key name
  const keyName = config.key === ' ' ? 'Space' : config.key;
  parts.push(keyName);

  return parts.join(' + ');
}

/**
 * React hook for global keyboard shortcuts.
 *
 * Registers a global keyboard event listener that triggers a callback
 * when the specified key combination is pressed. Automatically handles
 * cleanup when the component unmounts.
 *
 * @param {HotkeyConfig} config - Hotkey configuration
 *
 * @example
 * // Listen for Alt + Space
 * useHotkey({
 *   key: ' ',
 *   modifiers: { alt: true },
 *   callback: () => {
 *     console.log('Alt + Space pressed!');
 *   },
 *   description: 'Start voice recording',
 * });
 *
 * @example
 * // Listen for Ctrl + S to save
 * useHotkey({
 *   key: 's',
 *   modifiers: { ctrl: true },
 *   callback: (event) => {
 *     event.preventDefault();
 *     saveDocument();
 *   },
 * });
 */
export function useHotkey(config: HotkeyConfig): void {
  const {
    key,
    modifiers,
    callback,
    preventDefault = true,
    stopPropagation = false,
    enabled = true,
  } = config;

  // Use ref to avoid recreating listener on every render
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Skip if user is typing in an input field (unless modifiers are used)
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;
      const hasModifiers = modifiers?.alt || modifiers?.ctrl || modifiers?.meta || modifiers?.shift;

      // Only skip for input fields if no modifiers are required
      if (isInputField && !hasModifiers) {
        return;
      }

      if (matchesHotkey(event, modifiers ? { key, modifiers } : { key })) {
        if (preventDefault) {
          event.preventDefault();
        }
        if (stopPropagation) {
          event.stopPropagation();
        }

        callbackRef.current(event);
      }
    },
    [key, modifiers, preventDefault, stopPropagation, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    // Register global listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup on unmount or when config changes
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);
}

/**
 * Hook for registering multiple hotkeys at once.
 *
 * @param {HotkeyConfig[]} configs - Array of hotkey configurations
 *
 * @example
 * useHotkeys([
 *   {
 *     key: ' ',
 *     modifiers: { alt: true },
 *     callback: startRecording,
 *   },
 *   {
 *     key: 's',
 *     modifiers: { ctrl: true },
 *     callback: save,
 *   },
 * ]);
 */
export function useHotkeys(configs: HotkeyConfig[]): void {
  const callbacksRef = useRef<Map<string, (event: KeyboardEvent) => void>>(new Map());

  // Update callbacks map
  useEffect(() => {
    const newCallbacks = new Map<string, (event: KeyboardEvent) => void>();
    configs.forEach((config, index) => {
      newCallbacks.set(`hotkey-${index}`, config.callback);
    });
    callbacksRef.current = newCallbacks;
  }, [configs]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      configs.forEach((config, index) => {
        if (!config.enabled && config.enabled !== undefined) return;

        // Skip for input fields if no modifiers are required
        const hasModifiers =
          config.modifiers?.alt ||
          config.modifiers?.ctrl ||
          config.modifiers?.meta ||
          config.modifiers?.shift;
        if (isInputField && !hasModifiers) {
          return;
        }

        if (matchesHotkey(event, config)) {
          const preventDefault = config.preventDefault ?? true;
          const stopPropagation = config.stopPropagation ?? false;

          if (preventDefault) {
            event.preventDefault();
          }
          if (stopPropagation) {
            event.stopPropagation();
          }

          const callback = callbacksRef.current.get(`hotkey-${index}`);
          callback?.(event);
        }
      });
    },
    [configs]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
