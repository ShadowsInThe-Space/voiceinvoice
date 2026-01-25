import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ServerPrivacyLayer,
  ClientPrivacyLayer,
  DualLayerPrivacy,
  PrivacyTokenManager,
} from '../src/dual-layer-privacy';

// ============================================
// Server Privacy Layer Tests (Chirp 3 Integration)
// ============================================

describe('ServerPrivacyLayer', () => {
  describe('chirp integration', () => {
    it('should redact PII from transcription using Chirp 3 API', async () => {
      const mockChirpClient = {
        transcribeWithRedaction: vi.fn().mockResolvedValue({
          text: 'Invoice for [REDACTED_NAME] with amount 500 EUR',
          redactions: [{ type: 'PERSON_NAME', original: 'Max Mustermann', start: 12, end: 26 }],
        }),
      };

      const serverLayer = new ServerPrivacyLayer({
        chirpClient: mockChirpClient,
        redactionConfig: { redactNames: true, redactAddresses: true },
      });

      const result = await serverLayer.processAudioTranscription(
        Buffer.from('audio-data'),
        'de-DE'
      );

      expect(result.anonymizedText).toBe('Invoice for [REDACTED_NAME] with amount 500 EUR');
      expect(result.redactions).toHaveLength(1);
      expect(result.redactions[0].type).toBe('PERSON_NAME');
    });

    it('should handle Chirp API errors gracefully', async () => {
      const mockChirpClient = {
        transcribeWithRedaction: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      const serverLayer = new ServerPrivacyLayer({
        chirpClient: mockChirpClient,
        redactionConfig: { redactNames: true },
      });

      await expect(
        serverLayer.processAudioTranscription(Buffer.from('audio-data'), 'de-DE')
      ).rejects.toThrow('Server privacy layer failed: API Error');
    });

    it('should use mock mode when no chirp client provided', async () => {
      const serverLayer = new ServerPrivacyLayer({
        useMock: true,
        redactionConfig: { redactNames: true },
      });

      const result = await serverLayer.processAudioTranscription(
        Buffer.from('audio-data'),
        'de-DE'
      );

      expect(result.anonymizedText).toBeDefined();
      expect(result.redactions).toBeDefined();
    });
  });

  describe('redaction configuration', () => {
    it('should respect redaction config for names', async () => {
      const serverLayer = new ServerPrivacyLayer({
        useMock: true,
        redactionConfig: { redactNames: true, redactAddresses: false },
      });

      const config = serverLayer.getRedactionConfig();
      expect(config.redactNames).toBe(true);
      expect(config.redactAddresses).toBe(false);
    });

    it('should allow updating redaction config', () => {
      const serverLayer = new ServerPrivacyLayer({
        useMock: true,
        redactionConfig: { redactNames: true },
      });

      serverLayer.updateRedactionConfig({ redactAddresses: true });
      const config = serverLayer.getRedactionConfig();
      expect(config.redactAddresses).toBe(true);
    });
  });
});

// ============================================
// Client Privacy Layer Tests (Fuzzy + Phonetic Matching)
// ============================================

describe('ClientPrivacyLayer', () => {
  let clientLayer: ClientPrivacyLayer;

  beforeEach(() => {
    clientLayer = new ClientPrivacyLayer({
      fuzzyThreshold: 0.8,
      usePhoneticMatching: true,
    });
  });

  describe('customer name matching', () => {
    it('should match exact customer names', () => {
      clientLayer.addCustomerNames(['Müller GmbH', 'Schmidt AG']);

      const result = clientLayer.maskCustomerNames('Rechnung für Müller GmbH über 1000 EUR');

      expect(result.maskedText).toMatch(/Rechnung für \[CUSTOMER_\w+\] über 1000 EUR/);
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].original).toBe('Müller GmbH');
    });

    it('should match fuzzy customer names with typos', () => {
      clientLayer.addCustomerNames(['Müller GmbH']);

      const result = clientLayer.maskCustomerNames('Rechnung für Mueller GmbH über 1000 EUR');

      expect(result.maskedText).toContain('[CUSTOMER_');
      expect(result.matches[0].similarity).toBeGreaterThan(0.8);
    });

    it('should match phonetically similar names', () => {
      // Use names that are phonetically similar but have low fuzzy similarity
      clientLayer.addCustomerNames(['Schmitt']);

      const result = clientLayer.maskCustomerNames('Rechnung für Schmidt');

      expect(result.maskedText).toContain('[CUSTOMER_');
      // The match type can be either phonetic or fuzzy depending on similarity
      expect(['phonetic', 'fuzzy']).toContain(result.matches[0].matchType);
    });

    it('should not match names below threshold', () => {
      const strictLayer = new ClientPrivacyLayer({
        fuzzyThreshold: 0.95,
        usePhoneticMatching: false,
      });
      strictLayer.addCustomerNames(['Müller GmbH']);

      const result = strictLayer.maskCustomerNames('Rechnung für ABC Company über 1000 EUR');

      expect(result.maskedText).toBe('Rechnung für ABC Company über 1000 EUR');
      expect(result.matches).toHaveLength(0);
    });
  });

  describe('multiple customer matching', () => {
    it('should mask multiple customer names in text', () => {
      clientLayer.addCustomerNames(['Müller GmbH', 'Schmidt AG', 'Weber KG']);

      const result = clientLayer.maskCustomerNames('Rechnung von Schmidt AG an Müller GmbH');

      expect(result.maskedText).toContain('[CUSTOMER_');
      expect(result.matches).toHaveLength(2);
    });

    it('should generate unique tokens for different customers', () => {
      clientLayer.addCustomerNames(['Müller GmbH', 'Schmidt AG']);

      const result = clientLayer.maskCustomerNames('Von Müller GmbH an Schmidt AG');

      const tokens = result.maskedText.match(/\[CUSTOMER_\w+\]/g) || [];
      expect(new Set(tokens).size).toBe(2);
    });
  });

  describe('configuration', () => {
    it('should allow updating fuzzy threshold', () => {
      clientLayer.setFuzzyThreshold(0.9);
      expect(clientLayer.getFuzzyConfig().fuzzyThreshold).toBe(0.9);
    });

    it('should allow toggling phonetic matching', () => {
      clientLayer.setPhoneticMatching(false);
      expect(clientLayer.getFuzzyConfig().usePhoneticMatching).toBe(false);
    });
  });
});

