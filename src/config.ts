import vscode from 'vscode';
import { CONFIG_SECTION, DEFAULT_BASE_URL } from './consts';

export type DebugMode = 'minimal' | 'metadata' | 'verbose';

/**
 * Get Command Code API base URL from settings.
 * Falls back to the official endpoint when not configured.
 */
export function getBaseUrl(): string {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return config.get<string>('baseUrl') || DEFAULT_BASE_URL;
}

/**
 * Resolve the API model ID to send to the endpoint.
 *
 * Users can override model IDs via the `modelIdOverrides` setting object
 * (e.g. for self-hosted mirrors that rename the model). Falls back to the
 * VS Code model ID when no override is configured.
 */
export function getApiModelId(vscodeModelId: string): string {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const overrides = config.get<Record<string, string>>('modelIdOverrides');
	const override = overrides?.[vscodeModelId]?.trim();
	return override || vscodeModelId;
}

/**
 * Models the user wants hidden from the picker (matched on VS Code model id).
 */
export function getModelBlacklist(): string[] {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return config.get<string[]>('modelBlacklist') ?? [];
}

/**
 * Get the configured max output tokens limit.
 * Returns `undefined` when set to 0 (API default — no limit).
 */
export function getMaxTokens(): number | undefined {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const value = config.get<number>('maxTokens', 0);
	return value > 0 ? value : undefined;
}

/**
 * Override the context window reported to Copilot. 0 means "use the model's
 * default". Useful when self-hosted mirrors serve a model with a smaller
 * context than the upstream registry claims.
 */
export function getMaxContextTokensOverride(): number {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return config.get<number>('maxContextTokens', 0);
}

/**
 * Whether to attach the `x-cmdc-zdr: 1` header on every request.
 */
export function getZdrEnabled(): boolean {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	return config.get<boolean>('zdr', false);
}

export function getDebugMode(): DebugMode {
	const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
	const mode = config.get<string>('debugMode');
	if (mode === 'minimal' || mode === 'metadata' || mode === 'verbose') {
		return mode;
	}
	return 'minimal';
}

export function getDebugLoggingEnabled(): boolean {
	return getDebugMode() !== 'minimal';
}
