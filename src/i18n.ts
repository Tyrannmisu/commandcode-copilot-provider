import vscode from 'vscode';

/**
 * Lightweight i18n module — zero dependencies, follows VS Code display language.
 *
 *  - en / en-US / en-*      → English (default)
 *  - zh-cn                  → Simplified Chinese
 *  - all other locales      → English until translated
 */

function isZh(): boolean {
	const lang = vscode.env.language.toLowerCase();
	return lang === 'zh-cn';
}

// ---- Translation dictionaries ----

type Translations = Record<string, string>;

const zh: Translations = {
	// Auth
	'auth.apiKeyRequiredDetail': '请先配置 API Key',
	'auth.prompt': '请输入 Command Code API Key。',
	'auth.placeholder': 'cmd-... 或服务商令牌',
	'auth.emptyValidation': 'API Key 不能为空',
	'auth.saved': 'API Key 已安全保存。',
	'auth.removed': 'API Key 已移除。',
	'auth.notConfigured': 'API Key 未配置，请在命令面板运行 "Command Code: 设置 API Key"。',

	// Thinking Effort — short labels for model picker dropdown
	'status.thinking': '思考模式',
	'thinking.none': '停用',
	'thinking.none.desc': '停用思考，响应更快',
	'thinking.low': '轻量',
	'thinking.low.desc': '轻量推理，适合快速编辑和简单任务',
	'thinking.medium': '标准',
	'thinking.medium.desc': '推荐日常使用',
	'thinking.high': '深度',
	'thinking.high.desc': '深度推理，适合复杂任务',

	// Models
	'models.refreshInProgress': '正在刷新模型列表...',
	'models.refreshSucceeded': '已从 Command Code 拉取 {0} 个模型。',
	'models.refreshFailed': '拉取模型列表失败：{0}',
	'models.empty': '没有可用的模型。请检查 API Key，或调整模型黑名单设置。',
	'models.fetchRequiresKey': '需要先配置 API Key 才能拉取模型列表。',

	// Request
	'request.toolsLimitExceeded':
		'Command Code 单次 tools 请求最多支持 {0} 个 functions，当前请求包含 {1} 个。请先用 VS Code 的 Configure Tools 关闭不常用的工具。',

	// Errors
	'error.http.400': '[{0}] 请求体格式错误。{1}',
	'error.http.401':
		'[{0}] API Key 错误，认证失败。请检查您的 API Key 是否正确。如果没有 API key，请前往 Studio 创建。',
	'error.http.401.withCreateApiKeyLink':
		'[{0}] API Key 错误，认证失败。请检查您的 API Key 是否正确。如果没有 API key，请前往 [Studio]({1}) 创建。',
	'error.http.403':
		'[{0}] 当前订阅计划不支持 API 访问。请升级到 GOAT 或更高级别（Provider 计划是按量计费）。',
	'error.http.403.withUpgradeLink':
		'[{0}] 当前订阅计划不支持 API 访问。请升级到 GOAT 或更高级别（Provider 计划是按量计费）。查看 [套餐]({1})。',
	'error.http.422': '[{0}] 请求体参数错误（{1}）。请检查模型 ID、参数或 ZDR 设置。',
	'error.http.429': '[{0}] 请求速率过高。请稍后重试。',
	'error.http.500': '[{0}] 服务器内部故障。请稍后重试。',
	'error.http.503': '[{0}] 服务器负载过高。请稍后重试。',
	'error.http.generic': '[{0}] 服务返回错误响应：{1}',
	'error.action.createApiKey': '创建 API Key',
	'error.action.viewPricing': '套餐详情',
	'error.network.dns': '[{0}] DNS 解析失败。请检查网络连接、防火墙或代理设置，以及自定义 baseUrl。',
	'error.network.unreachable':
		'[{0}] 目标不可达或拒绝连接。请检查自定义 baseUrl、代理服务、网络连接或防火墙设置。',
	'error.network.interrupted': '[{0}] 连接被中断。请检查网络连接、防火墙或代理设置，或稍后重试。',
	'error.network.timeout': '[{0}] 连接超时。请稍后重试，或检查网络连接、防火墙或代理设置。',
	'error.network.tls': '[{0}] TLS/证书校验失败。请检查代理、证书配置或自定义 baseUrl。',
	'error.network.aborted':
		'[{0}] 请求已中止。如果不是主动取消，请检查网络连接或代理设置，或稍后重试。',
	'error.network.protocol':
		'[{0}] HTTP 连接或响应解析失败。请检查代理设置、自定义 baseUrl 或服务响应。',
	'error.network.configuration': '[{0}] 请求配置无效。请检查自定义 baseUrl 或扩展设置。',
	'error.network.generic':
		'[{0}] 网络请求失败。请检查网络连接、防火墙或代理设置，以及自定义 baseUrl。',
	'error.unknown': 'Command Code 请求失败：{0}',

	// Extension
	'extension.activateFailed': 'Command Code 扩展激活失败，请查看日志。',
	'extension.welcomeFailed': '欢迎流程执行失败。',
	'extension.deactivateFailed': '停用 Command Code 扩展时出错。',
};

