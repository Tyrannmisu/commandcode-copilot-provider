import vscode from 'vscode';
import { t } from '../i18n';
import type {
	ModelDefinition,
	ReasoningEffort,
	ThinkingCapability,
	ThinkingEffort,
} from '../types';
import { getMaxContextTokensOverride, resolveModelDetailStyle } from '../config';

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
		detail: hasApiKey ? formatModelDetail(m) : t('auth.apiKeyRequiredDetail'),
		tooltip: hasApiKey ? formatModelTooltip(m) : t('auth.apiKeyRequiredDetail'),
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

/**
 * Build the text rendered alongside the model name in the Copilot Chat
 * picker. On Linux the picker lays `name` and `detail` out on a single line
 * and gives the detail most of the width, so the long marketing sentence in
 * `ModelDefinition.detail` collapses the name to a few characters.
 *
 * The `modelDetailStyle` setting controls what ends up here:
 *   - `full`    → the full description (current behavior)
 *   - `compact` → short capability summary such as "Vision · Thinking"
 *   - `hidden`  → no inline text (name only); the full text stays in the tooltip
 *   - `auto`    → `compact` on Linux, `full` elsewhere
 */
function formatModelDetail(m: ModelDefinition): string {
	const style = resolveModelDetailStyle();
	if (style === 'hidden') {
		return '';
	}
	if (style === 'full') {
		return m.detail;
	}

	const parts: string[] = [];
	if (m.capabilities.imageInput) {
		parts.push(t('capability.vision'));
	}
	if (m.capabilities.thinking) {
		parts.push(t('capability.thinking'));
	}
	return parts.join(' · ');
}

/**
 * Build the hover tooltip card shown by Copilot Chat's model picker.
 *
 * Besides the marketing `detail` sentence it lists the model's capabilities
 * (Vision · Reasoning) so users can see at a glance what the model supports.
 * For models auto-discovered from the live catalog the upstream model id is
 * appended — fetched entries can share a display name with a maintained one
 * (e.g. `MiniMaxAI/MiniMax-M3` vs `minimax/minimax-m3-free`), so the id
 * makes them distinguishable.
 */
function formatModelTooltip(m: ModelDefinition): string {
	const lines: string[] = [m.detail];

	const capabilities: string[] = [];
	if (m.capabilities.imageInput) {
		capabilities.push(t('capability.vision'));
	}
	if (m.capabilities.thinking) {
		capabilities.push(t('capability.reasoning'));
	}
	if (capabilities.length > 0) {
		lines.push(`${t('tooltip.capabilities')}: ${capabilities.join(' · ')}`);
	}

	if (m.fetched) {
		lines.push(`${t('tooltip.modelId')}: ${m.id}`);
	}

	return lines.join('\n\n');
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
