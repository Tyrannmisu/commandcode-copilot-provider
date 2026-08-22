import { EXTERNAL_URLS } from '../../consts';
import { t } from '../../i18n';
import { safeStringify } from '../../json';
import { API_PROVIDER_HTTP_ERROR_LINKS, MAX_DIAGNOSTIC_FIELD_LENGTH } from '../consts';
import { getNetworkErrorCauseInfo, getNetworkErrorCode, getNetworkErrorMessage } from './network';
import type {
	CommandCodeRequestErrorKind,
	ErrorActionLink,
	ErrorActionUrls,
	RequestErrorContext,
} from '../types';

export type { CommandCodeRequestErrorKind, ErrorActionUrls } from '../types';

const errorActionUrlStore = (() => {
	let current: ErrorActionUrls = {
		createApiKey: EXTERNAL_URLS.commandcode.apiKeys,
	};

	return {
		get: () => current,
		set: (key: keyof ErrorActionUrls, url: string) => {
			current = { ...current, [key]: url };
		},
	};
})();

export function setErrorActionUrl(key: keyof ErrorActionUrls, url: string): void {
	errorActionUrlStore.set(key, url);
}

export class CommandCodeRequestError extends Error {
	readonly kind: CommandCodeRequestErrorKind;
	readonly userSummary: string;
	readonly diagnosticMessage: string;
	readonly baseUrl?: string;
	readonly status?: number;
	readonly code?: string;

	constructor(options: {
		message: string;
		userSummary?: string;
		kind: CommandCodeRequestErrorKind;
		diagnosticMessage?: string;
		baseUrl?: string;
		status?: number;
		code?: string;
		cause?: unknown;
	}) {
		super(options.message, { cause: options.cause });
		this.name = 'CommandCodeRequestError';
		this.kind = options.kind;
		this.userSummary = options.userSummary ?? options.message;
		this.diagnosticMessage = options.diagnosticMessage ?? options.message;
		this.baseUrl = options.baseUrl;
		this.status = options.status;
		this.code = options.code;
	}
}

export async function createHttpError(
	response: Response,
	context: RequestErrorContext,
): Promise<CommandCodeRequestError> {
	const { baseUrl } = context;
	const responseText = await response.text();
	const serverMessage = extractServerMessage(responseText);
	const serverCode = extractServerCode(responseText);
	const userSummary = getHttpErrorMessage(
		response.status,
		serverMessage,
		errorActionUrlStore.get().createApiKey,
	);

	return new CommandCodeRequestError({
		message: `Command Code API request failed with HTTP ${response.status}`,
		userSummary,
		kind: 'http',
		baseUrl,
		status: response.status,
		code: serverCode ?? `HTTP_${response.status}`,
		diagnosticMessage: joinDiagnosticParts(
			`kind=http`,
			`status=${response.status}`,
			getRequestDiagnosticMessage(context),
			`statusText=${safeStringify(response.statusText || 'unknown')}`,
			serverMessage ? `serverMessage=${safeStringify(serverMessage)}` : undefined,
			serverCode ? `serverCode=${safeStringify(serverCode)}` : undefined,
			responseText && responseText !== serverMessage
				? `body=${safeStringify(truncateSingleLine(responseText))}`
				: undefined,
		),
	});
}

export function normalizeRequestError(error: unknown, context: RequestErrorContext): Error {
	if (error instanceof CommandCodeRequestError) {
		return error;
	}

	if (!(error instanceof Error)) {
		const value = truncateSingleLine(String(error));
		return new CommandCodeRequestError({
			message: `Command Code request failed with a non-Error value: ${value}`,
			userSummary: t('error.unknown', value),
			kind: 'unknown',
			baseUrl: context.baseUrl,
			diagnosticMessage: joinDiagnosticParts(
				`kind=unknown`,
				getRequestDiagnosticMessage(context),
				`error=${safeStringify(value)}`,
			),
		});
	}

	const causeInfo = getNetworkErrorCauseInfo(error);
	if (!causeInfo) {
		return error;
	}

	const code = getNetworkErrorCode(causeInfo);
	const userSummary = getNetworkErrorMessage(code);
	const enhanced = new CommandCodeRequestError({
		message: code
			? `Command Code request failed due to network error ${code}`
			: 'Command Code request failed due to a network error',
		userSummary,
		kind: 'network',
		baseUrl: context.baseUrl,
		code,
		cause: error,
		diagnosticMessage: joinDiagnosticParts(
			`kind=network`,
			code ? `code=${code}` : undefined,
			getRequestDiagnosticMessage(context),
			`message=${safeStringify(truncateSingleLine(error.message))}`,
			`cause=${causeInfo.value}`,
		),
	});
	enhanced.stack = error.stack;
	return enhanced;
}

