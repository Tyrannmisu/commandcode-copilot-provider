/**
 * Compile-time constants shared across the extension.
 *
 * These do NOT depend on the VS Code runtime (no workspace configuration,
 * no secrets API). For run-time settings reads see `config.ts`.
 */

/** VS Code configuration section prefix for all extension settings. */
export const CONFIG_SECTION = 'commandcode-copilot';

export const EXTERNAL_URLS = {
	commandcode: {
		apiKeys: 'https://commandcode.ai/docs/studio#api-keys',
		studio: 'https://commandcode.ai/studio/',
		pricing: 'https://commandcode.ai/docs/resources/pricing-limits',
	},
} as const;

/** URI path handled by this extension to reveal the output log. */
export const SHOW_LOGS_URI_PATH = '/showLogs';

/** URI path handled by this extension to open API key configuration. */
export const CONFIGURE_API_KEY_URI_PATH = '/setApiKey';

/** URI path handled by this extension to refresh the model list. */
export const REFRESH_MODELS_URI_PATH = '/refreshModels';

// VS Code's internal LanguageModelChatMessageRole.System is not exposed in @types/vscode.
export const LANGUAGE_MODEL_CHAT_SYSTEM_ROLE = 3;

// ---- Secret keys ----

/** SecretStorage key for the Command Code API key. */
export const API_KEY_SECRET = 'commandcode-copilot.apiKey';

/** memento key tracking whether the welcome walkthrough has been shown. */
export const WELCOME_SHOWN_KEY = 'commandcode-copilot.welcomeShown';

// ---- Walkthrough ----

/** Walkthrough contribution ID. */
export const WALKTHROUGH_ID = 'Tyrannmisu.commandcode-copilot-provider#commandcodeGettingStarted';

// ---- Limits ----

/** Chat Completions tools limit surfaced in error messages. */
export const TOOLS_LIMIT = 128;

// ---- Provider defaults ----

/** Default Command Code Provider API base URL. */
export const DEFAULT_BASE_URL = 'https://api.commandcode.ai/provider/v1';

/** Vendor ID exposed to GitHub Copilot Chat. */
export const VENDOR_ID = 'commandcode';

/** Family identifier used for chat info. */
export const FAMILY = 'commandcode';
