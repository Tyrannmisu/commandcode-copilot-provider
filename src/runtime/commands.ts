import vscode from 'vscode';
import { EXTERNAL_URLS } from '../consts';
import { logger } from '../logger';

export function registerCommands(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('commandcode-copilot.showLogs', () => logger.show()),
		vscode.commands.registerCommand('commandcode-copilot.getApiKey', () =>
			vscode.env.openExternal(vscode.Uri.parse(EXTERNAL_URLS.commandcode.studio)),
		),
		vscode.commands.registerCommand('commandcode-copilot.openSettings', () =>
			vscode.commands.executeCommand('workbench.action.openSettings', 'commandcode-copilot'),
		),
	);
}