const en: Translations = {
	// Auth
	'auth.apiKeyRequiredDetail': 'Configure your API key to enable this model',
	'auth.prompt': 'Enter your Command Code API key.',
	'auth.placeholder': 'cmd-... or provider token',
	'auth.emptyValidation': 'API key cannot be empty',
	'auth.saved': 'API key saved securely.',
	'auth.removed': 'API key removed.',
	'auth.notConfigured':
		'API key not configured. Run "Command Code: Set API Key" from the command palette.',

	// Thinking Effort — short labels for model picker dropdown
	'status.thinking': 'Thinking effort',
	'thinking.none': 'Off',
	'thinking.none.desc': 'Disable thinking, fastest responses',
	'thinking.low': 'Light',
	'thinking.low.desc': 'Light reasoning for quick edits and simple tasks',
	'thinking.medium': 'Standard',
	'thinking.medium.desc': 'Recommended for everyday use',
	'thinking.high': 'Deep',
	'thinking.high.desc': 'Deep reasoning for complex tasks',

	// Models
	'models.refreshInProgress': 'Refreshing model list...',
	'models.refreshSucceeded': 'Pulled {0} models from Command Code.',
	'models.refreshFailed': 'Failed to refresh models: {0}',
	'models.empty': 'No models are available. Check your API key or model blacklist.',
	'models.fetchRequiresKey': 'Set an API key before refreshing the model list.',

	// Request
	'request.toolsLimitExceeded':
		"Command Code accepts at most {0} tools per request; this request contains {1}. Disable rarely-used tools in VS Code's Configure Tools view.",

	// Errors
	'error.http.400': '[{0}] Malformed request body. {1}',
	'error.http.401':
		"[{0}] Authentication failed. Check your Command Code API key. Create one in Studio if you don't have one yet.",
	'error.http.401.withCreateApiKeyLink':
		"[{0}] Authentication failed. Check your Command Code API key. Create one in [Studio]({1}) if you don't have one yet.",
	'error.http.403':
		'[{0}] Your plan does not include API access. Upgrade to GOAT or higher (the Provider plan is pay-as-you-go).',
	'error.http.403.withUpgradeLink':
		'[{0}] Your plan does not include API access. Upgrade to GOAT or higher. See [pricing]({1}).',
	'error.http.422':
		'[{0}] Invalid request parameters ({1}). Check the model ID, parameters, or ZDR setting.',
	'error.http.429': '[{0}] Rate limit exceeded. Try again in a moment.',
	'error.http.500': '[{0}] Internal server error. Try again later.',
	'error.http.503': '[{0}] Service is overloaded. Try again later.',
	'error.http.generic': '[{0}] The service returned an error: {1}',
	'error.action.createApiKey': 'Create API key',
	'error.action.viewPricing': 'Pricing',
	'error.network.dns':
		'[{0}] DNS lookup failed. Check your network, firewall, proxy, and the custom baseUrl.',
	'error.network.unreachable':
		'[{0}] The endpoint is unreachable or refused the connection. Check the custom baseUrl, proxy, network, and firewall.',
	'error.network.interrupted':
		'[{0}] The connection was interrupted. Check your network, firewall, or proxy, or retry shortly.',
	'error.network.timeout':
		'[{0}] The connection timed out. Retry shortly, or check your network, firewall, and proxy.',
	'error.network.tls':
		'[{0}] TLS / certificate validation failed. Check your proxy, certificates, and custom baseUrl.',
	'error.network.aborted':
		'[{0}] Request aborted. If you did not cancel it, check your network or proxy, or retry shortly.',
	'error.network.protocol':
		'[{0}] HTTP connection or response parsing failed. Check your proxy, custom baseUrl, or the service response.',
	'error.network.configuration':
		'[{0}] Invalid request configuration. Check the custom baseUrl and extension settings.',
	'error.network.generic':
		'[{0}] Network request failed. Check your network, firewall, or proxy, and the custom baseUrl.',
	'error.unknown': 'Command Code request failed: {0}',

	// Extension
	'extension.activateFailed': 'Command Code extension failed to activate; see logs for details.',
	'extension.welcomeFailed': 'Welcome walkthrough failed.',
	'extension.deactivateFailed': 'Failed to deactivate Command Code extension cleanly.',
};

export function t(key: string, ...args: unknown[]): string {
	const dict = isZh() ? zh : en;
	const template = dict[key] ?? en[key] ?? key;
	if (args.length === 0) {
		return template;
	}
	return template.replace(/\{(\d+)\}/g, (_match, index: string) => {
		const i = Number(index);
		return i < args.length ? String(args[i]) : '';
	});
}
