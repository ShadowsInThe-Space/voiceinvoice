/**
 * Tests for VoiceRecorderButton component.
 *
 * Tests the voice recording button with start/stop functionality
 * and visual recording indicator.
 *
 * @module tests/components/VoiceRecorderButton
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VoiceRecorderButton } from '../../src/components/VoiceRecorderButton';

// Mock useVoiceRecording hook
const mockStartRecording = vi.fn();
const mockStopRecording = vi.fn();
type OnStopCallback = (result: { blob: Blob; duration: number; mimeType: string }) => void;
let capturedOnStop: OnStopCallback | null = null;

const mockUseVoiceRecording = vi.fn();

vi.mock('../../src/hooks/use-voice-recording', () => ({
  useVoiceRecording: (options: { onStop?: OnStopCallback } = {}) => {
    // Capture onStop callback for testing
    if (options.onStop) {
      capturedOnStop = options.onStop;
    }
    return mockUseVoiceRecording(options);
  },
}));

describe('VoiceRecorderButton', () => {
  const mockOnRecordingComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnStop = null;
    mockStartRecording.mockResolvedValue(undefined);
    mockStopRecording.mockResolvedValue({
      blob: new Blob(['test'], { type: 'audio/webm' }),
      duration: 5000,
      mimeType: 'audio/webm;codecs=opus',
    });

    // Default mock implementation
    mockUseVoiceRecording.mockReturnValue({
      isRecording: false,
      isPaused: false,
      duration: 0,
      error: null,
      startRecording: mockStartRecording,
      stopRecording: mockStopRecording,
      pauseRecording: vi.fn(),
      resumeRecording: vi.fn(),
      clearError: vi.fn(),
    });
  });

  describe('rendering', () => {
    it('should render a button with microphone indicator', () => {
      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAccessibleName(/aufnahme|recording|mikrofon/i);
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <VoiceRecorderButton
          onRecordingComplete={mockOnRecordingComplete}
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should show idle state initially', () => {
      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      // Should not show recording indicator
      expect(screen.queryByTestId('recording-indicator')).not.toBeInTheDocument();
    });
  });

  describe('recording flow', () => {
    it('should start recording when clicked', async () => {
      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStartRecording).toHaveBeenCalled();
      });
    });

    it('should stop recording and call onRecordingComplete when clicked while recording', async () => {
      // Mock recording state
      mockUseVoiceRecording.mockReturnValue({
        isRecording: true,
        isPaused: false,
        duration: 3000,
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        clearError: vi.fn(),
      });

      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockStopRecording).toHaveBeenCalled();
      });
    });

    it('should call onRecordingComplete with blob and duration after stopping', async () => {
      const mockBlob = new Blob(['audio-data'], { type: 'audio/webm' });
      const mockDuration = 5000;

      // Render component to capture onStop callback
      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      // Verify the onStop callback was captured during render
      expect(capturedOnStop).not.toBeNull();

      // Simulate the hook calling onStop (which happens internally when recording stops)
      if (capturedOnStop) {
        capturedOnStop({
          blob: mockBlob,
          duration: mockDuration,
          mimeType: 'audio/webm;codecs=opus',
        });
      }

      await waitFor(() => {
        expect(mockOnRecordingComplete).toHaveBeenCalledWith(mockBlob, mockDuration);
      });
    });
  });

  describe('recording indicator', () => {
    it('should show recording indicator when recording', () => {
      mockUseVoiceRecording.mockReturnValue({
        isRecording: true,
        isPaused: false,
        duration: 2500,
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        clearError: vi.fn(),
      });

      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      expect(screen.getByTestId('recording-indicator')).toBeInTheDocument();
    });

    it('should display current duration while recording', () => {
      mockUseVoiceRecording.mockReturnValue({
        isRecording: true,
        isPaused: false,
        duration: 65000, // 1 minute 5 seconds
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        clearError: vi.fn(),
      });

      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      // Should show formatted duration
      expect(screen.getByText(/1:05/)).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('should show error state when recording fails', () => {
      const mockError = new Error('Mikrofon nicht verfuegbar');

      mockUseVoiceRecording.mockReturnValue({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: mockError,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        clearError: vi.fn(),
      });

      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      expect(screen.getByText(/fehler|error/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have appropriate aria-label based on state', () => {
      // Idle state
      mockUseVoiceRecording.mockReturnValue({
        isRecording: false,
        isPaused: false,
        duration: 0,
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        clearError: vi.fn(),
      });

      const { rerender } = render(
        <VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/aufnahme starten|start recording/i)
      );

      // Recording state
      mockUseVoiceRecording.mockReturnValue({
        isRecording: true,
        isPaused: false,
        duration: 1000,
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
        pauseRecording: vi.fn(),
        resumeRecording: vi.fn(),
        clearError: vi.fn(),
      });

      rerender(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        expect.stringMatching(/aufnahme stoppen|stop recording/i)
      );
    });

    it('should have visible focus styles for keyboard navigation', () => {
      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus-visible:ring-4');
      expect(button).toHaveClass('focus-visible:outline-none');
    });

    it('should have title attribute with keyboard hint', () => {
      // Idle state
      mockUseVoiceRecording.mockReturnValue({
        isRecording: false,
        duration: 0,
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      const { rerender } = render(
        <VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />
      );

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        expect.stringContaining('(Leertaste)')
      );

      // Recording state
      mockUseVoiceRecording.mockReturnValue({
        isRecording: true,
        duration: 1000,
        error: null,
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      rerender(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        expect.stringContaining('(Leertaste)')
      );
    });

    it('should use role="alert" for error messages', () => {
      mockUseVoiceRecording.mockReturnValue({
        isRecording: false,
        duration: 0,
        error: new Error('Test error'),
        startRecording: mockStartRecording,
        stopRecording: mockStopRecording,
      });

      render(<VoiceRecorderButton onRecordingComplete={mockOnRecordingComplete} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent(/Test error/);
    });
  });
});
