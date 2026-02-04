/**
 * Confidence-based routing for VoiceInvoice Enterprise.
 *
 * Routes invoice data based on classification confidence:
 * - Confidence >= 0.85 -> Auto-save
 * - Confidence >= 0.60 -> Show user preview for confirmation
 * - Confidence < 0.60 -> Manual input required
 */

import type { Intent, IntentResult } from './index';

/**
 * Routing destination types.
 *
 * - auto_save: High confidence, save directly without user confirmation
 * - preview: Medium confidence, show preview for user confirmation
 * - manual: Low confidence, require manual user input
 */
export type Route = 'auto_save' | 'preview' | 'manual';

/**
 * Configurable thresholds for routing decisions.
 */
export interface RoutingThresholds {
  /** Minimum confidence for auto-save (default: 0.85) */
  autoSave: number;

  /** Minimum confidence for preview (default: 0.60) */
  preview: number;
}

/**
 * Default routing thresholds based on requirements.
 */
export const DEFAULT_ROUTING_THRESHOLDS: RoutingThresholds = {
  autoSave: 0.85,
  preview: 0.6,
};

/**
 * Result of a routing decision.
 *
 * Contains the determined route, along with metadata
 * about the decision for debugging and analytics.
 */
export interface RoutingDecision {
  /** The determined route */
  route: Route;

  /** Original intent from classification */
  intent: Intent;

  /** Confidence score used for routing */
  confidence: number;

  /** Classification method (RULES or GEMINI) */
  method: 'RULES' | 'GEMINI';

  /** Human-readable reason for the routing decision */
  reason: string;

  /** Thresholds used for this decision */
  thresholds: RoutingThresholds;
}

/**
 * Makes a routing decision based on intent classification result.
 *
 * The routing logic follows these rules:
 * 1. UNKNOWN intent always routes to manual regardless of confidence
 * 2. Confidence >= autoSave threshold -> auto_save
 * 3. Confidence >= preview threshold -> preview
 * 4. Confidence < preview threshold -> manual
 *
 * @param intentResult - The intent classification result
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_ROUTING_THRESHOLDS)
 * @returns The routing decision with metadata
 *
 * @example
 * const decision = makeRoutingDecision({
 *   intent: 'INVOICE',
 *   confidence: 0.92,
 *   method: 'RULES',
 *   latencyMs: 15
 * });
 * // Returns: { route: 'auto_save', ... }
 *
 * @example
 * // With custom thresholds
 * const decision = makeRoutingDecision(intentResult, {
 *   autoSave: 0.95,
 *   preview: 0.7
 * });
 */
export function makeRoutingDecision(
  intentResult: IntentResult,
  thresholds: RoutingThresholds = DEFAULT_ROUTING_THRESHOLDS
): RoutingDecision {
  const { intent, confidence, method } = intentResult;

  // UNKNOWN intent always goes to manual - we can't auto-process
  // something we don't understand
  if (intent === 'UNKNOWN') {
    return {
      route: 'manual',
      intent,
      confidence,
      method,
      reason: `Unknown intent requires manual handling (confidence: ${(confidence * 100).toFixed(1)}%)`,
      thresholds,
    };
  }

  // High confidence: auto-save
  if (confidence >= thresholds.autoSave) {
    return {
      route: 'auto_save',
      intent,
      confidence,
      method,
      reason: `High confidence ${intent} intent (${(confidence * 100).toFixed(1)}% >= ${(thresholds.autoSave * 100).toFixed(1)}%)`,
      thresholds,
    };
  }

  // Medium confidence: preview for user confirmation
  if (confidence >= thresholds.preview) {
    return {
      route: 'preview',
      intent,
      confidence,
      method,
      reason: `Medium confidence ${intent} intent (${(thresholds.preview * 100).toFixed(1)}% <= ${(confidence * 100).toFixed(1)}% < ${(thresholds.autoSave * 100).toFixed(1)}%)`,
      thresholds,
    };
  }

  // Low confidence: manual input required
  return {
    route: 'manual',
    intent,
    confidence,
    method,
    reason: `Low confidence ${intent} intent (${(confidence * 100).toFixed(1)}% < ${(thresholds.preview * 100).toFixed(1)}%)`,
    thresholds,
  };
}

/**
 * Checks if a routing decision allows auto-save.
 *
 * @param decision - The routing decision to check
 * @returns True if the route is auto_save
 */
