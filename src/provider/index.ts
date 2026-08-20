import vscode from 'vscode';
import { AuthManager } from '../auth';
import { t } from '../i18n';
import { logger } from '../logger';
import { MODELS } from '../models';
import { getLiveCatalog, liveModelToDefinition, type LiveModelInfo } from './catalog';
import { toChatInfo } from './models';
import type { ModelDefinition } from '../types';
import { prepareChatRequest } from './request';
import { streamChatCompletion } from './stream';
import { estimateTokenCount } from './tokens';

const PROVIDER_VENDOR = 'commandcode';

/**
 * Command Code Chat Provider — implements `vscode.LanguageModelChatProvider`
 * so Command Code Provider models appear directly in the Copilot Chat
 * model picker.
 */
export class CommandCodeChatProvider implements vscode.LanguageModelChatProvider {
	private readonly authManager: AuthManager;
	private readonly globalState: vscode.Memento;
	private readonly onDidChangeLanguageModelChatInformationEmitter = new vscode.EventEmitter<void>();
	private isActive = true;
	private modelById = new Map(MODELS.map((m) => [m.id, m]));
	/** Set when the user explicitly asks to re-sync the live catalog. */
	private catalogSyncRequested = false;

	readonly onDidChangeLanguageModelChatInformation =
		this.onDidChangeLanguageModelChatInformationEmitter.event;

	/**
	 * Adaptive chars-per-token ratio, calibrated from real usage data via an
	 * exponential moving average each time the API reports token counts.
	 */
	private charsPerToken = 4.0;

	constructor(context: vscode.ExtensionContext) {
		this.authManager = new AuthManager(context);
		this.globalState = context.globalState;

		context.subscriptions.push(
			this.onDidChangeLanguageModelChatInformationEmitter,
			// Settings-based API key + base URL changes.
			vscode.workspace.onDidChangeConfiguration((e) => {
				if (
					e.affectsConfiguration('commandcode-copilot.apiKey') ||
					e.affectsConfiguration('commandcode-copilot.baseUrl') ||
					e.affectsConfiguration('commandcode-copilot.modelBlacklist') ||
					e.affectsConfiguration('commandcode-copilot.modelDetailStyle') ||
					e.affectsConfiguration('commandcode-copilot.modelIdOverrides') ||
					e.affectsConfiguration('commandcode-copilot.maxContextTokens')
				) {
					this.refreshModelPicker();
				}
			}),
			// Multi-window: SecretStorage changes don't fire onDidChangeConfiguration.
			context.secrets.onDidChange((e) => {
				if (e.key === 'commandcode-copilot.apiKey') {
					this.refreshModelPicker();
				}
			}),
		);
	}

	// ---- Public commands ----

	async configureApiKey(): Promise<void> {
		const saved = await this.authManager.promptForApiKey();
		if (saved) {
			this.refreshModelPicker();
		}
	}

	async clearApiKey(): Promise<void> {
		await this.authManager.deleteApiKey();
		this.refreshModelPicker();
		vscode.window.showInformationMessage(t('auth.removed'));
	}

	async hasApiKey(): Promise<boolean> {
		return this.authManager.hasApiKey();
	}

	/**
	 * Force Copilot Chat to re-query model information.
	 *
	 * @param forceCatalogSync When true (the "Command Code: Refresh Models"
	 * command), the next picker load re-fetches the live catalog from the API.
	 * Otherwise only persisted data is used — no network traffic.
	 */
	refreshModelPicker(forceCatalogSync = false): void {
		this.catalogSyncRequested = this.catalogSyncRequested || forceCatalogSync;
		this.onDidChangeLanguageModelChatInformationEmitter.fire();
	}

	async prepareForDeactivate(): Promise<void> {
		this.isActive = false;
		this.onDidChangeLanguageModelChatInformationEmitter.fire();

		// Trigger one final sync pull so the picker drops our entries immediately
		// instead of waiting for the host to invalidate its cache. With
		// `isActive = false` we return [], which makes Copilot Chat drop
		// Command Code models from the picker immediately on deactivate.
		try {
			await vscode.lm.selectChatModels({ vendor: PROVIDER_VENDOR });
		} catch (error) {
			logger.warn('Failed to refresh Command Code models during deactivate', error);
		}
	}

	// ---- LanguageModelChatProvider ----

	async provideLanguageModelChatInformation(
		_options: vscode.PrepareLanguageModelChatModelOptions,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelChatInformation[]> {
		if (!this.isActive) {
			return [];
		}

		const hasKey = await this.authManager.hasApiKey();
		const { getModelBlacklist } = await import('../config');
		const blacklist = new Set(getModelBlacklist());

		// Live catalog (context windows + names), persisted across sessions
		// and refreshed only on first run or explicit user action. It drives
		// context overrides for known models and auto-discovers new ones.
		const forceSync = this.catalogSyncRequested;
		this.catalogSyncRequested = false;
		const liveCatalog = hasKey
			? await getLiveCatalog(this.globalState, this.authManager, token, forceSync)
			: new Map<string, LiveModelInfo>();

		// Auto-discover models the provider API serves but the static registry
		// doesn't know about yet. They're marked "(fetched)" and merged into
		// `modelById` so chat requests resolve their capabilities.
		const knownIds = new Set(MODELS.map((m) => m.id));
		const fetchedModels: ModelDefinition[] = [];
		for (const [id, info] of liveCatalog) {
			if (!knownIds.has(id) && !blacklist.has(id)) {
				const definition = liveModelToDefinition(id, info);
				fetchedModels.push(definition);
				this.modelById.set(id, definition);
			}
		}

		return [...MODELS, ...fetchedModels]
			.filter((m) => !blacklist.has(m.id))
			.map((m) => toChatInfo(m, hasKey, liveCatalog.get(m.id)?.contextLength));
	}

	async provideLanguageModelChatResponse(
		modelInfo: vscode.LanguageModelChatInformation,
		messages: readonly vscode.LanguageModelChatRequestMessage[],
		options: vscode.ProvideLanguageModelChatResponseOptions,
		progress: vscode.Progress<vscode.LanguageModelResponsePart>,
		token: vscode.CancellationToken,
	): Promise<void> {
		const modelDefinition = this.modelById.get(modelInfo.id);

		const prepared = await prepareChatRequest({
			authManager: this.authManager,
			modelInfo,
			modelDefinition,
			messages,
			options,
			token,
		});

		return streamChatCompletion({
			prepared,
			progress,
			token,
			getCharsPerToken: () => this.charsPerToken,
			setCharsPerToken: (charsPerToken) => {
				this.charsPerToken = charsPerToken;
			},
		});
	}

	async provideTokenCount(
		_modelInfo: vscode.LanguageModelChatInformation,
		text: string | vscode.LanguageModelChatRequestMessage,
		_token: vscode.CancellationToken,
	): Promise<number> {
		return estimateTokenCount(text, this.charsPerToken);
	}
}

export { PROVIDER_VENDOR };
