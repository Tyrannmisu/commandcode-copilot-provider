import vscode from 'vscode';

const IMAGE_PART_ESTIMATED_CHARS = 1020;

/**
 * Estimate the character count for a single content part.
 *
 * Returns a character count, which the caller divides by `charsPerToken` to
 * derive a token estimate. Heuristic only — Copilot Chat calls this for UI
 * progress meters, not for billing.
 */
function estimatePartChars(part: unknown): number {
	if (part instanceof vscode.LanguageModelTextPart) {
		return part.value.length;
	}

	if (part instanceof vscode.LanguageModelToolCallPart) {
		let chars = part.callId.length + part.name.length;
		try {
			chars += JSON.stringify(part.input).length;
		} catch {
			chars += 2;
		}
		return chars;
	}

	if (part instanceof vscode.LanguageModelToolResultPart) {
		let chars = part.callId.length;
		if (Array.isArray(part.content)) {
			for (const item of part.content) {
				chars += estimatePartChars(item);
			}
		}
		return chars;
	}

	if (part instanceof vscode.LanguageModelDataPart) {
		const mime = part.mimeType;
		if (mime.startsWith('image/')) {
			return IMAGE_PART_ESTIMATED_CHARS;
		}
		return Math.min(part.data?.byteLength ?? 0, 10000);
	}

	if (
		typeof vscode.LanguageModelThinkingPart === 'function' &&
		part instanceof vscode.LanguageModelThinkingPart
	) {
		if (typeof part.value === 'string') {
			return part.value.length;
		}
		if (Array.isArray(part.value)) {
			let chars = 0;
			for (const s of part.value) {
				chars += s.length;
			}
			return chars;
		}
		return 0;
	}

	if (part && typeof part === 'object') {
		try {
			return JSON.stringify(part).length;
		} catch {
			return 0;
		}
	}

	return 0;
}

function estimateMessageChars(message: vscode.LanguageModelChatRequestMessage | string): number {
	if (typeof message === 'string') {
		return message.length;
	}

	let chars = 0;
	for (const part of message.content) {
		chars += estimatePartChars(part);
	}
	return chars;
}

/**
 * Estimate a token count for a string or single chat message.
 */
export function estimateTokenCount(
	text: string | vscode.LanguageModelChatRequestMessage,
	charsPerToken: number,
): number {
	const chars = estimateMessageChars(text);
	if (charsPerToken <= 0) {
		return Math.ceil(chars / 4);
	}
	return Math.ceil(chars / charsPerToken);
}
