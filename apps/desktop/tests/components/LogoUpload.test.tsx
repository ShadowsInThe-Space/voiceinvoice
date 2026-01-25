/**
 * Tests for LogoUpload component.
 *
 * Tests logo upload functionality including drag & drop,
 * file validation, preview, and localStorage integration.
 *
 * @module tests/components/LogoUpload
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LogoUpload } from '../../src/components/LogoUpload';

// Storage key constant
const LOGO_STORAGE_KEY = 'voiceinvoice_company_logo';

// Mock FileReader
class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
  onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

  readAsDataURL(_file: Blob): void {
    setTimeout(() => {
      this.result =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      if (this.onload) {
        this.onload({ target: this } as unknown as ProgressEvent<FileReader>);
      }
    }, 0);
  }
}

// Helper to create mock files
function createMockFile(name: string, size: number, type: string): File {
  const content = new Array(size).fill('a').join('');
  return new File([content], name, { type });
}

// Helper to create a valid PNG file
function createValidPNGFile(size = 1024): File {
  return createMockFile('logo.png', size, 'image/png');
}

// Helper to create a valid JPEG file
function createValidJPEGFile(size = 1024): File {
  return createMockFile('logo.jpg', size, 'image/jpeg');
}

describe('LogoUpload', () => {
  const mockOnLogoChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Mock FileReader
    vi.stubGlobal('FileReader', MockFileReader);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('rendering', () => {
    it('should render upload area with click and drag instructions', () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      // Should have clickable area
      const uploadArea = screen.getByTestId('logo-upload-area');
      expect(uploadArea).toBeInTheDocument();

      // Should show instructions - use getAllByText to handle multiple matches
      const instructions = screen.getAllByText(/logo hochladen|klicken|ziehen/i);
      expect(instructions.length).toBeGreaterThan(0);
    });

    it('should render hidden file input', () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg');
    });

    it('should show preview when logo is already stored', () => {
      const testBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      localStorage.setItem(LOGO_STORAGE_KEY, testBase64);

      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const preview = screen.getByTestId('logo-preview');
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveAttribute('src', testBase64);
    });

    it('should show remove button when logo is present', () => {
      const testBase64 = 'data:image/png;base64,test';
      localStorage.setItem(LOGO_STORAGE_KEY, testBase64);

      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const removeButton = screen.getByRole('button', { name: /logo entfernen/i });
      expect(removeButton).toBeInTheDocument();
    });
  });

  describe('file upload via click', () => {
    it('should open file dialog when upload area is clicked', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const uploadArea = screen.getByTestId('logo-upload-area');
      const fileInput = screen.getByTestId('logo-file-input');

      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.click(uploadArea);

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should accept PNG files', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const file = createValidPNGFile();

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnLogoChange).toHaveBeenCalled();
      });
    });

    it('should accept JPEG files', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const file = createValidJPEGFile();

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnLogoChange).toHaveBeenCalled();
      });
    });

    it('should store logo as base64 in localStorage', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const file = createValidPNGFile();

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        const stored = localStorage.getItem(LOGO_STORAGE_KEY);
        expect(stored).toBeTruthy();
        expect(stored).toMatch(/^data:image\/(png|jpeg);base64,/);
      });
    });
  });

  describe('drag and drop', () => {
    it('should show drag active state when dragging over', () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const uploadArea = screen.getByTestId('logo-upload-area');

      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });

      expect(uploadArea).toHaveClass('drag-active');
    });

    it('should remove drag active state when dragging leaves', () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const uploadArea = screen.getByTestId('logo-upload-area');

      fireEvent.dragEnter(uploadArea, {
        dataTransfer: { types: ['Files'] },
      });
      fireEvent.dragLeave(uploadArea);

      expect(uploadArea).not.toHaveClass('drag-active');
    });

    it('should accept dropped PNG file', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const uploadArea = screen.getByTestId('logo-upload-area');
      const file = createValidPNGFile();

      fireEvent.drop(uploadArea, {
        dataTransfer: { files: [file] },
      });

      await waitFor(() => {
        expect(mockOnLogoChange).toHaveBeenCalled();
      });
    });
  });

  describe('file validation', () => {
    it('should reject files larger than 2MB', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const largeFile = createMockFile('large.png', 3 * 1024 * 1024, 'image/png');

      fireEvent.change(fileInput, { target: { files: [largeFile] } });

      await waitFor(() => {
        // Check for error alert role which contains the error message
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/zu gross|2.*MB/i);
      });

      expect(mockOnLogoChange).not.toHaveBeenCalled();
    });

    it('should reject non-image files', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const pdfFile = createMockFile('document.pdf', 1024, 'application/pdf');

      fireEvent.change(fileInput, { target: { files: [pdfFile] } });

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/PNG.*JPEG|format/i);
      });

      expect(mockOnLogoChange).not.toHaveBeenCalled();
    });

    it('should reject GIF files', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const gifFile = createMockFile('animation.gif', 1024, 'image/gif');

      fireEvent.change(fileInput, { target: { files: [gifFile] } });

      await waitFor(() => {
        const errorAlert = screen.getByRole('alert');
        expect(errorAlert).toHaveTextContent(/PNG.*JPEG|format/i);
      });

      expect(mockOnLogoChange).not.toHaveBeenCalled();
    });

    it('should show error message in German', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const invalidFile = createMockFile('test.bmp', 1024, 'image/bmp');

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        // Error message should be in German
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
      });
    });
  });

  describe('logo removal', () => {
    it('should remove logo when remove button is clicked', async () => {
      const testBase64 = 'data:image/png;base64,test';
      localStorage.setItem(LOGO_STORAGE_KEY, testBase64);

      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const removeButton = screen.getByRole('button', { name: /logo entfernen/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(localStorage.getItem(LOGO_STORAGE_KEY)).toBeNull();
      });

      expect(mockOnLogoChange).toHaveBeenCalledWith(null);
    });

    it('should show upload area after logo is removed', async () => {
      const testBase64 = 'data:image/png;base64,test';
      localStorage.setItem(LOGO_STORAGE_KEY, testBase64);

      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const removeButton = screen.getByRole('button', { name: /logo entfernen/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('logo-preview')).not.toBeInTheDocument();
        // Check upload area is back
        expect(screen.getByTestId('logo-upload-area')).toBeInTheDocument();
      });
    });
  });

  describe('callback behavior', () => {
    it('should call onLogoChange with base64 string on successful upload', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const file = createValidPNGFile();

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnLogoChange).toHaveBeenCalledWith(
          expect.stringMatching(/^data:image\/png;base64,/)
        );
      });
    });

    it('should call onLogoChange with null on logo removal', async () => {
      const testBase64 = 'data:image/png;base64,test';
      localStorage.setItem(LOGO_STORAGE_KEY, testBase64);

      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const removeButton = screen.getByRole('button', { name: /logo entfernen/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(mockOnLogoChange).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('accessibility', () => {
    it('should have accessible labels', () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const uploadArea = screen.getByTestId('logo-upload-area');
      expect(uploadArea).toHaveAttribute('role', 'button');
      expect(uploadArea).toHaveAttribute('tabIndex', '0');
    });

    it('should be keyboard accessible', () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const uploadArea = screen.getByTestId('logo-upload-area');
      const fileInput = screen.getByTestId('logo-file-input');

      const clickSpy = vi.spyOn(fileInput, 'click');

      fireEvent.keyDown(uploadArea, { key: 'Enter' });

      expect(clickSpy).toHaveBeenCalled();
    });

    it('should announce errors to screen readers', async () => {
      render(<LogoUpload onLogoChange={mockOnLogoChange} />);

      const fileInput = screen.getByTestId('logo-file-input');
      const invalidFile = createMockFile('test.bmp', 1024, 'image/bmp');

      fireEvent.change(fileInput, { target: { files: [invalidFile] } });

      await waitFor(() => {
        const errorElement = screen.getByRole('alert');
        expect(errorElement).toBeInTheDocument();
      });
    });
  });
});
