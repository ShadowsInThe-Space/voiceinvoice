import React, { useState, useRef, useEffect } from 'react';
import { Upload, Check, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DocumentUploadProps {
  onUploadComplete?: () => void;
}

/**
 * DocumentUpload component.
 *
 * Provides a file upload interface for ingesting documents into the RAG system.
 *
 * @param {DocumentUploadProps} props - Component props
 * @param {Function} [props.onUploadComplete] - Callback function when upload completes successfully
 * @returns {JSX.Element} The document upload component
 */
export function DocumentUpload({ onUploadComplete }: DocumentUploadProps): JSX.Element {
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ingestWebhookUrl, setIngestWebhookUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load environment configuration from IPC bridge
    async function loadConfig(): Promise<void> {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      if (typeof window !== 'undefined' && (window as any).voiceinvoice?.env) {
        const webhookUrl = await (window as any).voiceinvoice.env.getN8nIngestWebhook();
        /* eslint-enable @typescript-eslint/no-explicit-any */
        if (webhookUrl) {
          setIngestWebhookUrl(webhookUrl);
        } else {
          console.error('Missing N8N_INGEST_WEBHOOK in environment');
        }
      }
    }

    loadConfig();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus('idle');
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      if (!ingestWebhookUrl) {
        throw new Error('Ingestion webhook URL not configured');
      }

      const response = await fetch(ingestWebhookUrl, {
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
