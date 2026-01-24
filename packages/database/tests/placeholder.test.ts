import { describe, it, expect } from 'vitest';
import { initializeDatabase, DATABASE_VERSION } from '../src/index';

describe('Database Package', () => {
  describe('initializeDatabase', () => {
    it('should resolve without error', async () => {
      await expect(initializeDatabase()).resolves.toBeUndefined();
    });
  });

  describe('version', () => {
    it('should export version constant', () => {
      expect(DATABASE_VERSION).toBe('0.1.0');
    });
  });
});
