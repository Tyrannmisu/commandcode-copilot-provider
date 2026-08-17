import vscode from 'vscode';
import { AuthManager } from '../auth';
import { CommandCodeClient, ZDR_HEADER } from '../client';
import { getApiModelId, getBaseUrl, getMaxTokens, getZdrEnabled } from '../config';
import { TOOLS_LIMIT } from '../consts';
import { t } from '../i18n';
import { logger } from '../logger';
import type { ChatRequest, ReasoningEffort } from '../types';
import { convertMessages, convertTools, countMessageChars } from './convert';
import { getConfiguredThinkingEffort, type ModelConfigurationOptions } from './models';

export interface PreparedChatRequest {
	client: CommandCodeClient;
	request: ChatRequest;
	totalRequestChars: number;
	isThinkingModel: boolean;
	thinkingEffort: 'none' | ReasoningEffort;
}

export interface PrepareChatRequestOptions {
	authManager: AuthManager;
	modelInfo: vscode.LanguageModelChatInformation;
	modelDefinition: import('../types').ModelDefinition | undefined;
	messages: readonly vscode.LanguageModelChatRequestMessage[];
	options: vscode.ProvideLanguageModelChatResponseOptions;
	token: vscode.CancellationToken;
}

export async function prepareChatRequest({
	authManager,
	modelInfo,
	modelDefinition,
	messages,
	options,
	token: _token,
}: PrepareChatRequestOptions): Promise<PreparedChatRequest> {
	const apiKey = await authManager.getApiKey();
	if (!apiKey) {
		throw new Error(t('auth.notConfigured'));
	}

	const baseUrl = getBaseUrl();
	const extraHeaders = getZdrEnabled() ? ZDR_HEADER : undefined;
	const client = new CommandCodeClient(baseUrl, apiKey, { extraHeaders });

	const thinkingCapability = modelDefinition?.capabilities.thinking;
	const isThinkingModel = Boolean(thinkingCapability);
	const imageInput = Boolean(modelDefinition?.capabilities.imageInput);
	const maxTokens = getMaxTokens();

	const chatMessages = convertMessages(messages, { imageInput });
	const tools = prepareTools(modelDefinition?.capabilities.toolCalling, options);

	const totalRequestChars = countMessageChars(chatMessages);
	const baseRequest: ChatRequest = {
		model: getApiModelId(modelInfo.id),
		messages: chatMessages,
		stream: true,
		tools,
		tool_choice: tools && tools.length > 0 ? ('auto' as const) : undefined,
		max_tokens: maxTokens,
	};

	const thinkingEffort: 'none' | ReasoningEffort = thinkingCapability
		? getConfiguredThinkingEffort(options as ModelConfigurationOptions, thinkingCapability)
		: 'none';

	const request: ChatRequest = {
		...baseRequest,
		// Attach `reasoning_effort` only when thinking is enabled. `none`
		// intentionally omits the field so the upstream model uses its
		// default (non-thinking) behavior.
		...(isThinkingModel && thinkingEffort !== 'none' ? { reasoning_effort: thinkingEffort } : {}),
	};

	logger.debug(
		`Prepared request: model=${request.model} messages=${chatMessages.length} tools=${tools?.length ?? 0} thinking=${thinkingEffort}`,
	);

	return {
		client,
		request,
		totalRequestChars,
		isThinkingModel,
		thinkingEffort,
	};
}

function prepareTools(
	toolCallingCapability: boolean | number | undefined,
	options: vscode.ProvideLanguageModelChatResponseOptions,
): ChatRequest['tools'] {
	if (!toolCallingCapability) {
		return undefined;
	}
	const tools = convertTools(options.tools);
	const limit = typeof toolCallingCapability === 'number' ? toolCallingCapability : TOOLS_LIMIT;
	const count = tools?.length ?? 0;
	if (count > limit) {
		throw new Error(t('request.toolsLimitExceeded', limit, count));
	}
	return tools;
}