export function canAutoSave(decision: RoutingDecision): boolean {
  return decision.route === 'auto_save';
}

/**
 * Checks if a routing decision requires user confirmation.
 *
 * @param decision - The routing decision to check
 * @returns True if the route is preview or manual
 */
export function requiresUserConfirmation(decision: RoutingDecision): boolean {
  return decision.route === 'preview' || decision.route === 'manual';
}

/**
 * Checks if a routing decision requires manual input.
 *
 * @param decision - The routing decision to check
 * @returns True if the route is manual
 */
export function requiresManualInput(decision: RoutingDecision): boolean {
  return decision.route === 'manual';
}

/**
 * Statistics for routing decisions analytics.
 *
 * Used to track routing patterns and identify potential
 * threshold adjustments or model improvements.
 */
export interface RoutingStatistics {
  /** Total number of routing decisions */
  total: number;

  /** Count per route type */
  byRoute: Record<Route, number>;

  /** Count per intent type */
  byIntent: Record<Intent, number>;

  /** Count per classification method */
  byMethod: Record<'RULES' | 'GEMINI', number>;

  /** Average confidence per route */
  avgConfidenceByRoute: Record<Route, number>;

  /** Percentage of decisions that were auto-saved */
  autoSaveRate: number;

  /** Percentage of decisions requiring manual input */
  manualRate: number;
}

/**
 * Aggregates routing decisions into statistics for analytics.
 *
 * This function is useful for:
 * - Monitoring routing patterns over time
 * - Identifying if thresholds need adjustment
 * - Detecting drops in classification confidence
 *
 * @param decisions - Array of routing decisions to aggregate
 * @returns Aggregated statistics
 *
 * @example
 * const stats = aggregateRoutingStatistics(recentDecisions);
 * if (stats.manualRate > 0.3) {
 *   console.warn('High manual input rate - consider model retraining');
 * }
 */
export function aggregateRoutingStatistics(decisions: RoutingDecision[]): RoutingStatistics {
  if (decisions.length === 0) {
    return {
      total: 0,
      byRoute: { auto_save: 0, preview: 0, manual: 0 },
      byIntent: {} as Record<Intent, number>,
      byMethod: { RULES: 0, GEMINI: 0 },
      avgConfidenceByRoute: { auto_save: 0, preview: 0, manual: 0 },
      autoSaveRate: 0,
      manualRate: 0,
    };
  }

  const byRoute: Record<Route, number> = { auto_save: 0, preview: 0, manual: 0 };
  const byIntent: Record<Intent, number> = {} as Record<Intent, number>;
  const byMethod: Record<'RULES' | 'GEMINI', number> = { RULES: 0, GEMINI: 0 };
  const confidenceSums: Record<Route, number> = { auto_save: 0, preview: 0, manual: 0 };

  for (const decision of decisions) {
    byRoute[decision.route]++;
    byIntent[decision.intent] = (byIntent[decision.intent] || 0) + 1;
    byMethod[decision.method]++;
    confidenceSums[decision.route] += decision.confidence;
  }

  const avgConfidenceByRoute: Record<Route, number> = {
    auto_save: byRoute.auto_save > 0 ? confidenceSums.auto_save / byRoute.auto_save : 0,
    preview: byRoute.preview > 0 ? confidenceSums.preview / byRoute.preview : 0,
    manual: byRoute.manual > 0 ? confidenceSums.manual / byRoute.manual : 0,
  };

  return {
    total: decisions.length,
    byRoute,
    byIntent,
    byMethod,
    avgConfidenceByRoute,
    autoSaveRate: byRoute.auto_save / decisions.length,
    manualRate: byRoute.manual / decisions.length,
  };
}

/**
 * Makes routing decisions for multiple intent results in batch.
 *
 * Useful for processing multiple voice commands or
 * re-evaluating historical data with new thresholds.
 *
 * @param intentResults - Array of intent classification results
 * @param thresholds - Optional custom thresholds
 * @returns Array of routing decisions
 *
 * @example
 * const decisions = batchRoute(intentResults, { autoSave: 0.90, preview: 0.65 });
 * const stats = aggregateRoutingStatistics(decisions);
 */
export function batchRoute(
  intentResults: IntentResult[],
  thresholds: RoutingThresholds = DEFAULT_ROUTING_THRESHOLDS
): RoutingDecision[] {
  return intentResults.map((result) => makeRoutingDecision(result, thresholds));
}
