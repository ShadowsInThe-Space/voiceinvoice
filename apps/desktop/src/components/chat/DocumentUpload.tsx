/**
 * Document Upload Component for RAG Chat
 *
 * Allows users to upload documents for ingestion into Supabase Vector DB.
 * Supports PDF, text, Office documents, spreadsheets, and images.
 *
 * @module components/chat/DocumentUpload
 */

import React, { useState, useRef } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Props for the DocumentUpload component.
 *
 * @param {Function} onUploadComplete - Optional callback when upload completes successfully
 */
interface DocumentUploadProps {
  /**
   * Callback function invoked when upload completes successfully.
   */
  onUploadComplete?: () => void;
}

/**
 * Document upload button with status feedback.
 *
 * Uploads documents to n8n ingestion workflow which processes and stores
 * embeddings in Supabase Vector DB for RAG queries.
 *
 * @param {DocumentUploadProps} props - Component props
 * @returns {React.ReactElement} The document upload component
 */
export function DocumentUpload({ onUploadComplete }: DocumentUploadProps): React.ReactElement {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus('idle');
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Use local proxy route to avoid CORS issues with n8n
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      setStatus('success');
      if (onUploadComplete) onUploadComplete();

      // Reset after 3 seconds
      setTimeout(() => {
        setStatus('idle');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 3000);
    } catch (error) {
      console.error('Upload error:', error);
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsUploading(false);
    }
  };

  const triggerUpload = (): void => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
      />

      <button
        onClick={triggerUpload}
        disabled={isUploading}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg border transition-all',
          status === 'idle' && 'bg-background hover:bg-muted border-input',
          status === 'success' && 'bg-green-50 text-green-700 border-green-200',
          status === 'error' && 'bg-red-50 text-red-700 border-red-200',
          isUploading && 'opacity-80 cursor-wait'
        )}
      >
        {isUploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'success' ? (
          <Check className="w-4 h-4" />
        ) : status === 'error' ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Upload className="w-4 h-4" />
        )}

        <span className="text-sm font-medium">
          {isUploading
            ? 'Wird hochgeladen...'
            : status === 'success'
              ? 'Erfolgreich!'
              : status === 'error'
                ? 'Fehler'
                : 'Dokument hochladen'}
        </span>
      </button>

      {errorMessage && <p className="text-xs text-destructive px-1">{errorMessage}</p>}
    </div>
  );
}
