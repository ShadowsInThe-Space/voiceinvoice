import { describe, it, expect } from 'vitest';
import { createConfig, PROXY_SERVER_VERSION } from '../src/index';

describe('Proxy Server', () => {
  describe('createConfig', () => {
    it('should return default configuration', () => {
      const config = createConfig();

      expect(config.port).toBe(3001);
      expect(config.host).toBe('0.0.0.0');
      expect(config.enableLogging).toBe(true);
      expect(config.rateLimit).toBe(60);
    });
  });

  describe('version', () => {
    it('should export version constant', () => {
      expect(PROXY_SERVER_VERSION).toBe('0.1.0');
    });
  });
});
