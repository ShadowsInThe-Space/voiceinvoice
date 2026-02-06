import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import * as Sentry from '@sentry/nextjs';

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
}));

// Component that throws an error for testing
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  const originalEnv = process.env;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Suppress console.error for expected errors in tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    consoleErrorSpy.mockRestore();
  });

  it('should render children when no error occurs', async () => {
    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    render(
      <ErrorBoundary>
        <div>Child content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child content')).toBeInTheDocument();
  });

  it('should render error UI when error occurs', async () => {
    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Etwas ist schiefgelaufen')).toBeInTheDocument();
    expect(screen.getByText(/Die Anwendung hat einen unerwarteten Fehler/)).toBeInTheDocument();
  });

  it('should show Neu laden button', async () => {
    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /Neu laden/i });
    expect(reloadButton).toBeInTheDocument();
  });

  it('should show Fehler melden button', async () => {
    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const copyButton = screen.getByRole('button', { name: /Fehler melden/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('should capture exception to Sentry in production', async () => {
    process.env.NODE_ENV = 'production';

    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Test error message' }),
      expect.objectContaining({ extra: expect.any(Object) })
    );
  });

  it('should log to console in development instead of Sentry', async () => {
    process.env.NODE_ENV = 'development';
    consoleErrorSpy.mockRestore(); // Restore to capture our specific call
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith(
      '[ErrorBoundary]',
      expect.any(Error),
      expect.any(Object)
    );

    mockConsoleError.mockRestore();
  });

  it('should copy error details to clipboard', async () => {
    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    // Mock clipboard API
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    });

    // Mock alert
    const mockAlert = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const copyButton = screen.getByRole('button', { name: /Fehler melden/i });
    fireEvent.click(copyButton);

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('Fehler: Test error message')
    );
    expect(mockAlert).toHaveBeenCalledWith('Fehlerdetails in Zwischenablage kopiert');

    mockAlert.mockRestore();
  });

  it('should reload page when Neu laden button is clicked', async () => {
    const { ErrorBoundary } = await import('../../src/components/ErrorBoundary');

    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: mockReload },
      writable: true,
    });

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByRole('button', { name: /Neu laden/i });
    fireEvent.click(reloadButton);

    expect(mockReload).toHaveBeenCalled();
  });
});
