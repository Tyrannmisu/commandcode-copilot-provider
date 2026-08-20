import type { CancellationToken, Memento } from 'vscode';
import { AuthManager } from '../auth';
import { CommandCodeClient, ZDR_HEADER } from '../client';
import { getBaseUrl, getZdrEnabled } from '../config';
import { FAMILY, TOOLS_LIMIT } from '../consts';
import { logger } from '../logger';
import type { ModelDefinition, ThinkingCapability } from '../types';

/**
 * Live model-catalog sync (fetch-once, refresh-on-demand).
 *
 * The full model list (id, name, `context_length`) is pulled from
 * `GET /provider/v1/models` and persisted to `globalState` (VS Code's
 * JSON-backed store that survives restarts). The API is only contacted when:
 *   - no persisted snapshot exists yet (first run / first use), or
 *   - the user explicitly runs "Command Code: Refresh Models".
 *
 * The snapshot drives two things:
 *   1. context-window overrides for models already in `src/models.ts`, and
 *   2. auto-discovery of new models — anything the API serves but the static
 *      registry doesn't is surfaced in the picker with a "(fetched)" marker
 *      and conservative capability defaults (see `liveModelToDefinition`).
 *
 * Every other picker refresh reads the persisted snapshot — there is no
 * periodic or per-start network traffic. If the sync fails it falls back to
 * the persisted snapshot (if any) and finally to the static `src/models.ts`
 * registry (empty map), so this module never throws or blocks the picker.
 */

/** Bump this when the persisted snapshot shape changes. */
const CATALOG_STATE_VERSION = 'v2';

/** Prefix for the globalState key; the base URL is appended so each endpoint keeps its own snapshot. */
const CATALOG_STATE_KEY_PREFIX = 'commandcode-copilot.liveCatalog';

/** Min/max output-token estimate for auto-discovered models. */
const MIN_DEFAULT_OUTPUT_TOKENS = 4096;
const MAX_DEFAULT_OUTPUT_TOKENS = 131072;

/** Default capabilities assumed for auto-discovered models (vision + reasoning). */
const LIVE_DEFAULT_THINKING: ThinkingCapability = {
    supportedEfforts: ['low', 'medium', 'high'] as const,
    defaultEffort: 'medium',
    canDisable: true,
};

/** A model as reported by the live provider API, persisted across sessions. */
export interface LiveModelInfo {
    readonly name: string;
    readonly contextLength: number;
}

/** Session-scoped copy so repeated picker reads don't touch globalState every time. */
let sessionCache:
    | { readonly key: string; readonly models: ReadonlyMap<string, LiveModelInfo> }
    | undefined;

function stateKey(): string {
    return `${CATALOG_STATE_KEY_PREFIX}:${CATALOG_STATE_VERSION}:${getBaseUrl()}`;
}

function readPersisted(globalState: Memento): ReadonlyMap<string, LiveModelInfo> | undefined {
    const raw = globalState.get<Record<string, LiveModelInfo>>(stateKey());
    if (!raw) {
        return undefined;
    }
    const map = new Map<string, LiveModelInfo>();
    for (const [id, info] of Object.entries(raw)) {
        if (id && info && typeof info.contextLength === 'number' && info.contextLength > 0) {
            map.set(id, {
                name: typeof info.name === 'string' && info.name ? info.name : id,
                contextLength: info.contextLength,
            });
        }
    }
    return map.size > 0 ? map : undefined;
}

async function persist(
    globalState: Memento,
    models: ReadonlyMap<string, LiveModelInfo>,
): Promise<void> {
    const raw: Record<string, LiveModelInfo> = {};
    for (const [id, info] of models) {
        raw[id] = info;
    }
    try {
        await globalState.update(stateKey(), raw);
    } catch (error) {
        logger.warn('Failed to persist live model catalog', error);
    }
}

/**
 * Sensible max-output-token estimate for a model discovered at runtime:
 * one eighth of the total context window, clamped to [4K, 128K].
 */
