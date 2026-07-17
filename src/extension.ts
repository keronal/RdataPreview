import * as vscode from 'vscode';
import { RDataEditorProvider } from './rdataEditorProvider';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(RDataEditorProvider.register(context));
}

export function deactivate() {}
