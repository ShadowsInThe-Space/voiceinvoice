/**
 * Conflict resolver for offline sync.
 *
 * Handles conflicts that arise when local and server data
 * have diverged during offline operation.
 *
 * @module lib/sync/conflict-resolver
 */

import { SyncEntityType } from './sync-queue';

/**
 * Available conflict resolution strategies.
 */
export type ConflictResolutionStrategy =
  | 'LAST_WRITE_WINS'
  | 'SERVER_WINS'
  | 'CLIENT_WINS'
  | 'MERGE';

/**
 * Types of conflicts that can occur.
 */
export type ConflictType =
  | 'UPDATE_UPDATE'
  | 'DELETE_UPDATE'
  | 'UPDATE_DELETE'
  | 'CREATE_CREATE';

/**
 * Winner of a conflict resolution.
 */
export type ConflictWinner = 'LOCAL' | 'SERVER' | 'MERGED';

/**
 * Action to take after resolving a conflict.
 */
export type ConflictAction =
  | 'UPDATE_LOCAL'
  | 'UPDATE_SERVER'
  | 'DELETE_LOCAL'
  | 'DELETE_SERVER'
  | 'RESTORE_AND_UPDATE'
  | 'MERGE_BOTH';

/**
 * Represents a detected sync conflict.
 */
export interface SyncConflict {
  /** Type of conflict */
  type: ConflictType;
  /** Entity type involved */
  entityType: SyncEntityType;
  /** Entity ID involved */
  entityId: string;
  /** Local version of the data (null if deleted locally) */
  localData: Record<string, unknown> | null;
  /** Server version of the data (null if deleted on server) */
  serverData: Record<string, unknown> | null;
  /** Base version before changes (for 3-way merge) */
  baseData?: Record<string, unknown> | null | undefined;
  /** Timestamp when conflict was detected */
  detectedAt: Date;
}

/**
 * Result of resolving a conflict.
 */
export interface ResolvedConflict {
  /** Which side won the conflict */
  winner: ConflictWinner;
  /** The resolved data to use */
  resolvedData: Record<string, unknown> | null;
  /** Action to take to apply the resolution */
  action: ConflictAction;
  /** Strategy used for resolution */
  strategyUsed: ConflictResolutionStrategy;
}

/**
 * Input for conflict detection.
 */
export interface ConflictDetectionInput {
  /** Entity type */
  entityType: SyncEntityType;
  /** Entity ID */
  entityId: string;
  /** Local data (null if deleted) */
  localData: Record<string, unknown> | null;
  /** Server data (null if deleted) */
  serverData: Record<string, unknown> | null;
  /** Base data before changes */
  baseData?: Record<string, unknown> | null;
}

/**
 * Custom resolver function type.
 */
export type CustomResolverFn = (conflict: SyncConflict) => ResolvedConflict;

/**
 * History entry for resolved conflicts.
 */
export interface ConflictHistoryEntry {
  /** The original conflict */
  conflict: SyncConflict;
  /** How it was resolved */
  resolution: ResolvedConflict;
  /** When it was resolved */
  resolvedAt: Date;
}

/**
 * Options for creating a ConflictResolver.
 */
export interface ConflictResolverOptions {
  /** Default resolution strategy */
  strategy?: ConflictResolutionStrategy;
  /** Maximum history entries to keep */
  maxHistorySize?: number;
}

/**
 * Compares two values for equality (deep comparison for objects).
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if values are equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== 'object' || typeof b !== 'object') return false;

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);

  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (
      !bKeys.includes(key) ||
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Gets the timestamp from data if available.
 *
 * @param data - The data object
 * @returns The timestamp as Date, or null
 */
function getTimestamp(data: Record<string, unknown> | null): Date | null {
  if (!data) return null;
  const updatedAt = data.updatedAt || data.createdAt;
  if (!updatedAt) return null;
  return updatedAt instanceof Date ? updatedAt : new Date(updatedAt as string);
}

