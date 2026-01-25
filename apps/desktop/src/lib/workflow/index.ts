/**
 * Workflow module for n8n integration.
 *
 * @module lib/workflow
 */

export {
  triggerWorkflow,
  getWorkflowConfig,
  saveWorkflowConfig,
  getWebhookUrl,
  getAvailableWorkflows,
  getWorkflowName,
  getWorkflowDescription,
  isValidBaseUrl,
  WORKFLOW_STORAGE_KEYS,
  type WorkflowConfig,
  type WorkflowWebhookConfig,
  type WorkflowParams,
  type WorkflowResult,
  type WorkflowErrorType,
} from './workflow-trigger';
