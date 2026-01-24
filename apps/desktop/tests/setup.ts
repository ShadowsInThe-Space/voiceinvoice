/**
 * Vitest setup file for desktop app tests.
 *
 * Configures testing-library, mocks, and global test utilities.
 */

import '@testing-library/jest-dom/vitest';

// Mock Electron APIs for tests
vi.mock('electron', () => ({
  ipcRenderer: {
    send: vi.fn(),
    on: vi.fn(),
    invoke: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
}));