/**
 * Conflict resolver for handling sync conflicts.
 *
 * Implements multiple strategies for resolving conflicts between
 * local and server data when they have diverged.
 *
 * @example
 * const resolver = new ConflictResolver({ strategy: 'LAST_WRITE_WINS' });
 *
 * const conflict = resolver.detectConflict({
 *   entityType: 'customer',
 *   entityId: 'cust-1',
 *   localData: { name: 'Local Name' },
 *   serverData: { name: 'Server Name' },
 *   baseData: { name: 'Original' },
 * });
 *
 * if (conflict) {
 *   const resolution = resolver.resolve(conflict);
 *   await applyResolution(resolution);
 * }
 */
export class ConflictResolver {
  private readonly strategy: ConflictResolutionStrategy;
  private readonly maxHistorySize: number;
  private readonly customResolvers: Map<SyncEntityType, CustomResolverFn>;
  private readonly history: ConflictHistoryEntry[];

  /**
   * Creates a new ConflictResolver.
   *
   * @param options - Configuration options
   *
   * @example
   * const resolver = new ConflictResolver({
   *   strategy: 'SERVER_WINS',
   *   maxHistorySize: 100,
   * });
   */
  constructor(options?: ConflictResolverOptions) {
    this.strategy = options?.strategy ?? 'LAST_WRITE_WINS';
    this.maxHistorySize = options?.maxHistorySize ?? 100;
    this.customResolvers = new Map();
    this.history = [];
  }

  /**
   * Gets the current resolution strategy.
   *
   * @returns The strategy name
   */
  getStrategy(): ConflictResolutionStrategy {
    return this.strategy;
  }

  /**
   * Detects if a conflict exists between local and server data.
   *
   * @param input - The data to check for conflicts
   * @returns The detected conflict, or null if no conflict
   *
   * @example
   * const conflict = resolver.detectConflict({
   *   entityType: 'customer',
   *   entityId: 'cust-1',
   *   localData: { name: 'Local' },
   *   serverData: { name: 'Server' },
   *   baseData: { name: 'Original' },
   * });
   */
  detectConflict(input: ConflictDetectionInput): SyncConflict | null {
    const { entityType, entityId, localData, serverData, baseData } = input;

    // No conflict if data is identical
    if (deepEqual(localData, serverData)) {
      return null;
    }

    // Determine conflict type
    let type: ConflictType;

    if (localData === null && serverData !== null) {
      // Local deleted, server updated
      type = 'DELETE_UPDATE';
    } else if (localData !== null && serverData === null) {
      // Local updated, server deleted
      type = 'UPDATE_DELETE';
    } else if (baseData === null && localData !== null && serverData !== null) {
      // Both created same entity (rare)
      type = 'CREATE_CREATE';
    } else {
      // Both updated
      type = 'UPDATE_UPDATE';
    }

    return {
      type,
      entityType,
      entityId,
      localData,
      serverData,
      baseData,
      detectedAt: new Date(),
    };
  }

  /**
   * Resolves a conflict using the configured strategy.
   *
   * @param conflict - The conflict to resolve
   * @returns The resolution result
   *
   * @example
   * const resolution = resolver.resolve(conflict);
   * if (resolution.winner === 'SERVER') {
   *   await updateLocal(resolution.resolvedData);
   * }
   */
  resolve(conflict: SyncConflict): ResolvedConflict {
    // Check for custom resolver first
    const customResolver = this.customResolvers.get(conflict.entityType);
    if (customResolver) {
      const resolution = customResolver(conflict);
      this.addToHistory(conflict, resolution);
      return resolution;
    }

    let resolution: ResolvedConflict;

    // Handle DELETE conflicts specially
    if (conflict.type === 'DELETE_UPDATE') {
      resolution = this.resolveDeleteUpdate(conflict);
    } else if (conflict.type === 'UPDATE_DELETE') {
      resolution = this.resolveUpdateDelete(conflict);
    } else if (this.strategy === 'MERGE') {
      resolution = this.resolveMerge(conflict);
    } else {
      resolution = this.resolveWithStrategy(conflict);
    }

    this.addToHistory(conflict, resolution);
    return resolution;
  }

