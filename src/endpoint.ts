import { DEFAULT_BASE_URL } from './consts';

export const OFFICIAL_COMMANDCODE_HOST = 'api.commandcode.ai';

/**
 * Returns true when the configured base URL points at the official Command
 * Code provider host. Used for settings that only apply to first-party usage
 * (e.g. the ZDR header documentation tooltip).
 */
export function isOfficialBaseUrl(baseUrl: string): boolean {
	try {
		return new URL(baseUrl).hostname.toLowerCase() === OFFICIAL_COMMANDCODE_HOST;
	} catch {
		return false;
	}
}

export function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.trim().replace(/\/+$/u, '');
}

/** Default base URL for documentation/UI references. */
export function getDefaultBaseUrl(): string {
	return DEFAULT_BASE_URL;
}
