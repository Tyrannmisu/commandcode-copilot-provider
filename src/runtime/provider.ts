import vscode from 'vscode';
import { logger } from '../logger';
import { CommandCodeChatProvider } from '../provider';

export async function registerProvider(
	context: vscode.ExtensionContext,
): Promise<CommandCodeChatProvider> {
	const provider = new CommandCodeChatProvider(context);

	context.subscriptions.push(
		vscode.commands.registerCommand('commandcode-copilot.setApiKey', () =>
			provider.configureApiKey(),
		),
		vscode.commands.registerCommand('commandcode-copilot.clearApiKey', () =>
			provider.clearApiKey(),
		),
		vscode.commands.registerCommand('commandcode-copilot.refreshModels', () =>
			provider.refreshModelPicker(true),
		),
		vscode.lm.registerLanguageModelChatProvider('commandcode', provider),
	);

	// Copilot Chat can serve cached model info without configurationSchema.
	// Activate it first so this refresh reaches a live listener and re-queries the provider.
	await activateCopilotChat();
	provider.refreshModelPicker();

	return provider;
}

async function activateCopilotChat(): Promise<void> {
	try {
		await vscode.extensions.getExtension('github.copilot-chat')?.activate();
	} catch (error) {
		logger.warn('Copilot Chat activation unavailable; model picker refresh may be delayed', error);
	}
}