  /**
   * Sets a custom resolver for a specific entity type.
   *
   * @param entityType - The entity type to handle
   * @param resolver - The custom resolver function
   *
   * @example
   * resolver.setCustomResolver('invoice', (conflict) => ({
   *   winner: 'LOCAL',
   *   resolvedData: conflict.localData,
   *   action: 'UPDATE_SERVER',
   *   strategyUsed: 'CLIENT_WINS',
   * }));
   */
  setCustomResolver(entityType: SyncEntityType, resolver: CustomResolverFn): void {
    this.customResolvers.set(entityType, resolver);
  }

  /**
   * Creates a human-readable conflict report.
   *
   * @param conflict - The conflict to report on
   * @returns A formatted report string
   */
  createConflictReport(conflict: SyncConflict): string {
    const lines = [
      `Conflict Report`,
      `===============`,
      `Type: ${conflict.type}`,
      `Entity: ${conflict.entityType}`,
      `Entity ID: ${conflict.entityId}`,
      `Detected: ${conflict.detectedAt.toISOString()}`,
      ``,
      `Local Data: ${JSON.stringify(conflict.localData, null, 2)}`,
      ``,
      `Server Data: ${JSON.stringify(conflict.serverData, null, 2)}`,
    ];

    if (conflict.baseData) {
      lines.push(``, `Base Data: ${JSON.stringify(conflict.baseData, null, 2)}`);
    }

    return lines.join('\n');
  }

  /**
   * Gets the history of resolved conflicts.
   *
   * @returns Array of history entries
   */
  getConflictHistory(): ConflictHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Resolves a conflict using the configured strategy.
   *
   * @param conflict - The conflict to resolve
   * @returns The resolution
   */
  private resolveWithStrategy(conflict: SyncConflict): ResolvedConflict {
    switch (this.strategy) {
      case 'SERVER_WINS':
        return {
          winner: 'SERVER',
          resolvedData: conflict.serverData,
          action: 'UPDATE_LOCAL',
          strategyUsed: 'SERVER_WINS',
        };

      case 'CLIENT_WINS':
        return {
          winner: 'LOCAL',
          resolvedData: conflict.localData,
          action: 'UPDATE_SERVER',
          strategyUsed: 'CLIENT_WINS',
        };

      case 'LAST_WRITE_WINS':
      default:
        return this.resolveLastWriteWins(conflict);
    }
  }

  /**
   * Resolves using LAST_WRITE_WINS strategy.
   *
   * @param conflict - The conflict to resolve
   * @returns The resolution
   */
  private resolveLastWriteWins(conflict: SyncConflict): ResolvedConflict {
    const localTimestamp = getTimestamp(conflict.localData);
    const serverTimestamp = getTimestamp(conflict.serverData);

    // If we can't determine timestamps, prefer server (safer)
    if (!localTimestamp && !serverTimestamp) {
      return {
        winner: 'SERVER',
        resolvedData: conflict.serverData,
        action: 'UPDATE_LOCAL',
        strategyUsed: 'LAST_WRITE_WINS',
      };
    }

    if (!localTimestamp) {
      return {
        winner: 'SERVER',
        resolvedData: conflict.serverData,
        action: 'UPDATE_LOCAL',
        strategyUsed: 'LAST_WRITE_WINS',
      };
    }

    if (!serverTimestamp) {
      return {
        winner: 'LOCAL',
        resolvedData: conflict.localData,
        action: 'UPDATE_SERVER',
        strategyUsed: 'LAST_WRITE_WINS',
      };
    }

    if (localTimestamp > serverTimestamp) {
      return {
        winner: 'LOCAL',
        resolvedData: conflict.localData,
        action: 'UPDATE_SERVER',
        strategyUsed: 'LAST_WRITE_WINS',
      };
    }

    return {
      winner: 'SERVER',
      resolvedData: conflict.serverData,
      action: 'UPDATE_LOCAL',
      strategyUsed: 'LAST_WRITE_WINS',
    };
  }

