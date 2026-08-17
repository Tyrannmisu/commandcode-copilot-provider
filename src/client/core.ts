import type { CancellationToken } from 'vscode';
import { logger } from '../logger';
import { normalizeBaseUrl } from '../endpoint';
import { safeStringify } from '../json';
import type {
	ApiModelsResponse,
	ChatRequest,
	ChatStreamChunk,
	ChatToolCall,
	ChatUsage,
	StreamCallbacks,
} from '../types';
import { createHttpError, formatRequestError, normalizeRequestError } from './error';

export interface ClientOptions {
	/** Optional extra headers attached to every request (e.g. `x-cmdc-zdr: 1`). */
	extraHeaders?: Record<string, string>;
	/** Surface non-fatal request metadata in logs. */
	debug?: boolean;
}

const ZDR_HEADER_NAME = 'x-cmdc-zdr';
const ZDR_HEADER_VALUE = '1';

/**
 * Lightweight OpenAI-compatible streaming client for the Command Code
 * Provider API. Uses Node's built-in `fetch` — no external dependencies.
 */
export class CommandCodeClient {
	private readonly baseUrl: string;
	private readonly apiKey: string;
	private readonly options: ClientOptions;

	constructor(baseUrl: string, apiKey: string, options: ClientOptions = {}) {
		this.baseUrl = normalizeBaseUrl(baseUrl);
		this.apiKey = apiKey;
		this.options = options;
	}

	/**
	 * Stream a chat completion from the Command Code API.
	 *
	 * Parses SSE chunks and dispatches callbacks for content, thinking, and
	 * tool calls. The Command Code API is OpenAI-compatible, so we re-use the
	 * OpenAI streaming shape (`choices[0].delta.content` /
	 * `choices[0].delta.reasoning_content`).
	 */
	async streamChatCompletion(
		request: ChatRequest,
		callbacks: StreamCallbacks,
		cancellationToken?: CancellationToken,
	): Promise<void> {
		const controller = new AbortController();
		const cancelListener = cancellationToken?.onCancellationRequested(() => {
			controller.abort();
		});
		if (cancellationToken?.isCancellationRequested) {
			controller.abort();
		}

		const url = `${this.baseUrl}/chat/completions`;
		const headers = this.buildHeaders();

		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: safeStringify({
					...request,
					stream_options: { include_usage: true },
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw await createHttpError(response, {
					baseUrl: this.baseUrl,
					request,
				});
			}

			if (!response.body) {
				throw new Error('No response body received');
			}

			await this.consumeStream(response.body, callbacks, request, cancellationToken, controller);
		} catch (error) {
			if (isAbortError(error) && cancellationToken?.isCancellationRequested) {
				return;
			}
			const normalized = normalizeRequestError(error, {
				baseUrl: this.baseUrl,
				request,
			});
			if (this.options.debug) {
				logger.error('Command Code request failed:', formatRequestError(normalized));
			}
			callbacks.onError(normalized);
		} finally {
			cancelListener?.dispose();
		}
	}

	/**
	 * Fetch the live model catalog. Used to confirm the upstream registry
	 * matches our local `MODELS` list.
	 */
	async listModels(cancellationToken?: CancellationToken): Promise<ApiModelsResponse> {
		const controller = new AbortController();
		const cancelListener = cancellationToken?.onCancellationRequested(() => {
			controller.abort();
		});

		try {
			const response = await fetch(`${this.baseUrl}/models`, {
				method: 'GET',
				headers: this.buildHeaders(),
				signal: controller.signal,
			});
			if (!response.ok) {
				throw await createHttpError(response, { baseUrl: this.baseUrl });
			}
			const json = (await response.json()) as ApiModelsResponse;
			return json ?? {};
		} catch (error) {
			if (isAbortError(error) && cancellationToken?.isCancellationRequested) {
				return {};
			}
			throw normalizeRequestError(error, { baseUrl: this.baseUrl });
		} finally {
			cancelListener?.dispose();
		}
	}

