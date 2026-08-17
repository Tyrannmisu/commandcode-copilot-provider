import vscode from 'vscode';
import { setErrorActionUrl, type ErrorActionUrls } from '../client';
import { CONFIGURE_API_KEY_URI_PATH, REFRESH_MODELS_URI_PATH, SHOW_LOGS_URI_PATH } from '../consts';
import { logger } from '../logger';

interface ActionUrlDefinition {
	key?: keyof ErrorActionUrls;
	path: string;
	handle: () => void | Thenable<unknown>;
	resolveFailureMessage: string;
}

const ACTION_URLS: readonly ActionUrlDefinition[] = [
	{
		key: 'configureApiKey',
		path: CONFIGURE_API_KEY_URI_PATH,
		handle: () => vscode.commands.executeCommand('commandcode-copilot.setApiKey'),
		resolveFailureMessage: 'Failed to resolve Command Code set API key URI',
	},
	{
		key: 'showLogs',
		path: SHOW_LOGS_URI_PATH,
		handle: () => logger.show(),
		resolveFailureMessage: 'Failed to resolve Command Code show logs URI',
	},
	{
		path: REFRESH_MODELS_URI_PATH,
		handle: () => vscode.commands.executeCommand('commandcode-copilot.refreshModels'),
		resolveFailureMessage: 'Failed to resolve Command Code refresh models URI',
	},
];

export function registerActionUrls(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.window.registerUriHandler({
			handleUri(uri) {
				const action = ACTION_URLS.find((item) => item.path === uri.path);
				if (action) {
					void Promise.resolve(action.handle()).catch((error) => {
						logger.warn(`Failed to handle Command Code URI action: ${uri.path}`, error);
					});
					return;
				}
				logger.warn(`Unhandled Command Code URI: ${uri.toString(true)}`);
			},
		}),
	);

	for (const action of ACTION_URLS) {
		resolveActionUrl(context, action);
	}
}

function resolveActionUrl(context: vscode.ExtensionContext, action: ActionUrlDefinition): void {
	const rawUri = vscode.Uri.from({
		scheme: vscode.env.uriScheme,
		authority: context.extension.id,
		path: action.path,
	});
	setActionUrl(action, rawUri.toString());
	void vscode.env.asExternalUri(rawUri).then(
		(uri) => setActionUrl(action, uri.toString()),
		(error) => logger.warn(action.resolveFailureMessage, error),
	);
}

function setActionUrl(action: ActionUrlDefinition, url: string): void {
	if (action.key) {
		setErrorActionUrl(action.key, url);
	}
}
