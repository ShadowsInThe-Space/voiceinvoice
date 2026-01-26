/**
 * Workflow List API Route
 *
 * Returns available workflows without exposing webhook URLs.
 *
 * @module api/workflows/list
 */

import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Available workflow information (no sensitive data).
 */
interface WorkflowInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

/**
 * Response from workflow list.
 */
interface ListResponse {
  success: boolean;
  workflows: WorkflowInfo[];
}

/**
 * All available workflows with their metadata.
 * Matching active workflows on n8n server.
 */
const AVAILABLE_WORKFLOWS: WorkflowInfo[] = [
  {
    id: 'WORKFLOW_RECHNUNGSEINGANG',
    name: 'Rechnungseingangs-Agent',
    description: 'Prüft eingehende E-Mails nach Rechnungen und extrahiert Daten automatisch',
    enabled: true,
  },
  {
    id: 'WORKFLOW_MAHNWESEN',
    name: 'Mahnwesen-Agent',
    description: 'Prüft überfällige Rechnungen und erstellt Mahnungen (Human-in-Loop)',
    enabled: true,
  },
  {
    id: 'CHAT',
    name: 'RAG Chat',
    description: 'Beantwortet Fragen zu Rechnungen und Dokumenten',
    enabled: true,
  },
  {
    id: 'INGEST',
    name: 'Dokument-Ingestion',
    description: 'Importiert Dokumente in die Vektor-Datenbank für RAG',
    enabled: true,
  },
];

/**
 * Workflow list API endpoint.
 *
 * GET /api/workflows/list
 * Returns: { success, workflows }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ListResponse>
): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      workflows: [],
    });
    return;
  }

  res.status(200).json({
    success: true,
    workflows: AVAILABLE_WORKFLOWS,
  });
}