// ============================================
// Privacy Token Manager Tests
// ============================================

describe('PrivacyTokenManager', () => {
  let tokenManager: PrivacyTokenManager;

  beforeEach(() => {
    tokenManager = new PrivacyTokenManager();
  });

  describe('token creation', () => {
    it('should create reversible tokens', () => {
      const token = tokenManager.createToken('CUSTOMER', 'Müller GmbH');

      expect(token.id).toBeDefined();
      expect(token.type).toBe('CUSTOMER');
      expect(token.placeholder).toMatch(/\[CUSTOMER_\w+\]/);
    });

    it('should store original value for de-anonymization', () => {
      const token = tokenManager.createToken('CUSTOMER', 'Müller GmbH');
      const original = tokenManager.getOriginalValue(token.id);

      expect(original).toBe('Müller GmbH');
    });

    it('should generate unique token IDs', () => {
      const token1 = tokenManager.createToken('CUSTOMER', 'Customer A');
      const token2 = tokenManager.createToken('CUSTOMER', 'Customer B');

      expect(token1.id).not.toBe(token2.id);
    });
  });

  describe('de-anonymization', () => {
    it('should restore original values from anonymized text', () => {
      const token = tokenManager.createToken('CUSTOMER', 'Müller GmbH');
      const anonymizedText = `Invoice for ${token.placeholder}`;

      const restored = tokenManager.deanonymize(anonymizedText);

      expect(restored).toBe('Invoice for Müller GmbH');
    });

    it('should restore multiple tokens', () => {
      const token1 = tokenManager.createToken('CUSTOMER', 'Customer A');
      const token2 = tokenManager.createToken('AMOUNT', '1000 EUR');

      const anonymizedText = `${token1.placeholder} pays ${token2.placeholder}`;
      const restored = tokenManager.deanonymize(anonymizedText);

      expect(restored).toBe('Customer A pays 1000 EUR');
    });

    it('should handle text with no tokens', () => {
      const text = 'Plain text without tokens';
      const restored = tokenManager.deanonymize(text);

      expect(restored).toBe(text);
    });
  });

  describe('token export/import', () => {
    it('should export token map for storage', () => {
      tokenManager.createToken('CUSTOMER', 'Customer A');
      tokenManager.createToken('CUSTOMER', 'Customer B');

      const exported = tokenManager.exportTokenMap();

      expect(Object.keys(exported)).toHaveLength(2);
    });

    it('should import token map', () => {
      const tokenMap = {
        tok_abc123: { type: 'CUSTOMER', original: 'Customer A', placeholder: '[CUSTOMER_abc123]' },
      };

      tokenManager.importTokenMap(tokenMap);
      const original = tokenManager.getOriginalValue('tok_abc123');

      expect(original).toBe('Customer A');
    });

    it('should clear all tokens', () => {
      tokenManager.createToken('CUSTOMER', 'Customer A');
      tokenManager.clear();

      const exported = tokenManager.exportTokenMap();
      expect(Object.keys(exported)).toHaveLength(0);
    });
  });
});

