/**
 * Workflow Trigger API Route
 *
 * Server-side proxy for triggering n8n workflows.
 * Keeps webhook URLs and credentials on the server side.
 *
 * @module api/workflows/trigger
 */

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Available workflow types and their n8n webhook paths.
 * URLs come from environment variables - not exposed to client.
 */
const WORKFLOW_ENDPOINTS: Record<string, string | undefined> = {
  // Invoice workflows (German names matching n8n)
  RECHNUNGSEINGANG: process.env.N8N_WEBHOOK_RECHNUNGSEINGANG,
  MAHNWESEN: process.env.N8N_WEBHOOK_MAHNWESEN,

  // RAG Chat workflows
  CHAT: process.env.N8N_CHAT_WEBHOOK,
  INGEST: process.env.N8N_INGEST_WEBHOOK,

  // Mapped from voice command intents
  WORKFLOW_RECHNUNGSEINGANG: process.env.N8N_WEBHOOK_RECHNUNGSEINGANG,
  WORKFLOW_MAHNWESEN: process.env.N8N_WEBHOOK_MAHNWESEN,
};

/**
 * Fallback URLs for development (Hetzner server).
 */
const FALLBACK_BASE_URL = 'https://n8n.shadowsinthe.space';
const FALLBACK_ENDPOINTS: Record<string, string> = {
  // Matching active workflows on n8n server
  RECHNUNGSEINGANG: `${FALLBACK_BASE_URL}/webhook/rechnungseingang`,
  MAHNWESEN: `${FALLBACK_BASE_URL}/webhook/mahnwesen`,
  CHAT: `${FALLBACK_BASE_URL}/webhook/chat`,
  INGEST: `${FALLBACK_BASE_URL}/webhook/ingest`,
  // Voice command intent mappings
  WORKFLOW_RECHNUNGSEINGANG: `${FALLBACK_BASE_URL}/webhook/rechnungseingang`,
  WORKFLOW_MAHNWESEN: `${FALLBACK_BASE_URL}/webhook/mahnwesen`,
};

/**
 * Request body for workflow trigger.
 */
interface TriggerRequest {
  /** Workflow type to trigger */
  workflow: string;
  /** Payload data for the workflow */
  payload?: Record<string, unknown>;
}

/**
 * Response from workflow trigger.
 */
interface TriggerResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  executionTimeMs: number;
}

/**
 * Workflow trigger API endpoint.
 *
 * POST /api/workflows/trigger
 * Body: { workflow, payload }
 * Returns: { success, message, data?, error?, executionTimeMs }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TriggerResponse>
): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      message: 'Method not allowed',
      executionTimeMs: 0,
    });
    return;
  }

  const startTime = Date.now();
  const { workflow, payload = {} }: TriggerRequest = req.body;

  // Validate workflow type
  if (!workflow || typeof workflow !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Missing or invalid workflow parameter',
      executionTimeMs: Date.now() - startTime,
    });
    return;
  }

  // Get webhook URL (from env or fallback)
  const webhookUrl = WORKFLOW_ENDPOINTS[workflow] || FALLBACK_ENDPOINTS[workflow];

  if (!webhookUrl) {
    res.status(400).json({
      success: false,
      message: `Unbekannter Workflow: ${workflow}`,
      error: 'WORKFLOW_NOT_CONFIGURED',
      executionTimeMs: Date.now() - startTime,
    });
    return;
  }

  console.log(`[Workflow API] Triggering ${workflow} at ${webhookUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        workflow,
        triggeredAt: new Date().toISOString(),
        ...payload,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json().catch(() => ({}));

      res.status(200).json({
        success: true,
        message: data.message || `Workflow ${workflow} erfolgreich ausgeführt`,
        data,
        executionTimeMs: Date.now() - startTime,
      });
      return;
    }

    // HTTP error
    const errorText = await response.text().catch(() => response.statusText);
    console.error(`[Workflow API] HTTP ${response.status}: ${errorText}`);

    res.status(response.status).json({
      success: false,
      message: `Workflow fehlgeschlagen: ${response.statusText}`,
      error: errorText,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
    console.error(`[Workflow API] Error triggering ${workflow}:`, errorMessage);

    // Detect specific error types
    let userMessage = `Workflow konnte nicht ausgeführt werden: ${errorMessage}`;

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      userMessage = 'n8n Server ist nicht erreichbar. Bitte prüfen Sie die Verbindung.';
    } else if (errorMessage.includes('aborted') || errorMessage.includes('timeout')) {
      userMessage = 'Workflow-Ausführung hat zu lange gedauert.';
    }

    res.status(500).json({
      success: false,
      message: userMessage,
      error: errorMessage,
      executionTimeMs: Date.now() - startTime,
    });
  }
}
