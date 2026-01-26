/**
 * Document Upload API Route
 *
 * Forwards documents to n8n for ingestion into Supabase Vector DB.
 * Also stores locally for backup.
 *
 * @module api/documents/upload
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import FormData from 'form-data';

// Disable default body parser to handle multipart form data
export const config = {
  api: {
    bodyParser: false,
  },
};

interface UploadResponse {
  success: boolean;
  message: string;
  documentId?: string;
  filename?: string;
  n8nResponse?: unknown;
}

// Documents storage directory (local backup)
const DOCUMENTS_DIR = path.join(process.cwd(), 'data', 'documents');

// n8n Ingest Webhook URL
const N8N_INGEST_URL =
  process.env.NEXT_PUBLIC_N8N_INGEST_WEBHOOK || 'https://n8n.shadowsinthe.space/webhook/ingest';

/**
 * Ensures the documents directory exists.
 */
function ensureDocumentsDir(): void {
  if (!fs.existsSync(DOCUMENTS_DIR)) {
    fs.mkdirSync(DOCUMENTS_DIR, { recursive: true });
  }
}

/**
 * Handles document upload, stores locally and forwards to n8n.
 *
 * POST /api/documents/upload
 * Body: multipart/form-data with 'file' field
 *
 * @param req - Next.js API request
 * @param res - Next.js API response
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Method not allowed' });
    return;
  }

  try {
    ensureDocumentsDir();

    // Parse multipart form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB max
    });

    const [, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      res.status(400).json({ success: false, message: 'No file provided' });
      return;
    }

    // Generate unique document ID
    const documentId = randomUUID();
    const originalFilename = file.originalFilename || 'document';
    const extension = path.extname(originalFilename);
    const storedFilename = `${documentId}${extension}`;
    const destPath = path.join(DOCUMENTS_DIR, storedFilename);

    // Store locally as backup
    fs.copyFileSync(file.filepath, destPath);

    // Store metadata
    const metadataPath = path.join(DOCUMENTS_DIR, `${documentId}.json`);
    const metadata = {
      id: documentId,
      originalFilename,
      storedFilename,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    console.log(`[Upload] Document stored locally: ${storedFilename} (${file.size} bytes)`);

    // Forward to n8n for vector DB ingestion
    let n8nResponse: unknown = null;
    try {
      const formData = new FormData();
      formData.append('file', fs.createReadStream(file.filepath), {
        filename: originalFilename,
        contentType: file.mimetype || 'application/octet-stream',
      });
      formData.append('documentId', documentId);
      formData.append('filename', originalFilename);

      const response = await fetch(N8N_INGEST_URL, {
        method: 'POST',
        // @ts-expect-error - FormData types issue
        body: formData,
        headers: formData.getHeaders(),
      });

      if (response.ok) {
        n8nResponse = await response.json().catch(() => ({ status: 'processed' }));
        console.log(`[Upload] Document sent to n8n for ingestion: ${originalFilename}`);
      } else {
        console.warn(`[Upload] n8n returned ${response.status}: ${await response.text()}`);
      }
    } catch (n8nError) {
      console.error('[Upload] Failed to send to n8n:', n8nError);
      // Don't fail the upload if n8n is unreachable
    }

    // Clean up temp file
    fs.unlink(file.filepath, () => {});

    res.status(200).json({
      success: true,
      message: 'Dokument erfolgreich hochgeladen und zur Verarbeitung gesendet',
      documentId,
      filename: originalFilename,
      n8nResponse,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Upload fehlgeschlagen',
    });
  }
}