export function defaultOutputTokensForContext(contextLength: number): number {
    return Math.max(
        MIN_DEFAULT_OUTPUT_TOKENS,
        Math.min(MAX_DEFAULT_OUTPUT_TOKENS, Math.round(contextLength / 8)),
    );
}

/**
 * Build a synthetic `ModelDefinition` for a model that only exists in the
 * live catalog. Capabilities are conservative defaults (vision + reasoning
 * enabled, tool calling on), and the name is marked "(fetched)" so users can
 * tell auto-discovered entries from the verified static registry.
 */
export function liveModelToDefinition(id: string, info: LiveModelInfo): ModelDefinition {
    const maxOutputTokens = defaultOutputTokensForContext(info.contextLength);
    const shortVersion = id.slice(id.lastIndexOf('/') + 1) || 'live';
    return {
        id,
        name: `${info.name} (fetched)`,
        family: FAMILY,
        version: shortVersion,
        detail: 'Auto-discovered from the live Command Code catalog',
        maxInputTokens: Math.max(1, info.contextLength - maxOutputTokens),
        maxOutputTokens,
        capabilities: {
            toolCalling: TOOLS_LIMIT,
            imageInput: true,
            thinking: LIVE_DEFAULT_THINKING,
        },
        category: 'Live',
    };
}

/**
 * Hit `GET /provider/v1/models` and build a fresh snapshot. Returns
 * `undefined` when the fetch can't run (no key), fails, or yields nothing.
 */
async function fetchLiveCatalog(
    authManager: AuthManager,
    token?: CancellationToken,
): Promise<ReadonlyMap<string, LiveModelInfo> | undefined> {
    const apiKey = await authManager.getApiKey();
    if (!apiKey) {
        return undefined;
    }

    try {
        const baseUrl = getBaseUrl();
        const extraHeaders = getZdrEnabled() ? ZDR_HEADER : undefined;
        const client = new CommandCodeClient(baseUrl, apiKey, { extraHeaders });
        const response = await client.listModels(token);

        const models = new Map<string, LiveModelInfo>();
        for (const model of response.data ?? []) {
            if (model?.id && typeof model.context_length === 'number' && model.context_length > 0) {
                models.set(model.id, {
                    name: typeof model.name === 'string' && model.name ? model.name : model.id,
                    contextLength: model.context_length,
                });
            }
        }
        return models.size > 0 ? models : undefined;
    } catch (error) {
        logger.warn('Live model catalog sync failed; falling back to persisted/static registry', error);
        return undefined;
    }
}

/**
 * Resolve the live catalog (`id -> { name, contextLength }`).
 *
 * @param globalState Persisted snapshot store (extension `globalState`).
 * @param authManager Used to fetch the API key; without a key no sync runs.
 * @param token Optional cancellation token. A cancelled fetch is not cached.
 * @param forceRefresh When true (explicit user refresh), always hit the API.
 */
export async function getLiveCatalog(
    globalState: Memento,
    authManager: AuthManager,
    token?: CancellationToken,
    forceRefresh = false,
): Promise<ReadonlyMap<string, LiveModelInfo>> {
    const key = stateKey();

    // Fast path: this session already has a snapshot for this endpoint.
    if (!forceRefresh && sessionCache?.key === key) {
        return sessionCache.models;
    }

    // Persisted snapshot from a previous session (unless refreshing).
    if (!forceRefresh) {
        const persisted = readPersisted(globalState);
        if (persisted) {
            sessionCache = { key, models: persisted };
            return persisted;
        }
    }

    // First run or explicit refresh — hit the API once.
    const fetched = await fetchLiveCatalog(authManager, token);
    if (fetched) {
        // Don't cache a partial or aborted fetch.
        if (!token?.isCancellationRequested) {
            sessionCache = { key, models: fetched };
            await persist(globalState, fetched);
        }
        return fetched;
    }

    return readPersisted(globalState) ?? new Map();
}
