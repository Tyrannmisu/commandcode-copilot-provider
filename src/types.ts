/**
 * Shared types for the Command Code Copilot extension.
 */

// ---- API request/response types ----

/**
 * Reasoning effort values supported by the picker.
 *
 * `none` means "do not send any reasoning parameters" — the model runs in its
 * default non-thinking mode. `low` / `medium` / `high` map directly onto the
 * OpenAI-compatible `reasoning_effort` field for models that advertise
 * reasoning capability.
 */
export type ReasoningEffort = 'low' | 'medium' | 'high';

export type ThinkingEffort = 'none' | ReasoningEffort;

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
	role: ChatRole;
	/** Text content of the message. May be empty for tool/assistant turns. */
	content: string;
	tool_call_id?: string;
	tool_calls?: ChatToolCall[];
	reasoning_content?: string;
	/** Optional multimodal content for user messages (vision input). */
	parts?: ChatMessagePart[];
}

export interface ChatMessagePart {
	type: 'text' | 'image_url';
	text?: string;
	image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface ChatToolCall {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
}

export interface ChatTool {
	type: 'function';
	function: {
		name: string;
		description?: string;
		parameters?: Record<string, unknown>;
	};
}

export interface ChatUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
	prompt_cache_hit_tokens?: number;
	prompt_cache_miss_tokens?: number;
}

export interface ChatRequest {
	model: string;
	messages: ChatMessage[];
	stream: boolean;
	temperature?: number;
	top_p?: number;
	max_tokens?: number;
	tools?: ChatTool[];
	tool_choice?: 'none' | 'auto' | 'required';
	/** Provider-specific reasoning knobs (only attached when thinking is enabled). */
	reasoning_effort?: ReasoningEffort;
	stream_options?: {
		include_usage: boolean;
	};
}

export interface ChatStreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: {
			role?: string;
			content?: string;
			reasoning_content?: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				type?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
		finish_reason: string | null;
	}>;
	usage?: ChatUsage;
}

// ---- Stream callbacks ----

export interface StreamCallbacks {
	onContent: (content: string) => void;
	onThinking: (text: string) => void;
	onToolCall: (toolCall: ChatToolCall) => void;
	onError: (error: Error) => void;
	onDone: () => void;
	onUsage?: (usage: ChatUsage) => void;
}

// ---- Model registry ----

export interface ThinkingCapability {
	/** Effort values that appear in the model picker dropdown. */
	supportedEfforts: readonly ReasoningEffort[];
	defaultEffort: ReasoningEffort;
	/** When true, `none` is offered alongside the configured efforts. */
	canDisable: boolean;
}

export interface ModelDefinition {
	id: string;
	name: string;
	family: string;
	version: string;
	detail: string;
	maxInputTokens: number;
	maxOutputTokens: number;
	capabilities: {
		toolCalling: boolean | number;
		imageInput: boolean;
		thinking: ThinkingCapability | false;
	};
	/** Optional category used to group models in logs/UI. */
	category?: string;
}

export interface ApiModelInfo {
	id: string;
	owned_by?: string;
	/**
	 * Capability hints derived from the model registry. The upstream `/models`
	 * response is not yet guaranteed to include this — we infer it when known.
	 */
	capabilities?: {
		toolCalling?: boolean | number;
		imageInput?: boolean;
		thinking?: ThinkingCapability | false;
	};
}

/**
 * Raw shape returned by `GET /provider/v1/models`. We only consume `data`,
 * but keep the envelope so future fields (e.g. pagination) can be added
 * without changing the parser signature.
 */
export interface ApiModelsResponse {
	data?: ApiModelInfo[];
}
