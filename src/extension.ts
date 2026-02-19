import * as vscode from 'vscode';
import { YouTypeEditorProvider } from './YouTypeEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    YouTypeEditorProvider.register(context)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('youtype.openAsText', () => {
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (activeTab?.input instanceof vscode.TabInputCustom) {
        vscode.commands.executeCommand(
          'vscode.openWith',
          activeTab.input.uri,
          'default'
        );
      }
    })
  );
}

export function deactivate(): void {}
