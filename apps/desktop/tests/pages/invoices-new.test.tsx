/**
 * Invoice Creation Page Tests
 *
 * TDD tests for the new invoice page component.
 * Tests voice recording, transcription, preview, and PDF export.
 *
 * @module tests/pages/invoices-new.test
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/router
const mockPush = vi.fn();
const mockBack = vi.fn();
vi.mock('next/router', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
    pathname: '/invoices/new',
    back: mockBack,
  })),
}));

// Mock the VoiceRecorderButton to allow triggering onRecordingComplete
let mockOnRecordingComplete: ((blob: Blob, duration: number) => void) | null = null;
vi.mock('../../src/components/VoiceRecorderButton', () => ({
  VoiceRecorderButton: ({ onRecordingComplete, disabled }: { onRecordingComplete: (blob: Blob, duration: number) => void; disabled?: boolean }) => {
    mockOnRecordingComplete = onRecordingComplete;
    return (
      <button
        type="button"
        aria-label="Aufnahme starten"
        disabled={disabled}
        onClick={() => onRecordingComplete(new Blob(['test'], { type: 'audio/wav' }), 1000)}
      >
        Aufnahme starten
      </button>
    );
  },
}));

// Import after mocks
import NewInvoicePage from '../../src/pages/invoices/new';

/**
 * Helper function to trigger the recording flow and wait for invoice to load.
 */
async function triggerRecordingFlow(user: ReturnType<typeof userEvent.setup>) {
  const recordButton = screen.getByRole('button', { name: /aufnahme starten/i });
  await user.click(recordButton);

  // Wait for the processing to complete (800ms timeout in the component)
  await waitFor(() => {
    expect(screen.getByText('RE-2025-001')).toBeInTheDocument();
  }, { timeout: 3000 });
}

describe('Invoice Creation Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the page title', () => {
      render(<NewInvoicePage />);

      expect(screen.getByRole('heading', { name: /neue rechnung/i })).toBeInTheDocument();
    });

    it('should display voice recording button', () => {
      render(<NewInvoicePage />);

      expect(screen.getByRole('button', { name: /aufnahme starten/i })).toBeInTheDocument();
    });

    it('should display transcription area', () => {
      render(<NewInvoicePage />);

      expect(screen.getByLabelText(/echtzeit-transkription|transkription/i)).toBeInTheDocument();
    });
  });

  describe('Voice Recording Integration', () => {
    it('should have a recording button', () => {
      render(<NewInvoicePage />);

      const recordButton = screen.getByRole('button', { name: /aufnahme starten/i });
      expect(recordButton).toBeInTheDocument();
    });

    it('should allow editing transcription text', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      const transcriptionArea = screen.getByLabelText(/echtzeit-transkription|transkription/i);
      await user.clear(transcriptionArea);
      await user.type(transcriptionArea, 'Neue Rechnung fuer Test GmbH');

      expect(transcriptionArea).toHaveValue('Neue Rechnung fuer Test GmbH');
    });
  });

  describe('Invoice Preview', () => {
    it('should display invoice preview section', () => {
      render(<NewInvoicePage />);

      expect(screen.getByRole('heading', { name: /dokumentenvorschau|vorschau/i })).toBeInTheDocument();
    });

    it('should show invoice number in preview', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByText('RE-2025-001')).toBeInTheDocument();
    });

    it('should display customer name in preview', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      // Check that the customer name appears somewhere in the document
      expect(screen.getByText('Musterfirma GmbH')).toBeInTheDocument();
    });

    it('should display invoice items in preview', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByText(/beratung/i)).toBeInTheDocument();
    });

    it('should display totals in preview', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByTestId('invoice-total')).toBeInTheDocument();
    });

    it('should display confidence score', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByText(/genauigkeit/i)).toBeInTheDocument();
    });
  });

  describe('Edit and Save Workflow', () => {
    it('should have an edit button', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByRole('button', { name: /manuell anpassen|anpassen|bearbeiten/i })).toBeInTheDocument();
    });

    it('should have save button', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByRole('button', { name: /dokument finalisieren|finalisieren|speichern/i })).toBeInTheDocument();
    });

    it('should show success message when saving', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      const saveButton = screen.getByRole('button', { name: /dokument finalisieren|finalisieren|speichern/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/erfolgreich gespeichert/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('PDF Export', () => {
    it('should have PDF export button', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      expect(screen.getByRole('button', { name: /pdf export/i })).toBeInTheDocument();
    });

    it('should show success message after PDF export', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      await triggerRecordingFlow(user);

      const exportButton = screen.getByRole('button', { name: /pdf export/i });
      await user.click(exportButton);

      await waitFor(() => {
        expect(screen.getByText(/pdf-export erfolgreich|export erfolgreich/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Navigation', () => {
    it('should have back button', () => {
      render(<NewInvoicePage />);

      expect(screen.getByRole('button', { name: /zurück|zurueck/i })).toBeInTheDocument();
    });

    it('should navigate back when clicking back button', async () => {
      const user = userEvent.setup();
      render(<NewInvoicePage />);

      const backButton = screen.getByRole('button', { name: /zurück|zurueck/i });
      await user.click(backButton);

      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      render(<NewInvoicePage />);

      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
    });

    it('should have accessible form controls', () => {
      render(<NewInvoicePage />);

      const transcriptionArea = screen.getByLabelText(/transkription/i);
      expect(transcriptionArea).toBeInTheDocument();
    });

    it('should have status element for announcements', () => {
      render(<NewInvoicePage />);

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
    });
  });
});