export function formatRequestError(error: Error): string {
	const diagnosticMessage = joinDiagnosticParts(
		error instanceof CommandCodeRequestError
			? error.diagnosticMessage
			: `message=${safeStringify(error.message)}`,
	);
	return error.stack ? `${diagnosticMessage}\n${error.stack}` : diagnosticMessage;
}

export function createUserFacingError(error: Error): Error {
	const message =
		error instanceof CommandCodeRequestError
			? formatMarkdownMessage(error.userSummary, getErrorActions(error, errorActionUrlStore.get()))
			: error.message;
	const displayError = new Error(message);
	displayError.stack = undefined;
	return displayError;
}

function getHttpErrorMessage(
	status: number,
	serverMessage?: string,
	createApiKeyUrl?: string,
): string {
	const detail = serverMessage ?? '';
	switch (status) {
		case 400:
			return t('error.http.400', status, detail);
		case 401:
			return createApiKeyUrl
				? t('error.http.401.withCreateApiKeyLink', status, createApiKeyUrl)
				: t('error.http.401', status);
		case 403:
			return createApiKeyUrl
				? t('error.http.403.withUpgradeLink', status, createApiKeyUrl)
				: t('error.http.403', status);
		case 422:
			return t('error.http.422', status, detail || 'cmd_zdr_no_providers');
		case 429:
			return t('error.http.429', status);
		case 500:
			return t('error.http.500', status);
		case 503:
			return t('error.http.503', status);
		default:
			return t('error.http.generic', status, detail);
	}
}

function extractServerMessage(responseText: string): string | undefined {
	const trimmed = responseText.trim();
	if (!trimmed) {
		return undefined;
	}

	try {
		const parsed: unknown = JSON.parse(trimmed);
		const error = getObjectProperty(parsed, 'error');
		const message =
			getStringProperty(error, 'message') ??
			getStringProperty(parsed, 'message') ??
			(typeof error === 'string' ? error : undefined);
		return message ? truncateSingleLine(message) : undefined;
	} catch {
		return truncateSingleLine(trimmed);
	}
}

function extractServerCode(responseText: string): string | undefined {
	const trimmed = responseText.trim();
	if (!trimmed) {
		return undefined;
	}

	try {
		const parsed: unknown = JSON.parse(trimmed);
		const error = getObjectProperty(parsed, 'error');
		return getStringProperty(error, 'code') ?? getStringProperty(error, 'type');
	} catch {
		return undefined;
	}
}

function getRequestDiagnosticMessage(context: RequestErrorContext): string {
	const model = context.request?.model;
	return model ? `model=${model}` : 'model=<not-yet-built>';
}

function getErrorStatusKey(status: number | undefined): 401 | 403 | 422 | '5xx' | undefined {
	if (status === undefined) {
		return undefined;
	}
	if (status === 401) return 401;
	if (status === 403) return 403;
	if (status === 422) return 422;
	if (status >= 500) return '5xx';
	return undefined;
}

function getErrorActions(error: CommandCodeRequestError, urls: ErrorActionUrls): ErrorActionLink[] {
	if (error.kind !== 'http' || error.status === undefined) {
		return [];
	}

	const statusKey = getErrorStatusKey(error.status);
	if (!statusKey) {
		return [];
	}

	const definition = API_PROVIDER_HTTP_ERROR_LINKS[statusKey].commandcode;
	if (!definition) {
		return [];
	}

	const url = urls[definition.labelKey.replace('error.action.', '') as keyof ErrorActionUrls];
	if (!url) {
		return [];
	}

	return [{ labelKey: definition.labelKey, url }];
}

function formatMarkdownMessage(summary: string, actions: ErrorActionLink[]): string {
	if (actions.length === 0) {
		return summary;
	}
	const links = actions.map((action) => `[${t(action.labelKey)}](${action.url})`).join(' · ');
	return `${summary}\n\n${links}`;
}

function joinDiagnosticParts(...parts: (string | undefined)[]): string {
	return parts.filter((p): p is string => Boolean(p)).join(' | ');
}

function truncateSingleLine(value: string): string {
	const singleLine = value.replace(/\s+/gu, ' ').trim();
	return singleLine.length > MAX_DIAGNOSTIC_FIELD_LENGTH
		? `${singleLine.slice(0, MAX_DIAGNOSTIC_FIELD_LENGTH)}...`
		: singleLine;
}

function getObjectProperty(value: unknown, key: string): unknown {
	return typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)[key]
		: undefined;
}

function getStringProperty(value: unknown, key: string): string | undefined {
	const property = getObjectProperty(value, key);
	return typeof property === 'string' && property.length > 0 ? property : undefined;
}
