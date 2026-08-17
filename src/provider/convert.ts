import vscode from 'vscode';
import { safeStringify } from '../json';
import type { ChatMessage, ChatMessagePart, ChatTool, ChatToolCall } from '../types';

/**
 * Convert VS Code chat messages to OpenAI-compatible format. Images are
 * emitted as multimodal `content` arrays for vision-capable models and as
 * plain text otherwise (matching the upstream behavior).
 */
export function convertMessages(
	messages: readonly vscode.LanguageModelChatRequestMessage[],
	options: { imageInput: boolean },
): ChatMessage[] {
	const result: ChatMessage[] = [];

	for (const message of messages) {
		const role = mapRole(message.role);

		const textSegments: string[] = [];
		const imageSegments: ChatMessagePart[] = [];
		let thinkingContent = '';
		const toolCalls: ChatToolCall[] = [];
		const toolResults: Array<{ callId: string; content: string }> = [];

		for (const part of message.content) {
			if (part instanceof vscode.LanguageModelTextPart) {
				textSegments.push(part.value);
			} else if (isLanguageModelThinkingPart(part)) {
				thinkingContent += normalizeThinkingPartText(part.value);
			} else if (part instanceof vscode.LanguageModelToolCallPart) {
				toolCalls.push({
					id: part.callId,
					type: 'function',
					function: {
						name: part.name,
						arguments: safeStringify(part.input),
					},
				});
			} else if (part instanceof vscode.LanguageModelToolResultPart) {
				let toolContent = '';
				for (const item of part.content) {
					if (item instanceof vscode.LanguageModelTextPart) {
						toolContent += item.value;
					}
				}
				toolResults.push({
					callId: part.callId,
					content: toolContent || safeStringify(part.content),
				});
			} else if (part instanceof vscode.LanguageModelDataPart) {
				if (options.imageInput && part.mimeType.startsWith('image/')) {
					const url = `data:${part.mimeType};base64,${encodeBase64(part.data)}`;
					imageSegments.push({
						type: 'image_url',
						image_url: { url, detail: 'auto' },
					});
				}
				// Non-image data parts are intentionally ignored — the upstream
				// API only accepts text + image_url parts.
			}
		}

		const text = textSegments.join('');

		if (role === 'assistant') {
			if (text || toolCalls.length > 0) {
				const msg: ChatMessage = {
					role: 'assistant',
					content: text,
				};
				if (toolCalls.length > 0) {
					msg.tool_calls = toolCalls;
				}
				if (thinkingContent) {
					msg.reasoning_content = thinkingContent;
				}
				result.push(msg);
			}
		} else if (role === 'user') {
			if (text || imageSegments.length > 0) {
				if (imageSegments.length > 0 && options.imageInput) {
					const parts: ChatMessagePart[] = [];
					if (text) {
						parts.push({ type: 'text', text });
					}
					parts.push(...imageSegments);
					result.push({
						role: 'user',
						content: text,
						parts,
					});
				} else {
					result.push({ role: 'user', content: text });
				}
			}
		} else {
			// system / unknown roles — pass through as text
			if (text) {
				result.push({ role: 'user', content: text });
			}
		}

		for (const tr of toolResults) {
			result.push({
				role: 'tool',
				content: tr.content,
				tool_call_id: tr.callId,
			});
		}
	}

	return result;
}

function encodeBase64(bytes: Uint8Array): string {
	if (typeof Buffer !== 'undefined') {
		return Buffer.from(bytes).toString('base64');
	}
	let binary = '';
	for (let i = 0; i < bytes.length; i += 1) {
		binary += String.fromCharCode(bytes[i]!);
	}
	// btoa is available in the extension host
	return btoa(binary);
}

function isLanguageModelThinkingPart(part: unknown): part is vscode.LanguageModelThinkingPart {
	return (
		typeof vscode.LanguageModelThinkingPart === 'function' &&
		part instanceof vscode.LanguageModelThinkingPart
	);
}

function normalizeThinkingPartText(value: string | string[]): string {
	return Array.isArray(value) ? value.join('') : value;
}

function mapRole(role: vscode.LanguageModelChatMessageRole): 'user' | 'assistant' {
	switch (role) {
		case vscode.LanguageModelChatMessageRole.User:
			return 'user';
		case vscode.LanguageModelChatMessageRole.Assistant:
			return 'assistant';
		default:
			return 'user';
	}
}

/**
 * Convert VS Code tool definitions to the OpenAI `tools` payload.
 */
export function convertTools(
	tools: readonly vscode.LanguageModelChatTool[] | undefined,
): ChatTool[] | undefined {
	if (!tools || tools.length === 0) {
		return undefined;
	}

	return tools.map((tool) => ({
		type: 'function' as const,
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.inputSchema as Record<string, unknown> | undefined,
		},
	}));
}

/**
 * Sum character counts across all messages so we can calibrate the
 * chars-per-token ratio when usage stats are reported back from the API.
 */
export function countMessageChars(messages: ChatMessage[]): number {
	let total = 0;
	for (const msg of messages) {
		total += msg.content?.length ?? 0;
		total += msg.reasoning_content?.length ?? 0;
		if (msg.parts) {
			for (const part of msg.parts) {
				if (part.text) {
					total += part.text.length;
				}
			}
		}
		if (msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				total += tc.function?.name?.length ?? 0;
				total += tc.function?.arguments?.length ?? 0;
			}
		}
	}
	return total;
}
