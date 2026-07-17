import * as vscode from 'vscode';
import * as path from 'path';
import { readRData, RDataResult } from './rBridge';

class RDataDocument implements vscode.CustomDocument {
  constructor(public readonly uri: vscode.Uri) {}
  dispose() {}
}

export class RDataEditorProvider
  implements vscode.CustomReadonlyEditorProvider<RDataDocument>
{
  private static readonly viewType = 'rdataPreview.editor';

  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      RDataEditorProvider.viewType,
      new RDataEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  openCustomDocument(uri: vscode.Uri): RDataDocument {
    return new RDataDocument(uri);
  }

  async resolveCustomEditor(
    document: RDataDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview'),
      ],
    };

    webviewPanel.webview.html = this.getHtml(webviewPanel.webview);

    // Load and send data
    await this.loadAndSend(document, webviewPanel, _token);

    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(document.uri, '*')
    );
    watcher.onDidChange(async () => {
      await this.loadAndSend(document, webviewPanel, _token);
    });
    webviewPanel.onDidDispose(() => watcher.dispose());
  }

  private async loadAndSend(
    document: RDataDocument,
    panel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    panel.webview.postMessage({ type: 'loading' });

    try {
      const result = await readRData(
        document.uri.fsPath,
        this.context.extensionPath,
        token
      );
      panel.webview.postMessage({ type: 'data', payload: result });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      panel.webview.postMessage({ type: 'error', message });
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'src', 'webview', 'style.css')
    );
    const nonce = getNonce();

    return /*html*/ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${styleUri}">
  <title>RData Preview</title>
</head>
<body>
  <div id="app">
    <div id="loading" class="center-message">
      <div class="spinner"></div>
      <p>Loading RData file…</p>
    </div>
    <div id="error" class="center-message hidden"></div>
    <div id="content" class="hidden">
      <div id="sidebar"></div>
      <div id="main">
        <div id="toolbar"></div>
        <div id="view-container"></div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
