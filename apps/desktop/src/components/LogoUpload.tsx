/**
 * LogoUpload component.
 *
 * Provides drag-and-drop and click-to-select file upload for company logos.
 * Supports PNG and JPEG formats with a maximum file size of 2MB.
 * Stores logo as Base64 in localStorage.
 *
 * @module components/LogoUpload
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../lib/utils';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

/**
 * LocalStorage key for company logo.
 */
export const LOGO_STORAGE_KEY = 'voiceinvoice_company_logo';

/**
 * Maximum file size in bytes (2MB).
 */
const MAX_FILE_SIZE = 2 * 1024 * 1024;

/**
 * Allowed MIME types.
 */
const ALLOWED_TYPES = ['image/png', 'image/jpeg'];

/**
 * Props for LogoUpload component.
 */
export interface LogoUploadProps {
  /** Callback when logo changes (base64 string or null when removed) */
  onLogoChange: (logoBase64: string | null) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Validates a file for logo upload.
 *
 * @param {File} file - The file to validate
 * @returns {{ valid: boolean; error?: string }} Validation result
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Ungültiges Dateiformat. Nur PNG und JPEG sind erlaubt.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'Die Datei ist zu gross. Maximale Groesse: 2 MB.',
    };
  }

  return { valid: true };
}

/**
 * Reads a file as Base64 data URL.
 *
 * @param {File} file - The file to read
 * @returns {Promise<string>} Base64 data URL
 */
function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = (): void => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Logo upload component with drag & drop and click support.
 *
 * @param {LogoUploadProps} props - The component props
 * @returns {JSX.Element} The rendered component
 */
export function LogoUpload({ onLogoChange, className }: LogoUploadProps): JSX.Element {
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing logo from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOGO_STORAGE_KEY);
    if (stored) {
      setLogoBase64(stored);
    }
  }, []);

  /**
   * Handles file processing.
   */
  const handleFile = useCallback(
    async (file: File): Promise<void> => {
      setError(null);

      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Unbekannter Fehler');
        return;
      }

      try {
        const base64 = await readFileAsBase64(file);
        setLogoBase64(base64);
        localStorage.setItem(LOGO_STORAGE_KEY, base64);
        onLogoChange(base64);
      } catch (err) {
        setError('Fehler beim Lesen der Datei.');
      }
    },
    [onLogoChange]
  );

  /**
   * Handles file input change.
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input value to allow re-selecting the same file
      e.target.value = '';
    },
    [handleFile]
  );

  /**
   * Opens the file dialog.
   */
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Handles keyboard events on the upload area.
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openFileDialog();
      }
    },
    [openFileDialog]
  );

  /**
   * Handles drag enter.
   */
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  /**
   * Handles drag leave.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  /**
   * Handles drag over.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  /**
   * Handles file drop.
   */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  /**
   * Removes the current logo.
   */
  const handleRemove = useCallback(() => {
    setLogoBase64(null);
    setError(null);
    localStorage.removeItem(LOGO_STORAGE_KEY);
    onLogoChange(null);
  }, [onLogoChange]);

  return (
    <div className={cn('w-full', className)}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFileChange}
        className="hidden"
        data-testid="logo-file-input"
        aria-label="Logo-Datei auswaehlen"
      />

      {logoBase64 ? (
        // Logo preview with remove button
        <div className="relative">
          <div className="flex items-center gap-4 p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex-shrink-0 w-24 h-16 flex items-center justify-center bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
              <img
                src={logoBase64}
                alt="Firmenlogo Vorschau"
                className="max-w-full max-h-full object-contain"
                data-testid="logo-preview"
              />
            </div>
            <div className="flex-grow">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Logo hochgeladen
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Klicken Sie auf den Bereich, um ein anderes Logo auszuwaehlen
              </p>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="flex-shrink-0 p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-500 transition-colors"
              aria-label="Logo entfernen"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ) : (
        // Upload area with drag & drop
        <div
          role="button"
          tabIndex={0}
          onClick={openFileDialog}
          onKeyDown={handleKeyDown}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          data-testid="logo-upload-area"
          className={cn(
            'flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-lg cursor-pointer transition-all',
            isDragActive
              ? 'drag-active border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
          )}
          aria-label="Logo hochladen - Klicken oder Datei hierher ziehen"
        >
          <div
            className={cn(
              'p-3 rounded-full transition-colors',
              isDragActive ? 'bg-blue-100 dark:bg-blue-800' : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            {isDragActive ? (
              <ImageIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            ) : (
              <Upload className="w-8 h-8 text-gray-500 dark:text-gray-400" />
            )}
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Logo hochladen</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Klicken oder Datei hierher ziehen
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PNG, JPEG (max. 2 MB)</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="mt-2 p-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded"
        >
          {error}
        </div>
      )}
    </div>
  );
}
