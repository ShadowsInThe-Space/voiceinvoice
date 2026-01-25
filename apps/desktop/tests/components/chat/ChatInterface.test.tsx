/**
 * Tests for ChatInterface component.
 *
 * Tests the chat interface with webhook calls, error handling,
 * voice transcription integration, and stateful message history.
 *
 * @module tests/components/chat/ChatInterface
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatInterface } from '../../../src/components/chat/ChatInterface';

// Mock GeminiClient
const mockTranscribeFn = vi.fn();

vi.mock('../../../src/lib/ai/gemini-client', () => ({
  GeminiClient: vi.fn().mockImplementation(function (this: {
    transcribe: typeof mockTranscribeFn;
  }) {
    this.transcribe = mockTranscribeFn;
    return this;
  }),
}));

// Mock VoiceRecorderButton
const mockVoiceRecorderButton = vi.fn();
vi.mock('../../../src/components/VoiceRecorderButton', () => ({
  VoiceRecorderButton: (props: {
    onRecordingComplete: (blob: Blob, duration: number) => void;
    disabled: boolean;
  }) => {
    mockVoiceRecorderButton(props);
    return (
      <button
        data-testid="voice-recorder-button"
        onClick={() => {
          // Simulate successful recording
          const blob = new Blob(['test audio'], { type: 'audio/webm' });
          props.onRecordingComplete(blob, 5000);
        }}
        disabled={props.disabled}
      >
        Voice Record
      </button>
    );
  },
}));

// Mock DocumentUpload
vi.mock('../../../src/components/chat/DocumentUpload', () => ({
  DocumentUpload: () => <div data-testid="document-upload">Document Upload</div>,
}));

// Mock MessageBubble
vi.mock('../../../src/components/chat/MessageBubble', () => ({
  MessageBubble: ({ role, content }: { role: string; content: string }) => (
    <div data-testid={`message-${role}`}>{content}</div>
  ),
}));

describe('ChatInterface', () => {
  const originalEnv = process.env;
  const mockGetGoogleApiKey = vi.fn();
  const mockGetN8nChatWebhook = vi.fn();
  const mockGetN8nIngestWebhook = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up default mock return values
    mockGetGoogleApiKey.mockResolvedValue('test-api-key');
    mockGetN8nChatWebhook.mockResolvedValue('https://test.webhook.url/chat');
    mockGetN8nIngestWebhook.mockResolvedValue('https://test.webhook.url/ingest');

    // Mock the window.voiceinvoice API safely
    Object.defineProperty(global.window, 'voiceinvoice', {
      value: {
        env: {
          getGoogleApiKey: mockGetGoogleApiKey,
          getN8nChatWebhook: mockGetN8nChatWebhook,
          getN8nIngestWebhook: mockGetN8nIngestWebhook,
        },
      },
      writable: true,
      configurable: true,
    });

    global.fetch = vi.fn();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render the chat interface with all components', () => {
      render(<ChatInterface />);

      expect(screen.getByText('Finanz-Assistent')).toBeInTheDocument();
      expect(screen.getByTestId('document-upload')).toBeInTheDocument();
      expect(screen.getByTestId('voice-recorder-button')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nachricht eingeben...')).toBeInTheDocument();
    });

    it('should show empty state message when no messages', () => {
      render(<ChatInterface />);

      expect(
        screen.getByText('Stellen Sie eine Frage zu Ihren Finanzen oder Dokumenten.')
      ).toBeInTheDocument();
    });
  });

  describe('sending messages', () => {
    it('should send a text message successfully', async () => {
      const mockResponse = { output: 'Test response from assistant' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: 'Test question' } });
      fireEvent.click(sendButton!);

      // Check user message is displayed
      await waitFor(() => {
        expect(screen.getByTestId('message-user')).toHaveTextContent('Test question');
      });

      // Check assistant response is displayed
      await waitFor(() => {
        expect(screen.getByTestId('message-assistant')).toHaveTextContent(
          'Test response from assistant'
        );
      });

      // Verify fetch was called correctly
      expect(global.fetch).toHaveBeenCalledWith('https://test.webhook.url/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: 'Test question' }),
      });
    });

    it('should send message on Enter key press', async () => {
      const mockResponse = { output: 'Response' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      fireEvent.change(input, { target: { value: 'Test message' } });
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

      await waitFor(() => {
        expect(screen.getByTestId('message-user')).toHaveTextContent('Test message');
      });
    });

    it('should not send empty messages', () => {
      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(sendButton!);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should clear input after sending message', async () => {
      const mockResponse = { output: 'Response' };
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...') as HTMLInputElement;
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(sendButton!);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });
  });

  describe('error handling', () => {
    it('should show error message when webhook URL is not configured', async () => {
      // Mock webhook URL as null
      mockGetN8nChatWebhook.mockResolvedValueOnce(null);

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      // Wait for config to load
      await waitFor(() => {
        fireEvent.change(input, { target: { value: 'Test' } });
        fireEvent.click(sendButton!);
      });

      await waitFor(() => {
        expect(screen.getByTestId('message-assistant')).toHaveTextContent(
          'Entschuldigung, es ist ein Fehler aufgetreten.'
        );
      });
    });

    it('should show error message when webhook request fails', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(sendButton!);

      await waitFor(() => {
        expect(screen.getByTestId('message-assistant')).toHaveTextContent(
          'Entschuldigung, es ist ein Fehler aufgetreten.'
        );
      });
    });

    it('should show error message when webhook throws exception', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(sendButton!);

      await waitFor(() => {
        expect(screen.getByTestId('message-assistant')).toHaveTextContent(
          'Entschuldigung, es ist ein Fehler aufgetreten.'
        );
      });
    });
  });

  describe('voice recording integration', () => {
    it('should have voice recorder button that calls onRecordingComplete', () => {
      render(<ChatInterface />);

      const voiceButton = screen.getByTestId('voice-recorder-button');
      expect(voiceButton).toBeInTheDocument();

      // Verify the mock was called with correct props including onRecordingComplete
      expect(mockVoiceRecorderButton).toHaveBeenCalledWith(
        expect.objectContaining({
          onRecordingComplete: expect.any(Function),
          disabled: false,
        })
      );
    });

    it('should show error when Gemini client is not initialized', async () => {
      // Mock API key as null
      mockGetGoogleApiKey.mockResolvedValueOnce(null);

      render(<ChatInterface />);

      const voiceButton = screen.getByTestId('voice-recorder-button');

      // Wait for config to load
      await waitFor(() => {
        fireEvent.click(voiceButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('message-assistant')).toHaveTextContent(
          'Fehler: Gemini Client nicht initialisiert.'
        );
      });
    });

    it('should disable voice button when loading', async () => {
      const mockResponse = { output: 'Response' };
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockResponse,
                }),
              100
            )
          )
      );

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(sendButton!);

      // Check that voice button receives disabled prop
      await waitFor(() => {
        expect(mockVoiceRecorderButton).toHaveBeenCalledWith(
          expect.objectContaining({ disabled: true })
        );
      });
    });
  });

  describe('loading state', () => {
    it('should show loading indicator while processing', async () => {
      const mockResponse = { output: 'Response' };
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockResponse,
                }),
              100
            )
          )
      );

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...');
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find((btn) => !btn.getAttribute('data-testid'));

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(sendButton!);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('Analysiere...')).toBeInTheDocument();
      });

      // Wait for completion
      await waitFor(
        () => {
          expect(screen.queryByText('Analysiere...')).not.toBeInTheDocument();
        },
        { timeout: 200 }
      );
    });

    it('should disable input and send button while loading', async () => {
      const mockResponse = { output: 'Response' };
      (global.fetch as any).mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => mockResponse,
                }),
              100
            )
          )
      );

      render(<ChatInterface />);

      const input = screen.getByPlaceholderText('Nachricht eingeben...') as HTMLInputElement;
      const buttons = screen.getAllByRole('button');
      const sendButton = buttons.find(
        (btn) => !btn.getAttribute('data-testid')
      ) as HTMLButtonElement;

      fireEvent.change(input, { target: { value: 'Test' } });
      fireEvent.click(sendButton);

      // Check disabled state
      await waitFor(() => {
        expect(input.disabled).toBe(true);
        expect(sendButton.disabled).toBe(true);
      });
    });
  });
});