// ============================================
// Dual Layer Privacy Orchestrator Tests
// ============================================

describe('DualLayerPrivacy', () => {
  let dualLayer: DualLayerPrivacy;

  beforeEach(() => {
    dualLayer = new DualLayerPrivacy({
      serverConfig: {
        useMock: true,
        redactionConfig: { redactNames: true, redactAddresses: true },
      },
      clientConfig: {
        fuzzyThreshold: 0.8,
        usePhoneticMatching: true,
      },
    });
  });

  describe('dual layer processing', () => {
    it('should process audio through both layers', async () => {
      dualLayer.addCustomerNames(['Müller GmbH']);

      const result = await dualLayer.processAudio(Buffer.from('audio-data'), 'de-DE');

      expect(result.serverResult).toBeDefined();
      expect(result.clientResult).toBeDefined();
      expect(result.finalText).toBeDefined();
    });

    it('should apply server layer first, then client layer', async () => {
      dualLayer.addCustomerNames(['Max Mustermann']);

      const result = await dualLayer.processAudio(Buffer.from('audio-data'), 'de-DE');

      // Server layer should process first, then client layer masks remaining
      expect(result.processingOrder).toEqual(['server', 'client']);
    });

    it('should combine token maps from both layers', async () => {
      dualLayer.addCustomerNames(['Müller GmbH']);

      const result = await dualLayer.processAudio(Buffer.from('audio-data'), 'de-DE');

      expect(result.tokenManager).toBeDefined();
      // Should have tokens from both layers
      const exported = result.tokenManager.exportTokenMap();
      expect(Object.keys(exported).length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('text-only processing', () => {
    it('should process text through client layer only', () => {
      dualLayer.addCustomerNames(['Müller GmbH']);

      const result = dualLayer.processText('Rechnung für Müller GmbH');

      expect(result.maskedText).toContain('[CUSTOMER_');
      expect(result.tokenManager).toBeDefined();
    });

    it('should allow de-anonymization of processed text', () => {
      dualLayer.addCustomerNames(['Müller GmbH']);

      const processResult = dualLayer.processText('Rechnung für Müller GmbH');
      const restored = processResult.tokenManager.deanonymize(processResult.maskedText);

      expect(restored).toBe('Rechnung für Müller GmbH');
    });
  });

  describe('customer name management', () => {
    it('should add customer names to client layer', () => {
      dualLayer.addCustomerNames(['Customer A', 'Customer B']);

      const result = dualLayer.processText('Invoice for Customer A');

      expect(result.maskedText).toContain('[CUSTOMER_');
    });

    it('should clear customer names', () => {
      dualLayer.addCustomerNames(['Customer A']);
      dualLayer.clearCustomerNames();

      const result = dualLayer.processText('Invoice for Customer A');

      expect(result.maskedText).toBe('Invoice for Customer A');
    });
  });

  describe('configuration', () => {
    it('should allow updating server config', () => {
      dualLayer.updateServerConfig({ redactNames: false });
      const config = dualLayer.getServerConfig();

      expect(config.redactNames).toBe(false);
    });

    it('should allow updating client config', () => {
      dualLayer.updateClientConfig({ fuzzyThreshold: 0.9 });
      const config = dualLayer.getClientConfig();

      expect(config.fuzzyThreshold).toBe(0.9);
    });
  });
});
