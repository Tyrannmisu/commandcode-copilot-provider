import vscode from 'vscode';
import { t } from '../i18n';
import type {
	ModelDefinition,
	ReasoningEffort,
	ThinkingCapability,
	ThinkingEffort,
} from '../types';
import { getMaxContextTokensOverride } from '../config';

/**
 * Non-public Copilot Chat API surface.
 *
 * `isBYOK`, `isUserSelectable`, `statusIcon`, and `configurationSchema` are
 * not yet in `@types/vscode` — they are the same shape currently consumed
 * by GitHub Copilot Chat to render model-picker metadata and per-model
 * configuration controls. The fields are exposed here so the extension can
 * continue to work against the proposed API surface.
 */
export type ModelConfigurationOptions = vscode.ProvideLanguageModelChatResponseOptions & {
	readonly modelConfiguration?: Record<string, unknown>;
	readonly configuration?: Record<string, unknown>;
};

type ThinkingEffortConfigurationSchema = ReturnType<typeof buildThinkingEffortSchema>;

export type ModelPickerChatInformation = vscode.LanguageModelChatInformation & {
	readonly isUserSelectable: boolean;
	readonly isBYOK: true;
	readonly statusIcon?: vscode.ThemeIcon;
	readonly configurationSchema?: ThinkingEffortConfigurationSchema;
};

export function toChatInfo(
	m: ModelDefinition,
	hasApiKey: boolean,
	liveContextLength?: number,
): ModelPickerChatInformation {
	const thinkingCapability = m.capabilities.thinking;
	const contextOverride = getMaxContextTokensOverride();

	// Precedence for the input window reported to Copilot:
	//   1. explicit `maxContextTokens` setting,
	//   2. live `context_length` from the provider API (total window minus
	//      the output reserved for generation),
	//   3. the static registry value as a fallback.
	let maxInputTokens = m.maxInputTokens;
	if (contextOverride > 0) {
		maxInputTokens = contextOverride;
	} else if (typeof liveContextLength === 'number' && liveContextLength > m.maxOutputTokens) {
		maxInputTokens = liveContextLength - m.maxOutputTokens;
	}

	return {
		id: m.id,
		name: m.name,
		family: m.family,
		version: m.version,
		detail: hasApiKey ? m.detail : t('auth.apiKeyRequiredDetail'),
		tooltip: hasApiKey ? m.detail : t('auth.apiKeyRequiredDetail'),
		statusIcon: hasApiKey ? undefined : new vscode.ThemeIcon('warning'),
		maxInputTokens,
		maxOutputTokens: m.maxOutputTokens,
		isBYOK: true,
		isUserSelectable: true,
		capabilities: {
			toolCalling: m.capabilities.toolCalling,
			imageInput: m.capabilities.imageInput,
		},
		...(thinkingCapability
			? { configurationSchema: buildThinkingEffortSchema(thinkingCapability) }
			: {}),
	};
}

export function getConfiguredThinkingEffort(
	options: ModelConfigurationOptions,
	thinkingCapability: ThinkingCapability,
): ThinkingEffort {
	const configuredEffort =
		options.modelConfiguration?.reasoningEffort ?? options.configuration?.reasoningEffort;

	if (configuredEffort === 'none' && thinkingCapability.canDisable) {
		return 'none';
	}

	if (isSupportedReasoningEffort(configuredEffort, thinkingCapability)) {
		return configuredEffort;
	}

	return thinkingCapability.defaultEffort;
}

function buildThinkingEffortSchema(thinkingCapability: ThinkingCapability) {
	const efforts: ThinkingEffort[] = [
		...(thinkingCapability.canDisable ? (['none'] as const) : []),
		...thinkingCapability.supportedEfforts,
	];

	return {
		properties: {
			reasoningEffort: {
				type: 'string',
				title: t('status.thinking'),
				enum: efforts,
				enumItemLabels: efforts.map((effort) => t(`thinking.${effort}`)),
				enumDescriptions: efforts.map((effort) => t(`thinking.${effort}.desc`)),
				default: thinkingCapability.defaultEffort,
				group: 'navigation',
			},
		},
	} as const;
}

function isSupportedReasoningEffort(
	value: unknown,
	thinkingCapability: ThinkingCapability,
): value is ReasoningEffort {
	return thinkingCapability.supportedEfforts.some((effort) => effort === value);
}