  /**
   * Resolves using MERGE strategy (3-way merge).
   *
   * @param conflict - The conflict to resolve
   * @returns The resolution
   */
  private resolveMerge(conflict: SyncConflict): ResolvedConflict {
    const { localData, serverData, baseData } = conflict;

    // If no base data, fall back to LAST_WRITE_WINS
    if (!baseData || !localData || !serverData) {
      return this.resolveLastWriteWins(conflict);
    }

    const merged: Record<string, unknown> = { ...baseData };
    const allKeys = Array.from(new Set([
      ...Object.keys(localData),
      ...Object.keys(serverData),
      ...Object.keys(baseData),
    ]));

    const localTimestamp = getTimestamp(localData);
    const serverTimestamp = getTimestamp(serverData);

    for (const key of allKeys) {
      const baseValue = baseData[key];
      const localValue = localData[key];
      const serverValue = serverData[key];

      // If only local changed, use local
      if (!deepEqual(localValue, baseValue) && deepEqual(serverValue, baseValue)) {
        merged[key] = localValue;
      }
      // If only server changed, use server
      else if (deepEqual(localValue, baseValue) && !deepEqual(serverValue, baseValue)) {
        merged[key] = serverValue;
      }
      // If both changed to same value, use that value
      else if (deepEqual(localValue, serverValue)) {
        merged[key] = localValue;
      }
      // Both changed to different values - use LAST_WRITE_WINS
      else if (!deepEqual(localValue, baseValue) && !deepEqual(serverValue, baseValue)) {
        if (localTimestamp && serverTimestamp && localTimestamp > serverTimestamp) {
          merged[key] = localValue;
        } else {
          merged[key] = serverValue;
        }
      }
    }

    // Update timestamp
    merged.updatedAt = new Date();

    return {
      winner: 'MERGED',
      resolvedData: merged,
      action: 'MERGE_BOTH',
      strategyUsed: 'MERGE',
    };
  }

  /**
   * Resolves DELETE_UPDATE conflict (local deleted, server updated).
   *
   * @param conflict - The conflict to resolve
   * @returns The resolution
   */
  private resolveDeleteUpdate(conflict: SyncConflict): ResolvedConflict {
    // Default: preserve data (server wins)
    // The user can override this with custom resolver
    if (this.strategy === 'CLIENT_WINS') {
      return {
        winner: 'LOCAL',
        resolvedData: null,
        action: 'DELETE_SERVER',
        strategyUsed: 'CLIENT_WINS',
      };
    }

    return {
      winner: 'SERVER',
      resolvedData: conflict.serverData,
      action: 'RESTORE_AND_UPDATE',
      strategyUsed: this.strategy,
    };
  }

  /**
   * Resolves UPDATE_DELETE conflict (local updated, server deleted).
   *
   * @param conflict - The conflict to resolve
   * @returns The resolution
   */
  private resolveUpdateDelete(conflict: SyncConflict): ResolvedConflict {
    if (this.strategy === 'SERVER_WINS') {
      return {
        winner: 'SERVER',
        resolvedData: null,
        action: 'DELETE_LOCAL',
        strategyUsed: 'SERVER_WINS',
      };
    }

    if (this.strategy === 'CLIENT_WINS') {
      return {
        winner: 'LOCAL',
        resolvedData: conflict.localData,
        action: 'UPDATE_SERVER',
        strategyUsed: 'CLIENT_WINS',
      };
    }

    // LAST_WRITE_WINS: compare timestamps
    const localTimestamp = getTimestamp(conflict.localData);
    if (localTimestamp && localTimestamp > conflict.detectedAt) {
      return {
        winner: 'LOCAL',
        resolvedData: conflict.localData,
        action: 'UPDATE_SERVER',
        strategyUsed: 'LAST_WRITE_WINS',
      };
    }

    return {
      winner: 'SERVER',
      resolvedData: null,
      action: 'DELETE_LOCAL',
      strategyUsed: 'LAST_WRITE_WINS',
    };
  }

  /**
   * Adds a resolution to history.
   *
   * @param conflict - The conflict
   * @param resolution - The resolution
   */
  private addToHistory(conflict: SyncConflict, resolution: ResolvedConflict): void {
    this.history.push({
      conflict,
      resolution,
      resolvedAt: new Date(),
    });

    // Trim history if needed
    while (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }
}