	private buildHeaders(): Record<string, string> {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${this.apiKey}`,
		};
		if (this.options.extraHeaders) {
			Object.assign(headers, this.options.extraHeaders);
		}
		return headers;
	}

	private async consumeStream(
		body: ReadableStream<Uint8Array>,
		callbacks: StreamCallbacks,
		request: ChatRequest,
		cancellationToken: CancellationToken | undefined,
		controller: AbortController,
	): Promise<void> {
		const reader = body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let latestUsage: ChatUsage | undefined;

		const pendingToolCalls = new Map<number, ChatToolCall>();

		try {
			while (true) {
				if (cancellationToken?.isCancellationRequested) {
					controller.abort();
					return;
				}

				const { done, value } = await reader.read();
				if (done) {
					break;
				}

				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split('\n');
				buffer = lines.pop() || '';

				for (const line of lines) {
					const trimmed = line.trim();

					if (!trimmed || trimmed.startsWith(':')) {
						continue;
					}

					if (trimmed === 'data: [DONE]') {
						flushToolCalls(pendingToolCalls, callbacks);
						reportFinalUsage(callbacks, latestUsage);
						callbacks.onDone();
						return;
					}

					if (!trimmed.startsWith('data: ')) {
						continue;
					}

					const jsonStr = trimmed.slice(6);
					try {
						const chunk: ChatStreamChunk = JSON.parse(jsonStr);
						const choice = chunk.choices?.[0];

						if (chunk.usage) {
							latestUsage = chunk.usage;
						}

						if (!choice) {
							continue;
						}

						const reasoning = choice.delta.reasoning_content;
						if (reasoning) {
							callbacks.onThinking(reasoning);
						}

						if (choice.delta.content) {
							callbacks.onContent(choice.delta.content);
						}

						if (choice.delta.tool_calls) {
							accumulateToolCalls(pendingToolCalls, choice.delta.tool_calls);
						}

						if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
							flushToolCalls(pendingToolCalls, callbacks);
						}
					} catch (parseError) {
						if (this.options.debug) {
							logger.warn(`Failed to parse SSE chunk: ${jsonStr.slice(0, 200)}`, parseError);
						}
					}
				}
			}

			reportFinalUsage(callbacks, latestUsage);
			callbacks.onDone();
		} catch (error) {
			if (isAbortError(error) && cancellationToken?.isCancellationRequested) {
				return;
			}
			const normalized = normalizeRequestError(error, {
				baseUrl: this.baseUrl,
				request,
			});
			if (this.options.debug) {
				logger.error('Command Code stream failed:', formatRequestError(normalized));
			}
			callbacks.onError(normalized);
		}
	}
}

/** Header key/value pair attached to every Command Code request. */
export const ZDR_HEADER: Record<string, string> = {
	[ZDR_HEADER_NAME]: ZDR_HEADER_VALUE,
};

function reportFinalUsage(callbacks: StreamCallbacks, usage: ChatUsage | undefined): void {
	if (!usage || !callbacks.onUsage) {
		return;
	}
	callbacks.onUsage(usage);
}

function accumulateToolCalls(
	pending: Map<number, ChatToolCall>,
	deltaCalls: NonNullable<NonNullable<ChatStreamChunk['choices']>[number]['delta']['tool_calls']>,
): void {
	for (const tc of deltaCalls) {
		let entry = pending.get(tc.index);
		if (!entry && tc.id) {
			entry = {
				id: tc.id,
				type: 'function',
				function: { name: '', arguments: '' },
			};
			pending.set(tc.index, entry);
		}
		if (entry) {
			if (tc.function?.name) {
				entry.function.name += tc.function.name;
			}
			if (tc.function?.arguments) {
				entry.function.arguments += tc.function.arguments;
			}
		}
	}
}

function flushToolCalls(pending: Map<number, ChatToolCall>, callbacks: StreamCallbacks): void {
	for (const tc of pending.values()) {
		callbacks.onToolCall(tc);
	}
	pending.clear();
}

function isAbortError(error: unknown): boolean {
	return error instanceof Error && error.name === 'AbortError';
}
